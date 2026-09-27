# Подробное логирование создания урока

## Обзор

Добавлено подробное логирование на всех этапах создания урока, чтобы было понятно:
- Через какие этапы проходит алгоритм
- С каким результатом проходит каждый этап
- Добавлены ли новые слова
- Почему новые слова могут не представляться пользователю

## Уровни логирования

### 1. Endpoint `/api/lesson/start`

**Этапы:**
1. Получение профиля пользователя
2. Вызов LessonService.start_lesson
3. Получение информации о пользователе (native_lang)
4. Сбор новых слов для представления пользователю
5. Финальный итог

**Пример логов:**
```
================================================================================
[Lesson Start] === НАЧАЛО СОЗДАНИЯ УРОКА ===
[Lesson Start] profile_id=xxx, force_new=true
[Lesson Start] Этап 1: Получение профиля пользователя...
[Lesson Start] ✅ Профиль найден: user_id=xxx, target_lang=en, cefr_level=B1
[Lesson Start] Этап 2: Вызов LessonService.start_lesson...
[Lesson Start] ✅ LessonService вернул: resumed=False, lesson_id=xxx
[Lesson Start] Этап 3: Получение информации о пользователе для определения родного языка...
[Lesson Start] ✅ Пользователь найден: native_lang=ru
[Lesson Start] Этап 4: Сбор новых слов для представления пользователю...
[Lesson Start] ✅ Это НОВЫЙ урок (не возобновление), собираем слова...
[Lesson Start] Найдено 5 уникальных ID слов в упражнениях
[Lesson Start] Загрузка словарных записей для этих слов...
[Lesson Start] ✅ Загружено 5 словарных записей
[Lesson Start] Получение переводов на родной язык пользователя (ru)...
[Lesson Start] ✅ Собрано 5 слов с переводами
[Lesson Start] === ИТОГ ===
[Lesson Start] Новых слов для представления: 5
[Lesson Start] Список новых слов:
[Lesson Start]   1. run (verb) → бежать, бегать
[Lesson Start]   2. bush (noun) → куст, кустик
[Lesson Start]   3. hide (verb) → прятать, скрывать
[Lesson Start]   4. fence (noun) → забор, ограждение
[Lesson Start]   5. among (preposition) → среди
================================================================================
```

### 2. LessonService.start_lesson

**Этапы:**
1. Загрузка профиля
2. Проверка существующих уроков
3. Проверка дневного лимита
4. Получение слов для урока (due words)
5. Добавление новых слов
6. Группировка слов
7. Генерация предложений через LLM
8. Создание урока в базе данных
9. Создание упражнений
10. Добавление новых слов в user_words
11. Обновление профиля
12. Финальный итог

