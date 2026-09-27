# Функция показа новых слов перед уроком

## Описание

При начале нового урока пользователю показываются все новые слова для изучения с их переводами. Это помогает пользователю запомнить слова перед началом упражнений.

## Как работает

### Backend

1. При вызове `POST /api/lesson/start` backend:
   - Создаёт новый урок (или возобновляет существующий)
   - Собирает все ID слов из упражнений урока
   - Загружает эти слова из таблицы `dictionaries`
   - Загружает переводы из таблицы `dictionary_translations`
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
     - Переводы
   - Кнопка "Начать урок →"

## Пример работы

### Сценарий 1: Новый урок

1. Пользователь нажимает "Начать урок" на Dashboard
2. Backend создаёт новый урок с 5 новыми словами
3. Frontend получает список новых слов
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
            
            # Get translations for these words
            for word in words:
                result = await db.execute(
                    select(DictionaryTranslation).where(
                        DictionaryTranslation.dictionary_id == word.id,
                        DictionaryTranslation.lang == profile.target_lang
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
// Show new words screen before starting the lesson
if (showNewWords) {
  return (
    <div className="min-h-screen p-4 flex flex-col">
      <div className="max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center space-y-2 mb-8">
            <div className="text-6xl">📚</div>
            <h1 className="text-2xl font-bold text-gray-800">Новые слова для изучения</h1>
            <p className="text-gray-500">Запомни эти слова перед началом урока</p>
          </div>

          <div className="space-y-3">
            {newWords.map((word, index) => (
              <motion.div
                key={word.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-indigo-800 mb-2">
                      {word.lemma}
                    </div>
                    <div className="text-sm text-gray-500 mb-2">
                      {word.pos}
                    </div>
                    <div className="text-lg text-gray-700">
                      {word.translations.join(', ')}
                    </div>
                  </div>
                  <div className="text-4xl opacity-20">
                    {index + 1}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => {
              setShowNewWords(false);
              setInitialized(true);
            }}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
          >
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

## Преимущества

✅ **Лучшее запоминание** - пользователь видит слова перед упражнениями  
✅ **Меньше стресса** - пользователь знает, что его ждёт  
✅ **Лучший UX** - понятный процесс обучения  
✅ **Анимации** - приятное появление слов  
✅ **Умная логика** - не показывается при возобновлении урока  

## Тестирование

1. Перезапустите backend
2. Обновите страницу в браузере
3. Начните новый урок
4. Должен появиться экран с новыми словами
5. Изучите слова
6. Нажмите "Начать урок"
7. Должен появиться основной экран урока

## Заключение

Функция показа новых слов перед уроком успешно реализована. Пользователь теперь видит все новые слова с переводами перед началом упражнений, что улучшает процесс обучения и снижает стресс.
