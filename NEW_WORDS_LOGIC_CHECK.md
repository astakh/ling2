# Логика представления новых слов в начале урока

## Обзор

При начале нового урока пользователю показываются все новые слова для изучения с их переводами. Это помогает пользователю запомнить слова перед началом упражнений.

## Как работает

### Backend

1. При вызове `POST /api/lesson/start` backend:
   - Создаёт новый урок (или возобновляет существующий)
   - Собирает все ID слов из упражнений урока
   - Загружает эти слова из таблицы `dictionaries`
   - **Загружает переводы на родной язык пользователя** из таблицы `dictionary_translations`
   - Возвращает список новых слов в поле `new_words`

2. Формат ответа:
```json
{
  "lesson": {...},
  "exercises": [...],
  "resumed": false,
  "new_words": [
    {
      "id": "uuid",
      "lemma": "run",
      "pos": "verb",
      "translations": ["бежать", "бегать"]
    },
    {
      "id": "uuid",
      "lemma": "bush",
      "pos": "noun",
      "translations": ["куст", "кустик"]
    }
  ]
}
```

3. Если урок возобновлён (`resumed: true`), список `new_words` будет пустым.

### Frontend

1. Компонент `Lesson.tsx`:
   - При загрузке урока проверяет наличие `newWords` и `resumed`
   - Если есть новые слова и урок не возобновлён, показывает экран с новыми словами
   - Пользователь может изучить слова и нажать "Начать урок"
   - После нажатия кнопки показывается основной экран урока

2. UI экрана новых слов:
   - Заголовок "Новые слова для изучения"
   - Подзаголовок "Запомни эти слова перед началом урока"
   - Список слов с анимацией появления
   - Каждое слово показывает:
     - Лемму (начальную форму)
     - Часть речи
     - Переводы на родной язык пользователя
   - Кнопка "Начать урок →"

## Исправленная проблема

### Проблема
В коде backend использовался `profile.target_lang` (язык изучения, например "en") для получения переводов, но нужно использовать `user.native_lang` (родной язык пользователя, например "ru").

### Решение
Добавлен запрос пользователя и используется `user.native_lang` для получения переводов:

```python
# Get user to find native_lang
result = await db.execute(
    select(User).where(User.id == profile.user_id)
)
user = result.scalar_one_or_none()

# Get translations for these words (in user's native language)
for word in words:
    result = await db.execute(
        select(DictionaryTranslation).where(
            DictionaryTranslation.dictionary_id == word.id,
            DictionaryTranslation.lang == user.native_lang  # Исправлено!
        )
    )
```

## Пример работы

### Сценарий 1: Новый урок

1. Пользователь нажимает "Начать урок" на Dashboard
2. Backend создаёт новый урок с 5 новыми словами
3. Frontend получает список новых слов с переводами на родной язык
4. Показывается экран с новыми словами:
   ```
   📚 Новые слова для изучения
   Запомни эти слова перед началом урока
   
   ┌─────────────────────────────────┐
   │ run                      1      │
   │ verb                            │
   │ бежать, бегать                  │
   └─────────────────────────────────┘
   
   ┌─────────────────────────────────┐
   │ bush                     2      │
   │ noun                            │
   │ куст, кустик                    │
   └─────────────────────────────────┘
   
   ...
   
   [ Начать урок → ]
   ```
5. Пользователь изучает слова
6. Нажимает "Начать урок"
7. Показывается основной экран урока

### Сценарий 2: Возобновление урока

1. Пользователь начал урок, но не завершил
2. Возвращается и нажимает "Начать урок"
3. Backend возвращает `resumed: true` и пустой `new_words`
4. Frontend пропускает экран новых слов
5. Сразу показывается основной экран урока с текущим упражнением

## Технические детали

### Backend (`backend/main.py`)

```python
@app.post("/api/lesson/start")
async def start_lesson(req: StartLessonRequest, db: AsyncSession = Depends(get_db)):
    # ... создание урока ...
    
    # Get user to find native_lang
    result = await db.execute(
        select(User).where(User.id == profile.user_id)
    )
    user = result.scalar_one_or_none()
    
    # Get new words for this lesson
    new_words = []
    if lesson_data and not lesson_data.get("resumed"):
        # Get all word IDs from exercises
        all_word_ids = set()
        for exercise in lesson_data.get("exercises", []):
            all_word_ids.update(exercise.target_word_ids)
        
        # Get dictionary entries for these words
        if all_word_ids:
            result = await db.execute(
                select(Dictionary).where(Dictionary.id.in_(list(all_word_ids)))
            )
            words = result.scalars().all()
            
            # Get translations for these words (in user's native language)
            for word in words:
                result = await db.execute(
                    select(DictionaryTranslation).where(
                        DictionaryTranslation.dictionary_id == word.id,
                        DictionaryTranslation.lang == user.native_lang
                    )
                )
                trans = result.scalar_one_or_none()
                translations = trans.translations if trans and trans.translations else []
                
                new_words.append({
                    "id": word.id,
                    "lemma": word.lemma,
                    "pos": word.pos,
                    "translations": translations
                })
    
    lesson_data["new_words"] = new_words
    return lesson_data
```

