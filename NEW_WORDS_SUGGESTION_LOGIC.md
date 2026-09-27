# Логика предложения новых слов

## Проблема (старая логика)

Ранее система работала неправильно:
1. LLM оценивал только **целевые слова** (которые уже есть в `user_words`)
2. Если целевое слово было переведено неправильно, система предлагала добавить его в словарь
3. Но это слово **уже было** в `user_words`, поэтому предложение игнорировалось
4. Результат: пользователь никогда не получал предложений добавить новые слова

**Пример проблемы:**
```
Предложение: "During the night, anyone could walk towards the park."
Перевод пользователя: "ночью любой может бежать мимо больницы"

Целевые слова (уже в user_words): night, towards, anyone
- night: переведено правильно ✓
- towards: переведено неправильно ✗ (уже в user_words!)
- anyone: переведено правильно ✓

Результат: система предлагает добавить "towards", но оно уже есть в user_words
Новые слова (walk, park), которые пользователь перевёл неправильно, игнорируются
```

## Решение (новая логика)

Теперь система работает правильно:

### 1. LLM анализирует ВСЁ предложение

Промпт для GigaChat теперь содержит две задачи:

**Задача 1: Оценить целевые слова**
- Проверить правильность перевода целевых слов
- Обновить их stage в `user_words`

**Задача 2: Найти НОВЫЕ слова для изучения**
- Проанализировать ВСЁ предложение
- Найти слова, которые пользователь перевёл неправильно или пропустил
- Исключить целевые слова (они уже изучаются)
- Предложить важные слова (существительные, глаголы, прилагательные)
- Игнорировать служебные части речи (артикли, предлоги, союзы)

### 2. Формат ответа LLM

```json
{
  "word_results": [
    {"word_id": "id1", "lemma": "night", "translation": "ночь", "is_correct": true, "has_typo": false},
    {"word_id": "id2", "lemma": "towards", "translation": "по направлению к", "is_correct": false, "has_typo": false},
    {"word_id": "id3", "lemma": "anyone", "translation": "кто-либо", "is_correct": true, "has_typo": false}
  ],
  "suggested_new_words": [
    {"lemma": "walk", "pos": "verb", "translation": "ходить"},
    {"lemma": "park", "pos": "noun", "translation": "парк"}
  ],
  "overall_correct": false,
  "correct_translation": "Ночью кто-либо мог идти по направлению к парку"
}
```

**Ключевое отличие:** `suggested_new_words` теперь содержит объекты с `lemma`, `pos`, `translation`, а не ID целевых слов.

### 3. Фильтрация на backend

После получения ответа от LLM backend выполняет фильтрацию:

```python
for suggested_word in suggested_words:
    lemma = suggested_word.get("lemma")
    
    # 1. Ищем слово в dictionaries по lemma
    dict_word = await db.execute(
        select(Dictionary).where(
            Dictionary.lemma == lemma,
            Dictionary.target_lang == target_lang
        )
    )
    
    if not dict_word:
        continue  # Слово не найдено в словаре
    
    # 2. Проверяем, что это НЕ целевое слово
    if dict_word.id in target_word_ids:
        continue  # Это целевое слово, не предлагаем
    
    # 3. Проверяем, что слова нет в user_words
    user_word = await db.execute(
        select(UserWord).where(
            UserWord.user_language_profile_id == profile_id,
            UserWord.dictionary_id == dict_word.id
        )
    )
    
    if user_word:
        continue  # Слово уже изучается
    
    # 4. Добавляем в список предложений
    filtered_suggestions.append({
        "dictionary_id": dict_word.id,
        "lemma": lemma,
        "translation": translation
    })
```

### 4. Отображение на фронтенде

Пользователь видит блок с предложением добавить новые слова:

```
💡 Хотите добавить эти слова в словарь?

┌─────────────────────────────────────┐
│ walk  → ходить          [Добавить] │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ park  → парк            [Добавить] │
└─────────────────────────────────────┘
```

При нажатии "Добавить":
- Слово добавляется в `user_words` со статусом `active`
- Кнопка меняется на "✓ Добавлено"
- Слово будет повторяться в будущих уроках

## Пример работы

### Сценарий 1: Пользователь переводит с ошибками

**Предложение:** "During the night, anyone could walk towards the park."

**Перевод пользователя:** "ночью любой может бежать мимо больницы"

**Целевые слова (уже в user_words):** night, towards, anyone

**Результат оценки:**
- night: переведено правильно ✓
- towards: переведено неправильно ✗ (уже в user_words, не предлагаем)
- anyone: переведено правильно ✓

**Новые слова найдены LLM:**
- walk: пользователь перевёл как "бежать" (неправильно)
- park: пользователь перевёл как "больницы" (неправильно)

**Предложение пользователю:**
```
💡 Хотите добавить эти слова в словарь?

walk  → ходить      [Добавить]
park  → парк        [Добавить]
```

### Сценарий 2: Пользователь переводит правильно

**Предложение:** "The quick brown fox jumps over the lazy dog."