**Пример логов:**
```
[LessonService] === НАЧАЛО LessonService.start_lesson ===
[LessonService] Параметры: user_id=xxx, profile_id=xxx, force_new=true
[LessonService] Этап 1: Загрузка профиля...
[LessonService] ✅ Профиль загружен:
[LessonService]   - target_lang: en
[LessonService]   - cefr_level: B1
[LessonService]   - current_lesson_number: 5
[LessonService]   - words_per_lesson_limit: 5
[LessonService]   - daily_lesson_limit: 10
[LessonService] Этап 2: Проверка существующих уроков...
[LessonService] force_new=True - пропускаем проверку существующих уроков
[LessonService] Этап 3: Проверка дневного лимита...
[LessonService] Выполнено уроков сегодня: 2/10
[LessonService] ✅ Дневной лимит не превышен
[LessonService] Этап 4: Получение слов для урока...
[LessonService] Ищем слова для повторения (due words) на уровне 5...
[LessonService] ✅ Найдено 2 слов для повторения
[LessonService] Загружаем словарные записи для due words...
[LessonService] ✅ Загружено 2 словарных записей для due words
[LessonService] Этап 5: Добавление новых слов...
[LessonService] Нужно добавить 3 новых слов (лимит: 5, due words: 2)
[LessonService] Ищем новые слова для языка 'en', уровень 'B1'...
[LessonService] ✅ Найдено 3 новых слов
[LessonService] Список новых слов:
[LessonService]   1. run (verb) - уровень B1
[LessonService]   2. bush (noun) - уровень B1
[LessonService]   3. hide (verb) - уровень B1
[LessonService] Итого слов в уроке: 5 (due: 2, new: 3)
[LessonService] Этап 6: Группировка слов...
[LessonService] ✅ Создано 2 групп слов
[LessonService]   Группа 1: ['among', 'beyond']
[LessonService]   Группа 2: ['run', 'bush', 'hide']
[LessonService] Этап 7: Генерация предложений через LLM...
[LessonService] ✅ Сгенерировано 2 предложений:
[LessonService]   1. The cat ran beyond the fence.
[LessonService]   2. He hid among the bushes.
[LessonService] Этап 8: Создание урока в базе данных...
[LessonService] ✅ Урок создан: id=xxx, номер=6
[LessonService] Этап 9: Создание упражнений...
[LessonService]   Упражнение 1: 2 слов, предложение: The cat ran beyond the fenc...
[LessonService]   Упражнение 2: 3 слов, предложение: He hid among the bushes....
[LessonService] ✅ Создано 2 упражнений
[LessonService] Этап 10: Добавление новых слов в user_words...
[LessonService]   ✅ Добавлено слово 'run' в user_words
[LessonService]   ✅ Добавлено слово 'bush' в user_words
[LessonService]   ✅ Добавлено слово 'hide' в user_words
[LessonService] Итого добавлено в user_words: 3 из 3
[LessonService] Этап 11: Обновление профиля...
[LessonService] ✅ current_lesson_number обновлён на 6
[LessonService] === ИТОГ ===
[LessonService] Урок создан: xxx
[LessonService] Номер урока: 6
[LessonService] Упражнений: 2
[LessonService] Всего слов: 5
[LessonService] Due words: 2
[LessonService] New words: 3
[LessonService] Добавлено в user_words: 3
[LessonService] resumed: False
[LessonService] === КОНЕЦ LessonService.start_lesson ===
```

### 3. LessonService.get_due_words

**Пример логов:**
```
[LessonService.get_due_words] Поиск слов для повторения...
[LessonService.get_due_words] Параметры:
[LessonService.get_due_words]   - profile_id: xxx
[LessonService.get_due_words]   - current_lesson: 5
[LessonService.get_due_words] ✅ Найдено 2 слов для повторения
[LessonService.get_due_words] Список due words:
[LessonService.get_due_words]   1. dictionary_id=xxx, stage=3, due_lesson=5
[LessonService.get_due_words]   2. dictionary_id=xxx, stage=2, due_lesson=4
```

### 4. LessonService.get_new_words

**Пример логов:**
```
[LessonService.get_new_words] === Начало поиска новых слов ===
[LessonService.get_new_words] Параметры:
[LessonService.get_new_words]   - profile_id: xxx
[LessonService.get_new_words]   - target_lang: en
[LessonService.get_new_words]   - limit: 3
[LessonService.get_new_words]   - exclude_ids: 2 слов
[LessonService.get_new_words]   - cefr_level: B1
[LessonService.get_new_words] Получаем список уже изученных слов...
[LessonService.get_new_words] ✅ Найдено 50 уже изученных слов (включая exclude_ids)
[LessonService.get_new_words] Уровень пользователя: B1
[LessonService.get_new_words] Разрешённые уровни слов: ['A1', 'A2', 'B1']
[LessonService.get_new_words] Ищем слова в словаре...
[LessonService.get_new_words]   - Язык: en
[LessonService.get_new_words]   - Уровни: ['A1', 'A2', 'B1']
[LessonService.get_new_words]   - Исключаем: 50 слов
[LessonService.get_new_words]   - Лимит: 3
[LessonService.get_new_words] ✅ Найдено 3 новых слов
[LessonService.get_new_words] Список найденных слов:
[LessonService.get_new_words]   1. run (verb) - уровень B1
[LessonService.get_new_words]   2. bush (noun) - уровень B1
[LessonService.get_new_words]   3. hide (verb) - уровень B1
[LessonService.get_new_words] === Конец поиска новых слов ===
```

## Диагностика проблем

### Проблема 1: Новые слова не представляются пользователю

**Возможные причины:**

