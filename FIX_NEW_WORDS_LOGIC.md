# Исправление логики представления новых слов

## Проблема

В логе было видно:
```
[LessonService] Due words: 7
[LessonService] New words: 0
[Lesson Start] Новых слов для представления: 7
[Lesson Start] Список новых слов:
[Lesson Start]   1. talented (adjective) → талантливый
[Lesson Start]   2. skilled (adjective) → квалифицированный, умелый
...
```

**Проблема:** На экране "Новые слова для изучения" показывались ВСЕ слова урока (включая due words для повторения), а должны показываться ТОЛЬКО новые слова, которые добавляются в user_words.

## Причина

В endpoint `/api/lesson/start` собиралась информация о ВСЕХ словах из упражнений:
```python
# Get all word IDs from exercises
all_word_ids = set()
for exercise in lesson_data.get("exercises", []):
    all_word_ids.update(exercise.target_word_ids)
```

Это включало и due words (слова для повторения), и new words (новые слова).

## Решение

### 1. Разделение due words и new words в LessonService

В `LessonService.start_lesson` теперь явно разделяются:
- `due_dict_words` - слова для повторения (уже в user_words)
- `new_words` - новые слова (добавляются в user_words)

Возвращается список `new_word_ids` - только ID новых слов:
```python
new_word_ids = [w.id for w in new_words]

return {
    "lesson": lesson, 
    "exercises": exercises, 
    "resumed": False,
    "new_word_ids": new_word_ids,  # Только ID новых слов
    "dictionary_exhausted": dictionary_exhausted  # Флаг: словарь исчерпан
}
```

### 2. Использование new_word_ids в /api/lesson/start

Теперь endpoint использует только `new_word_ids` для сбора информации о новых словах:
```python
# Get new_word_ids from LessonService (только ID новых слов, не due words)
new_word_ids = lesson_data.get("new_word_ids", []) if lesson_data else []

# Get dictionary entries for NEW words only
result = await db.execute(
    select(Dictionary).where(Dictionary.id.in_(new_word_ids))
)
```

### 3. Обработка исчерпания словаря

Добавлен флаг `dictionary_exhausted`, который устанавливается, если не удалось найти достаточно новых слов:
```python
if len(new_words) < needed:
    dictionary_exhausted = True
    logger.warning(f"[LessonService] ⚠️ Словарь исчерпан! Запрошено {needed}, найдено только {len(new_words)}")
```

### 4. Уведомление пользователя на frontend

Если `dictionary_exhausted = true`, показывается toast уведомление:
```typescript
if (session.dictionary_exhausted) {
  console.warn('[Lesson] Dictionary exhausted - no new words available');
  setToast({ 
    message: 'Все слова для вашего уровня уже добавлены в изучение. Урок будет состоять только из повторения.', 
    type: 'info' 
  });
}
```

## Логика работы

### Сценарий 1: Есть due words и new words

```
words_per_lesson_limit = 7
due words = 3
needed = 4
new words = 4

Итого: 7 слов (3 due + 4 new)
На экране "Новые слова": показываются 4 новых слова
```

### Сценарий 2: Только due words

```
words_per_lesson_limit = 7
due words = 7
needed = 0
new words = 0

Итого: 7 слов (все due)
На экране "Новые слова": экран не показывается
```

### Сценарий 3: Словарь исчерпан

```
words_per_lesson_limit = 7
due words = 3
needed = 4
new words = 2 (найдено только 2 из 4)
dictionary_exhausted = true

Итого: 5 слов (3 due + 2 new)
На экране "Новые слова": показываются 2 новых слова
Toast уведомление: "Все слова для вашего уровня уже добавлены в изучение..."
```

## Логи

### Успешное создание урока с новыми словами