**Перевод пользователя:** "Быстрая коричневая лиса прыгает через ленивую собаку."

**Целевые слова:** quick, fox, lazy

**Результат оценки:**
- quick: переведено правильно ✓
- fox: переведено правильно ✓
- lazy: переведено правильно ✓

**Новые слова найдены LLM:** нет (все слова переведены правильно)

**Предложение пользователю:** блок не отображается

### Сценарий 3: Новые слова не найдены в dictionaries

**Предложение:** "The cat sat on the mat."

**Перевод пользователя:** "Кошка сидела"

**Целевые слова:** cat, sat

**Результат оценки:**
- cat: переведено правильно ✓
- sat: переведено правильно ✓

**Новые слова найдены LLM:**
- mat: пользователь пропустил это слово

**Фильтрация на backend:**
- mat: НЕ найдено в dictionaries (слово не импортировано)
- Результат: слово не предлагается

**Предложение пользователю:** блок не отображается

## Логи для отладки

### Успешное предложение новых слов

```
[GigaChat] === Результат от LLM ===
[GigaChat] Overall correct: False
[GigaChat] Suggested new words от LLM: [
  {"lemma": "walk", "pos": "verb", "translation": "ходить"},
  {"lemma": "park", "pos": "noun", "translation": "парк"}
]
[GigaChat] Начинаю фильтрацию 2 предложенных новых слов...
[GigaChat] Проверяю новое слово: 'walk' (verb)
[GigaChat] ✓ Слово 'walk' найдено в dictionaries (ID: abc-123)
[GigaChat] ✓✓✓ Слова 'walk' НЕТ в user_words, предлагаю добавить!
[GigaChat] Проверяю новое слово: 'park' (noun)
[GigaChat] ✓ Слово 'park' найдено в dictionaries (ID: def-456)
[GigaChat] ✓✓✓ Слова 'park' НЕТ в user_words, предлагаю добавить!
[GigaChat] После фильтрации: 2 новых слов для предложения
```

### Слово уже есть в user_words

```
[GigaChat] Проверяю новое слово: 'walk' (verb)
[GigaChat] ✓ Слово 'walk' найдено в dictionaries (ID: abc-123)
[GigaChat] ✗ Слово 'walk' УЖЕ есть в user_words, не предлагаю
```

### Слово не найдено в dictionaries

```
[GigaChat] Проверяю новое слово: 'mat' (noun)
[GigaChat] ✗ Слово 'mat' НЕ найдено в dictionaries
```

### Слово является целевым

```
[GigaChat] Проверяю новое слово: 'towards' (preposition)
[GigaChat] ✓ Слово 'towards' найдено в dictionaries (ID: ghi-789)
[GigaChat] ✗ Слово 'towards' является целевым, не предлагаю
```

## Преимущества новой логики

✅ **Правильное предложение новых слов** - система предлагает слова, которых пользователь ещё не изучает  
✅ **Анализ всего предложения** - LLM оценивает не только целевые слова, но и весь контекст  
✅ **Исключение дубликатов** - целевые слова и слова из user_words не предлагаются повторно  
✅ **Проверка наличия в dictionaries** - предлагаются только слова, которые есть в базе данных  
✅ **Перевод для пользователя** - каждое предложенное слово показывается с переводом  
✅ **Гибкость** - пользователь может выбрать, какие слова добавить  

## Технические детали

### Формат данных

**Backend → Frontend:**
```typescript
interface SuggestedWord {
  dictionary_id: string;
  lemma: string;
  translation: string;
}

interface EvaluationResult {
  word_results: WordResult[];
  suggested_new_words: SuggestedWord[];
  overall_correct: boolean;
  correct_translation?: string;
}
```

**Frontend → Backend (при добавлении слова):**
```typescript
POST /api/words/add
{
  "profile_id": "profile-123",
  "dictionary_id": "dict-456",
  "status": "active"
}
```

### База данных

**Таблица `dictionaries`:**
- `id` (UUID)
- `target_lang` (en, de, es, fr)
- `lemma` (начальная форма слова)
- `pos` (часть речи)
- `cefr_level` (A1, A2, B1, B2)

**Таблица `user_words`:**
- `id` (UUID)
- `user_language_profile_id` (UUID)
- `dictionary_id` (UUID)
- `stage` (0-10)
- `due_lesson_number` (integer)
- `status` (active, ignored, learned)

### Поиск слова в dictionaries

```sql
SELECT * FROM dictionaries 
WHERE lemma = 'walk' 
AND target_lang = 'en';
```

### Проверка наличия в user_words

```sql
SELECT * FROM user_words 
WHERE user_language_profile_id = 'profile-123' 
AND dictionary_id = 'dict-456';
```

## Заключение

Новая логика правильно определяет слова, которые пользователь перевёл неправильно, и предлагает добавить их в словарь для изучения. Система анализирует ВСЁ предложение, а не только целевые слова, что позволяет пользователю расширять свой словарный запас более эффективно.