1. **Урок возобновлён (resumed=True)**
   ```
   [Lesson Start] ⏭️ Это ВОЗОБНОВЛЕНИЕ урока - новые слова не собираются
   ```
   **Решение:** Использовать `force_new=True` при вызове `startLesson()`

2. **Нет новых слов в упражнениях**
   ```
   [Lesson Start] ⚠️ Нет ID слов в упражнениях
   ```
   **Решение:** Проверить, что упражнения созданы правильно

3. **Нет переводов на родной язык**
   ```
   [Lesson Start] ⚠️ Нет переводов для слова 'run' на язык 'ru'
   ```
   **Решение:** Добавить переводы в таблицу `dictionary_translations`

4. **lesson_data пустой**
   ```
   [Lesson Start] ⚠️ lesson_data пустой или None
   ```
   **Решение:** Проверить логи LessonService

### Проблема 2: Не находятся новые слова

**Возможные причины:**

1. **Все слова уже изучены**
   ```
   [LessonService.get_new_words] ⚠️ НЕТ НОВЫХ СЛОВ!
   [LessonService.get_new_words] Возможные причины:
   [LessonService.get_new_words]   1. Все слова уже изучены
   ```
   **Решение:** Импортировать больше слов в словарь

2. **Нет слов для указанного языка и уровня**
   ```
   [LessonService.get_new_words]   2. Нет слов для указанного языка и уровня
   ```
   **Решение:** Проверить, что в таблице `dictionaries` есть слова для языка и уровня

3. **Лимит = 0**
   ```
   [LessonService.get_new_words] ⏭️ limit=0, не нужно искать новые слова
   ```
   **Решение:** Увеличить `words_per_lesson_limit` в профиле

### Проблема 3: Слова не добавляются в user_words

**Возможные причины:**

1. **Слово уже есть в user_words**
   ```
   [LessonService]   ⏭️ Слово 'run' уже есть в user_words
   ```
   **Решение:** Это нормально, слово уже изучается

2. **Ошибка при добавлении**
   ```
   [LessonService] ❌ Ошибка при добавлении слова 'run' в user_words
   ```
   **Решение:** Проверить логи ошибок

## Как использовать логи для отладки

### Шаг 1: Запустите backend с логированием

```bash
cd backend
python main.py
```

### Шаг 2: Начните новый урок в браузере

Откройте http://localhost:5173 и нажмите "Начать урок"

### Шаг 3: Проанализируйте логи

Ищите следующие паттерны:

**Успешное создание урока с новыми словами:**
```
[LessonService] New words: 3
[LessonService] Добавлено в user_words: 3
[Lesson Start] Новых слов для представления: 3
[Lesson Start] Список новых слов:
[Lesson Start]   1. run (verb) → бежать, бегать
```

**Проблема: урок возобновлён**
```
[LessonService] ⏭️ ВОЗВРАЩАЕМ СУЩЕСТВУЮЩИЙ УРОК (resumed=True)
[Lesson Start] ⏭️ Это ВОЗОБНОВЛЕНИЕ урока - новые слова не собираются
```

**Проблема: нет новых слов**
```
[LessonService.get_new_words] ⚠️ НЕТ НОВЫХ СЛОВ!
[Lesson Start] ❌ НЕТ НОВЫХ СЛОВ ДЛЯ ПРЕДСТАВЛЕНИЯ!
```

**Проблема: нет переводов**
```
[Lesson Start] ⚠️ Нет переводов для слова 'run' на язык 'ru'
```

### Шаг 4: Проверьте базу данных

```sql
-- Проверьте, есть ли слова в словаре
SELECT COUNT(*) FROM dictionaries WHERE target_lang = 'en';

-- Проверьте, есть ли переводы
SELECT COUNT(*) FROM dictionary_translations WHERE lang = 'ru';

-- Проверьте, есть ли слова в user_words
SELECT COUNT(*) FROM user_words WHERE user_language_profile_id = 'xxx';

-- Проверьте due words
SELECT * FROM user_words 
WHERE user_language_profile_id = 'xxx' 
AND status = 'active' 
AND due_lesson_number <= 5;
```

## Пример полного лога успешного создания урока