```
[LessonService] Due words: 3
[LessonService] New words: 4
[LessonService] dictionary_exhausted: False
[Lesson Start] New word IDs from LessonService: 4
[Lesson Start] Новых слов для представления: 4
[Lesson Start] Список новых слов:
[Lesson Start]   1. run (verb) → бежать, бегать
[Lesson Start]   2. bush (noun) → куст, кустик
[Lesson Start]   3. hide (verb) → прятать, скрывать
[Lesson Start]   4. fence (noun) → забор, ограждение
```

### Урок только с повторением

```
[LessonService] Due words: 7
[LessonService] New words: 0
[LessonService] dictionary_exhausted: False
[Lesson Start] New word IDs from LessonService: 0
[Lesson Start] ℹ️ Нет новых слов для представления (все слова уже изучаются)
[Lesson Start] ℹ️ Экран 'Новые слова' не будет показан
```

### Словарь исчерпан

```
[LessonService] Due words: 3
[LessonService] New words: 2
[LessonService] ⚠️ Словарь исчерпан! Запрошено 4, найдено только 2
[LessonService] ⚠️ Все слова для языка 'en' и уровня 'B1' уже изучаются
[LessonService] dictionary_exhausted: True
[Lesson Start] Новых слов для представления: 2
[Lesson Start] ⚠️ Словарь исчерпан для языка 'en' и уровня 'B1'
[Lesson Start] ⚠️ Пользователю будет показано сообщение об этом
```

## Frontend изменения

### Lesson.tsx

1. Добавлено состояние для toast уведомлений:
```typescript
const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
```

2. Обновлена функция `setupLesson`:
```typescript
const setupLesson = (session: any) => {
  // Проверяем, исчерпан ли словарь
  if (session.dictionary_exhausted) {
    console.warn('[Lesson] Dictionary exhausted - no new words available');
    setToast({ 
      message: 'Все слова для вашего уровня уже добавлены в изучение. Урок будет состоять только из повторения.', 
      type: 'info' 
    });
  }
  
  // Show new words if this is a new lesson (not resumed) AND there are new words
  if (session.newWords && session.newWords.length > 0 && !session.resumed) {
    setNewWords(session.newWords);
    setShowNewWords(true);
  } else {
    setInitialized(true);
  }
};
```

3. Добавлен Toast компонент в рендер:
```tsx
<AnimatePresence>
  {toast && (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(null)}
    />
  )}
</AnimatePresence>
```

## Преимущества

✅ **Правильное разделение** - due words и new words больше не путаются  
✅ **Чёткая логика** - на экране "Новые слова" показываются только новые слова  
✅ **Обработка исчерпания** - пользователь получает уведомление, если словарь исчерпан  
✅ **Прозрачность** - в логах видно, сколько due words и new words  
✅ **Улучшенный UX** - пользователь понимает, что происходит  

## Тестирование

### Тест 1: Урок с новыми словами

1. Убедитесь, что у пользователя есть due words и есть новые слова в словаре
2. Начните новый урок
3. Проверьте логи - должно быть `dictionary_exhausted: False`
4. Проверьте, что на экране "Новые слова" показываются только новые слова

### Тест 2: Урок только с повторением

1. Убедитесь, что у пользователя много due words (больше или равно лимиту)
2. Начните новый урок
3. Проверьте логи - должно быть `New words: 0`
4. Проверьте, что экран "Новые слова" не показывается

### Тест 3: Словарь исчерпан

1. Убедитесь, что в словаре мало слов для уровня пользователя
2. Начните новый урок
3. Проверьте логи - должно быть `dictionary_exhausted: True`
4. Проверьте, что появляется toast уведомление
5. Проверьте, что на экране "Новые слова" показываются только найденные новые слова

## Заключение

Проблема с неправильным представлением слов решена. Теперь:
- На экране "Новые слова" показываются ТОЛЬКО новые слова
- Due words (слова для повторения) не включаются в этот список
- Пользователь получает уведомление, если словарь исчерпан
- Логика работы прозрачна и понятна из логов