### Frontend (`src/pages/Lesson.tsx`)

```typescript
const loadLesson = async () => {
  const session = await startLesson();
  
  // Show new words if this is a new lesson (not resumed)
  if (session.newWords && session.newWords.length > 0 && !session.resumed) {
    setNewWords(session.newWords);
    setShowNewWords(true);
  } else {
    setInitialized(true);
  }
};

// Show new words screen before starting the lesson
if (showNewWords) {
  return (
    <div className="min-h-screen p-4 flex flex-col">
      <div className="max-w-lg mx-auto w-full">
        <motion.div>
          <div className="text-center space-y-2 mb-8">
            <div className="text-6xl">📚</div>
            <h1>Новые слова для изучения</h1>
            <p>Запомни эти слова перед началом урока</p>
          </div>

          <div className="space-y-3">
            {newWords.map((word, index) => (
              <motion.div key={word.id}>
                <div className="text-2xl font-bold">{word.lemma}</div>
                <div className="text-sm text-gray-500">{word.pos}</div>
                <div className="text-lg">{word.translations.join(', ')}</div>
              </motion.div>
            ))}
          </div>

          <button onClick={() => {
            setShowNewWords(false);
            setInitialized(true);
          }}>
            Начать урок →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
```

## Логи для отладки

### Backend

```
[Lesson Start] profile_id=xxx, force_new=true
[Lesson Start] Found profile: user_id=xxx, target_lang=en
[LessonService.start_lesson] user_id=xxx, profile_id=xxx, force_new=true
[LessonService.start_lesson] Profile loaded: target_lang=en, level=B1
[LessonService] Adding 5 new words to user_words
[LessonService] Added word 'run' to user_words
[LessonService] Added word 'bush' to user_words
...
[Lesson Start] Found 5 new words for lesson
```

### Frontend

```
[Lesson] Component mounted
[Lesson] Loading lesson...
[LessonService] startLesson() called, forceNew: false
[LessonService] Profile ID: xxx
[LessonService] Calling API startLesson with forceNew: false
[LessonService] API response: {...}
[Lesson] Session received: {...}
[Lesson] New words to show: [
  {id: "xxx", lemma: "run", pos: "verb", translations: ["бежать", "бегать"]},
  {id: "xxx", lemma: "bush", pos: "noun", translations: ["куст", "кустик"]}
]
[Lesson] Lesson initialized successfully, todayWords: 5
```

## Проверка работы

### Тест 1: Новый урок

1. Перезапустите backend
2. Обновите страницу в браузере
3. Начните новый урок
4. Должен появиться экран с новыми словами
5. Проверьте, что переводы отображаются на родном языке пользователя
6. Нажмите "Начать урок"
7. Должен появиться основной экран урока

### Тест 2: Возобновление урока

1. Начните урок, но не завершайте
2. Вернитесь на Dashboard
3. Нажмите "Начать урок"
4. Экран новых слов НЕ должен появиться
5. Сразу должен появиться основной экран урока

### Тест 3: Проверка переводов

1. Начните новый урок
2. Проверьте, что переводы отображаются на родном языке пользователя (например, русском)
3. Проверьте в логах backend, что используется `user.native_lang`
4. Проверьте в базе данных, что в таблице `dictionary_translations` есть записи с `lang='ru'`

## Преимущества

✅ **Правильные переводы** - используются переводы на родной язык пользователя  
✅ **Лучшее запоминание** - пользователь видит слова перед упражнениями  
✅ **Меньше стресса** - пользователь знает, что его ждёт  
✅ **Лучший UX** - понятный процесс обучения  
✅ **Анимации** - приятное появление слов  
✅ **Умная логика** - не показывается при возобновлении урока  

## Заключение

Логика представления новых слов работает корректно. Исправлена проблема с получением переводов на неправильный язык. Теперь переводы отображаются на родном языке пользователя, что делает обучение более эффективным и понятным.