```
================================================================================
[Lesson Start] === НАЧАЛО СОЗДАНИЯ УРОКА ===
[Lesson Start] profile_id=xxx, force_new=true
[Lesson Start] Этап 1: Получение профиля пользователя...
[Lesson Start] ✅ Профиль найден: user_id=xxx, target_lang=en, cefr_level=B1
[Lesson Start] Этап 2: Вызов LessonService.start_lesson...
[LessonService] === НАЧАЛО LessonService.start_lesson ===
[LessonService] Параметры: user_id=xxx, profile_id=xxx, force_new=true
[LessonService] Этап 1: Загрузка профиля...
[LessonService] ✅ Профиль загружен: target_lang=en, cefr_level=B1
[LessonService] Этап 2: Проверка существующих уроков...
[LessonService] force_new=True - пропускаем проверку существующих уроков
[LessonService] Этап 3: Проверка дневного лимита...
[LessonService] ✅ Дневной лимит не превышен
[LessonService] Этап 4: Получение слов для урока...
[LessonService.get_due_words] Поиск слов для повторения...
[LessonService.get_due_words] ✅ Найдено 2 слов для повторения
[LessonService] ✅ Найдено 2 слов для повторения
[LessonService] Этап 5: Добавление новых слов...
[LessonService] Нужно добавить 3 новых слов (лимит: 5, due words: 2)
[LessonService.get_new_words] === Начало поиска новых слов ===
[LessonService.get_new_words] ✅ Найдено 3 новых слов
[LessonService] ✅ Найдено 3 новых слов
[LessonService] Итого слов в уроке: 5 (due: 2, new: 3)
[LessonService] Этап 6: Группировка слов...
[LessonService] ✅ Создано 2 групп слов
[LessonService] Этап 7: Генерация предложений через LLM...
[LessonService] ✅ Сгенерировано 2 предложений
[LessonService] Этап 8: Создание урока в базе данных...
[LessonService] ✅ Урок создан: id=xxx, номер=6
[LessonService] Этап 9: Создание упражнений...
[LessonService] ✅ Создано 2 упражнений
[LessonService] Этап 10: Добавление новых слов в user_words...
[LessonService]   ✅ Добавлено слово 'run' в user_words
[LessonService]   ✅ Добавлено слово 'bush' в user_words
[LessonService]   ✅ Добавлено слово 'hide' в user_words
[LessonService] Итого добавлено в user_words: 3 из 3
[LessonService] Этап 11: Обновление профиля...
[LessonService] ✅ current_lesson_number обновлён на 6
[LessonService] === ИТОГ ===
[LessonService] Урок создан: xxx, Номер урока: 6, Упражнений: 2
[LessonService] Всего слов: 5, Due words: 2, New words: 3
[LessonService] Добавлено в user_words: 3, resumed: False
[LessonService] === КОНЕЦ LessonService.start_lesson ===
[Lesson Start] ✅ LessonService вернул: resumed=False, lesson_id=xxx
[Lesson Start] Этап 3: Получение информации о пользователе...
[Lesson Start] ✅ Пользователь найден: native_lang=ru
[Lesson Start] Этап 4: Сбор новых слов для представления пользователю...
[Lesson Start] ✅ Это НОВЫЙ урок (не возобновление), собираем слова...
[Lesson Start] Найдено 5 уникальных ID слов в упражнениях
[Lesson Start] ✅ Загружено 5 словарных записей
[Lesson Start] Получение переводов на родной язык пользователя (ru)...
[Lesson Start] ✅ Собрано 5 слов с переводами
[Lesson Start] === ИТОГ ===
[Lesson Start] Новых слов для представления: 5
[Lesson Start] Список новых слов:
[Lesson Start]   1. among (preposition) → среди
[Lesson Start]   2. beyond (preposition) → за пределами
[Lesson Start]   3. run (verb) → бежать, бегать
[Lesson Start]   4. bush (noun) → куст, кустик
[Lesson Start]   5. hide (verb) → прятать, скрывать
================================================================================
```

## Заключение

Подробное логирование позволяет:
- Отследить каждый этап создания урока
- Понять, почему новые слова не представляются пользователю
- Диагностировать проблемы с базой данных
- Оптимизировать производительность

Используйте логи для отладки и улучшения системы.
