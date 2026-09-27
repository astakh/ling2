# Исправление логики ограничения due_words

## Проблема

В логе было видно:
```
[LessonService] Нужно добавить 0 новых слов (лимит: 7, due words: 10)
[LessonService] Итого слов в уроке: 10 (due: 10, new: 0)
```

**Проблема:** due_words (10) больше лимита (7), но код не ограничивал due_words до лимита. В результате в уроке оказывалось 10 слов вместо 7, и все они были старыми словами для повторения. Новые слова не добавлялись.

## Решение

Добавлена логика ограничения due_words до лимита перед добавлением новых слов:

```python
# Ограничиваем due_words до лимита
if len(due_dict_words) > profile.words_per_lesson_limit:
    logger.info(f"[LessonService] ⚠️ Due words ({len(due_dict_words)}) больше лимита ({profile.words_per_lesson_limit}), ограничиваем")
    due_dict_words = due_dict_words[:profile.words_per_lesson_limit]
    logger.info(f"[LessonService] ✅ После ограничения: {len(due_dict_words)} due words")

# Fill with new words (filtered by user's CEFR level)
logger.info("[LessonService] Этап 5: Добавление новых слов...")
needed = max(0, profile.words_per_lesson_limit - len(due_dict_words))
logger.info(f"[LessonService] Нужно добавить {needed} новых слов (лимит: {profile.words_per_lesson_limit}, due words: {len(due_dict_words)})")
```

## Новая логика

1. Получаем due_words (слова для повторения)
2. **Если due_words > лимит, ограничиваем до лимита**
3. Если due_words < лимит, добавляем новые слова до лимита

## Примеры

### Сценарий 1: due_words > лимит

**До исправления:**
```
due_words = 10
лимит = 7
needed = max(0, 7 - 10) = 0
Итого: 10 слов (все due_words)
```

**После исправления:**
```
due_words = 10
лимит = 7
Ограничиваем due_words до 7
needed = max(0, 7 - 7) = 0
Итого: 7 слов (все due_words)
```

### Сценарий 2: due_words < лимит

**До и после исправления:**
```
due_words = 3
лимит = 7
needed = max(0, 7 - 3) = 4
Итого: 7 слов (3 due_words + 4 новых)
```

### Сценарий 3: due_words = лимит

**До и после исправления:**
```
due_words = 7
лимит = 7
needed = max(0, 7 - 7) = 0
Итого: 7 слов (все due_words)
```

## Логи

### Успешное ограничение due_words

```
[LessonService] Этап 4: Получение слов для урока...
[LessonService] Ищем слова для повторения (due words) на уровне 27...
[LessonService.get_due_words] ✅ Найдено 10 слов для повторения
[LessonService] ✅ Загружено 10 словарных записей для due words
[LessonService] ⚠️ Due words (10) больше лимита (7), ограничиваем
[LessonService] ✅ После ограничения: 7 due words
[LessonService] Этап 5: Добавление новых слов...
[LessonService] Нужно добавить 0 новых слов (лимит: 7, due words: 7)
[LessonService] ⏭️ Не нужно добавлять новых слов
[LessonService] Итого слов в уроке: 7 (due: 7, new: 0)
```

### Успешное добавление новых слов

```
[LessonService] Этап 4: Получение слов для урока...
[LessonService] Ищем слова для повторения (due words) на уровне 27...
[LessonService.get_due_words] ✅ Найдено 3 слов для повторения
[LessonService] ✅ Загружено 3 словарных записей для due words
[LessonService] Этап 5: Добавление новых слов...
[LessonService] Нужно добавить 4 новых слов (лимит: 7, due words: 3)
[LessonService.get_new_words] ✅ Найдено 4 новых слов
[LessonService] Итого слов в уроке: 7 (due: 3, new: 4)
```

## Преимущества

✅ **Соблюдение лимита** - в уроке всегда ровно words_per_lesson_limit слов  
✅ **Баланс повторения и новых слов** - если есть место, добавляются новые слова  
✅ **Предсказуемость** - пользователь знает, сколько слов будет в уроке  
✅ **Эффективность обучения** - не перегружаем пользователя слишком большим количеством слов  

## Тестирование

### Тест 1: due_words > лимит

1. Убедитесь, что у пользователя много слов для повторения
2. Начните новый урок
3. Проверьте логи - должно быть ограничение due_words
4. Проверьте, что в уроке ровно words_per_lesson_limit слов

### Тест 2: due_words < лимит

1. Убедитесь, что у пользователя мало слов для повторения
2. Начните новый урок
3. Проверьте логи - должны добавиться новые слова
4. Проверьте, что в уроке ровно words_per_lesson_limit слов

### Тест 3: due_words = лимит

1. Убедитесь, что у пользователя ровно words_per_lesson_limit слов для повторения
2. Начните новый урок
3. Проверьте логи - новые слова не добавляются
4. Проверьте, что в уроке ровно words_per_lesson_limit слов

## Заключение

Исправлена логика ограничения due_words до лимита. Теперь в уроке всегда ровно words_per_lesson_limit слов, и новые слова добавляются только если есть место после ограничения due_words.
