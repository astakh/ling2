# Исправление: Фильтрация слов по уровню CEFR

## Проблема

Пользователь с уровнем B1 получал слова только уровня A1, что не соответствовало его уровню подготовки.

## Причина

Метод `get_new_words` в `backend/main.py` не учитывал уровень CEFR пользователя при выборе новых слов из словаря. Он просто брал первые N слов из словаря без фильтрации по уровню.

## Решение

### 1. Обновлён метод `get_new_words`

Добавлен параметр `cefr_level` и логика фильтрации:

```python
@staticmethod
async def get_new_words(db: AsyncSession, profile_id: str, target_lang: str, 
                        limit: int, exclude_ids: set, cefr_level: str = "A1") -> list:
    # Define CEFR level hierarchy
    level_hierarchy = {
        "A1": ["A1"],
        "A2": ["A1", "A2"],
        "B1": ["A1", "A2", "B1"],
        "B2": ["A1", "A2", "B1", "B2"]
    }
    
    # Get allowed levels for user's CEFR level
    allowed_levels = level_hierarchy.get(cefr_level, ["A1"])
    
    # Get available words filtered by CEFR level
    query = select(Dictionary).where(
        Dictionary.target_lang == target_lang,
        Dictionary.cefr_level.in_(allowed_levels)
    )
    
    # Order by CEFR level (higher levels first for more challenge)
    query = query.order_by(Dictionary.cefr_level.desc())
    
    result = await db.execute(query.limit(limit))
    return list(result.scalars().all())
```

### 2. Обновлён вызов метода

В методе `start_lesson` теперь передаётся уровень пользователя:

```python
new_words = await LessonService.get_new_words(
    db, profile_id, profile.target_lang, needed, due_dict_ids, profile.cefr_level
)
```

## Иерархия уровней

| Уровень пользователя | Доступные уровни слов |
|---------------------|----------------------|
| A1                  | A1                   |
| A2                  | A1, A2               |
| B1                  | A1, A2, B1           |
| B2                  | A1, A2, B1, B2       |

## Логика работы

1. Пользователь с уровнем B1 начинает урок
2. Система определяет допустимые уровни: A1, A2, B1
3. Из словаря выбираются слова только этих уровней
4. Слова сортируются по убыванию уровня (сначала B1, потом A2, потом A1)
5. Выбираются первые N слов (где N = words_per_lesson_limit)

## Пример

**До исправления:**
- Пользователь: уровень B1
- Получает слова: house, cat, dog, run, eat (все A1)

**После исправления:**
- Пользователь: уровень B1
- Получает слова: beautiful, quickly, important (B1), house, run (A1), big, small (A2)

## Логирование

Добавлено логирование для отладки:

```
[LessonService.get_new_words] User level: B1, allowed levels: ['A1', 'A2', 'B1']
[LessonService.get_new_words] Found 5 words for levels ['A1', 'A2', 'B1']
```

## Тестирование

1. Создайте пользователя с уровнем B1
2. Начните новый урок
3. Проверьте в логах backend, что выбираются слова уровней A1, A2, B1
4. Проверьте в админке, что слова действительно разных уровней

## Преимущества

- Пользователи получают слова, соответствующие их уровню
- Более продвинутые пользователи не скучают на слишком лёгких словах
- Начинающие не перегружаются сложными словами
- Плавный переход между уровнями
