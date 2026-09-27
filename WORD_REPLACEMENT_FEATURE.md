# Функция замены слов на странице "Новые слова"

## Обзор

Когда пользователь помечает слово как выученное на странице "Новые слова", система автоматически находит и добавляет другое новое слово из словаря, чтобы в уроке оставалось требуемое количество слов для изучения.

## Как это работает

### Логика работы

1. Пользователь нажимает кнопку удаления на слове
2. Слово помечается как выученное (`status = 'learned'`)
3. Система запрашивает новое слово из словаря
4. Новое слово добавляется в `user_words` со статусом `active`
5. Новое слово появляется в списке на странице "Новые слова"
6. Урок теперь содержит требуемое количество слов

### Пример сценария

**Исходное состояние:**
- Лимит слов в уроке: 7
- Due words: 3
- New words: 4
- Всего в уроке: 7 слов

**Пользователь удаляет 1 слово:**
- Удалённое слово помечается как выученное
- Система находит 1 новое слово из словаря
- Новое слово добавляется в user_words
- Новое слово появляется в списке

**Результат:**
- Due words: 3
- New words: 4 (3 оставшихся + 1 новое)
- Всего в уроке: 7 слов ✓

## Backend реализация

### Новый endpoint: POST /api/words/replace

**Запрос:**
```json
{
  "profile_id": "uuid",
  "removed_dictionary_id": "uuid"
}
```

**Ответ (успех):**
```json
{
  "status": "success",
  "new_word": {
    "id": "uuid",
    "lemma": "run",
    "pos": "verb",
    "translations": ["бежать", "бегать"]
  }
}
```

**Ответ (нет доступных слов):**
```json
{
  "status": "no_words_available",
  "new_word": null
}
```

### Логика endpoint

1. Получает профиль пользователя
2. Получает все слова пользователя (для исключения)
3. Ищет новое слово из словаря с помощью `LessonService.get_new_words`
4. Если слово найдено:
   - Добавляет его в `user_words`
   - Получает переводы на родной язык пользователя
   - Возвращает информацию о новом слове
5. Если слово не найдено:
   - Возвращает `status: "no_words_available"`

### Код backend

```python
@app.post("/api/words/replace")
async def replace_word(req: ReplaceWordRequest, db: AsyncSession = Depends(get_db)):
    """Заменить удаленное слово на новое из словаря"""
    logger.info(f"[Word Replace] Replacing word: removed_dictionary_id={req.removed_dictionary_id}")
    
    # Get profile
    profile = await db.execute(...)
    
    # Get all user words to exclude them
    user_word_ids = set(...)
    user_word_ids.add(req.removed_dictionary_id)
    
    # Find new word from dictionary
    new_word = await LessonService.get_new_words(
        db, 
        req.profile_id, 
        profile.target_lang, 
        1,
        user_word_ids, 
        profile.cefr_level
    )
    
    if not new_word:
        return {"status": "no_words_available", "new_word": None}
    
    # Add new word to user_words
    new_user_word = UserWord(...)
    db.add(new_user_word)
    await db.flush()
    
    # Get translations
    translations = ...
    
    return {
        "status": "success",
        "new_word": {
            "id": new_word.id,
            "lemma": new_word.lemma,
            "pos": new_word.pos,
            "translations": translations
        }
    }
```

## Frontend реализация

### Новая функция в API клиенте

```typescript
export async function replaceWord(
  profileId: string, 
  removedDictionaryId: string
): Promise<{ 
  status: string; 
  new_word: {
    id: string;
    lemma: string;
    pos: string;
    translations: string[];
  } | null 
}>
```

### Обновлённая функция handleRemoveNewWord

```typescript
const handleRemoveNewWord = async (dictionaryId: string) => {
  if (!profile) return;
  
  try {
    // Пометить слово как выученное
    await markWordLearned(profile.id, dictionaryId);
    setRemovedNewWords(prev => new Set([...prev, dictionaryId]));
    
    // Запросить замену слова
    const replaceResult = await replaceWord(profile.id, dictionaryId);
    
    if (replaceResult.status === 'success' && replaceResult.new_word) {
      // Добавить новое слово в список
      setNewWords(prev => [...prev, replaceResult.new_word!]);
      console.log('[Lesson] Word replaced successfully:', replaceResult.new_word.lemma);
    } else if (replaceResult.status === 'no_words_available') {
      console.log('[Lesson] No more words available for replacement');
    }
  } catch (error) {
    console.error('Failed to remove word:', error);
  }
};
```

## Логи

### Успешная замена слова

```
[Word Replace] Replacing word: removed_dictionary_id=xxx, profile_id=xxx
[Word Replace] User has 50 words, searching for new word...
[Word Replace] Found new word: run (xxx)
[Word Replace] New word added to user_words
[Word Replace] Word replacement completed successfully
[Lesson] Word replaced successfully: run
```

### Нет доступных слов

```
[Word Replace] Replacing word: removed_dictionary_id=xxx, profile_id=xxx
[Word Replace] User has 50 words, searching for new word...
[Word Replace] No new words available in dictionary
[Lesson] No more words available for replacement
```

## Тестирование

### Тест 1: Успешная замена

1. Начните новый урок
2. На странице "Новые слова" нажмите кнопку удаления на слове
3. Проверьте логи backend - должно быть `Word replacement completed successfully`
4. Проверьте, что новое слово появилось в списке
5. Проверьте в админке - новое слово должно быть в `user_words` со статусом `active`

### Тест 2: Нет доступных слов

1. Убедитесь, что в словаре мало слов для уровня пользователя
2. Начните новый урок
3. Удаляйте слова, пока не закончатся новые слова в словаре
4. Проверьте логи - должно быть `No new words available in dictionary`
5. Проверьте, что новое слово не появилось в списке

### Тест 3: Проверка количества слов

1. Начните новый урок с лимитом 7 слов
2. Удалите 2 слова
3. Проверьте, что в списке осталось 7 слов (5 оставшихся + 2 новых)
4. Проверьте в логах, что оба раза вызывался `replace_word`

## Проверка в базе данных

```sql
-- Проверить, что удалённое слово помечено как выученное
SELECT * FROM user_words 
WHERE dictionary_id = 'removed_word_id' 
AND user_language_profile_id = 'profile_id';
-- Должно быть: status = 'learned', stage = 10

-- Проверить, что новое слово добавлено
SELECT * FROM user_words 
WHERE dictionary_id = 'new_word_id' 
AND user_language_profile_id = 'profile_id';
-- Должно быть: status = 'active', stage = 0
```

## Преимущества

✅ **Поддержание количества слов** - в уроке всегда требуемое количество слов  
✅ **Автоматизация** - пользователю не нужно вручную добавлять слова  
✅ **Персонализация** - новые слова подбираются по уровню пользователя  
✅ **Эффективность** - используется существующая логика `get_new_words`  
✅ **Прозрачность** - в логах виден весь процесс замены  

## Ограничения

- Если в словаре закончились новые слова для уровня пользователя, замена не произойдёт
- Новое слово не добавляется в текущий урок (урок уже создан), но будет доступно в следующих уроках
- Замена происходит только на странице "Новые слова", не в основном уроке

## Заключение

Функция замены слов автоматически поддерживает требуемое количество слов в уроке. Когда пользователь помечает слово как выученное, система находит и добавляет новое слово из словаря, обеспечивая непрерывность процесса обучения.
