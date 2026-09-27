# Шпаргалка: Диагностика создания урока

## Быстрая проверка

### 1. Запустите backend
```bash
cd backend
python main.py
```

### 2. Начните урок в браузере
Откройте http://localhost:5173 и нажмите "Начать урок"

### 3. Проверьте логи

Ищите эти строки в логах backend:

## ✅ Успешное создание урока

```
[Lesson Start] === НАЧАЛО СОЗДАНИЯ УРОКА ===
[LessonService] === НАЧАЛО LessonService.start_lesson ===
[LessonService] ✅ Найдено 3 новых слов
[LessonService] ✅ Создано 2 упражнений
[LessonService] ✅ Добавлено слово 'run' в user_words
[LessonService] resumed: False
[Lesson Start] Новых слов для представления: 3
[Lesson Start] Список новых слов:
[Lesson Start]   1. run (verb) → бежать, бегать
```

## ❌ Проблемы и решения

### Проблема 1: Урок возобновляется вместо создания нового

**Симптом:**
```
[LessonService] ⏭️ ВОЗВРАЩАЕМ СУЩЕСТВУЮЩИЙ УРОК (resumed=True)
[Lesson Start] ⏭️ Это ВОЗОБНОВЛЕНИЕ урока - новые слова не собираются
```

**Решение:**
Frontend должен вызывать `startLesson(true)` с параметром `force_new=true`

### Проблема 2: Нет новых слов

**Симптом:**
```
[LessonService.get_new_words] ⚠️ НЕТ НОВЫХ СЛОВ!
[Lesson Start] ❌ НЕТ НОВЫХ СЛОВ ДЛЯ ПРЕДСТАВЛЕНИЯ!
```

**Возможные причины:**
1. Все слова уже изучены
2. Нет слов для указанного языка и уровня
3. Лимит = 0

**Решение:**
```sql
-- Проверьте количество слов в словаре
SELECT COUNT(*) FROM dictionaries WHERE target_lang = 'en';

-- Проверьте количество изученных слов
SELECT COUNT(*) FROM user_words WHERE user_language_profile_id = 'xxx';

-- Импортируйте больше слов
python import_dictionary.py --lang en
```

### Проблема 3: Нет переводов

**Симптом:**
```
[Lesson Start] ⚠️ Нет переводов для слова 'run' на язык 'ru'
```

**Решение:**
```sql
-- Проверьте наличие переводов
SELECT * FROM dictionary_translations 
WHERE dictionary_id = 'xxx' AND lang = 'ru';

-- Добавьте переводы
INSERT INTO dictionary_translations (id, dictionary_id, lang, translations)
VALUES (uuid_generate_v4(), 'xxx', 'ru', '["бежать", "бегать"]');
```

### Проблема 4: Дневной лимит достигнут

**Симптом:**
```
[LessonService] ❌ Дневной лимит достигнут!
```

**Решение:**
Подождите до завтра или увеличьте лимит в профиле пользователя

### Проблема 5: Слова не добавляются в user_words

**Симптом:**
```
[LessonService]   ⏭️ Слово 'run' уже есть в user_words
```

**Решение:**
Это нормально - слово уже изучается. Проверьте, что слово имеет статус 'active'

## Команды для диагностики

### Проверить базу данных

```sql
-- Количество слов в словаре
SELECT target_lang, COUNT(*) FROM dictionaries GROUP BY target_lang;

-- Количество изученных слов
SELECT user_language_profile_id, COUNT(*) FROM user_words GROUP BY user_language_profile_id;

-- Due words для пользователя
SELECT * FROM user_words 
WHERE user_language_profile_id = 'xxx' 
AND status = 'active' 
AND due_lesson_number <= 5;

-- Проверить переводы
SELECT d.lemma, dt.lang, dt.translations 
FROM dictionaries d
LEFT JOIN dictionary_translations dt ON d.id = dt.dictionary_id
WHERE d.target_lang = 'en'
LIMIT 10;
```

### Проверить логи

```bash
# Запустить backend с логированием
cd backend
python main.py

# Искать ошибки
grep "❌" logs.txt

# Искать предупреждения
grep "⚠️" logs.txt

# Искать успешные операции
grep "✅" logs.txt
```

## Чек-лист диагностики

- [ ] Backend запущен
- [ ] Frontend запущен
- [ ] Пользователь зарегистрирован
- [ ] Профиль создан
- [ ] В словаре есть слова для языка пользователя
- [ ] В словаре есть переводы на родной язык пользователя
- [ ] Дневной лимит не превышен
- [ ] Frontend вызывает startLesson с правильными параметрами

## Примеры логов

### Успешное создание урока с новыми словами

```
[LessonService] New words: 3
[LessonService] Добавлено в user_words: 3
[Lesson Start] Новых слов для представления: 3
[Lesson Start]   1. run (verb) → бежать, бегать
[Lesson Start]   2. bush (noun) → куст, кустик
[Lesson Start]   3. hide (verb) → прятать, скрывать
```

### Урок возобновлён (не создаётся новый)

```
[LessonService] ⏭️ ВОЗВРАЩАЕМ СУЩЕСТВУЮЩИЙ УРОК (resumed=True)
[Lesson Start] ⏭️ Это ВОЗОБНОВЛЕНИЕ урока - новые слова не собираются
[Lesson Start] Новых слов для представления: 0
```

### Нет новых слов

```
[LessonService.get_new_words] ⚠️ НЕТ НОВЫХ СЛОВ!
[Lesson Start] ❌ НЕТ НОВЫХ СЛОВ ДЛЯ ПРЕДСТАВЛЕНИЯ!
```

### Нет переводов

```
[Lesson Start] ⚠️ Нет переводов для слова 'run' на язык 'ru'
[Lesson Start] Новых слов для представления: 0
```

## Контакты для поддержки

Если проблема не решена, предоставьте:
1. Полные логи backend (от `[Lesson Start] === НАЧАЛО ===` до `=== КОНЕЦ ===`)
2. Результат SQL запросов к базе данных
3. Скриншот консоли браузера (F12 → Console)
4. Скриншот Network tab с ответом API

## Подробная документация

См. [LESSON_CREATION_LOGGING.md](./LESSON_CREATION_LOGGING.md) для полного описания логирования.
