# Руководство по использованию специализированных словарей

## Обзор

После миграции база данных поддерживает специализированные словари. Теперь вы можете:
- Импортировать слова в разные категории (general, IT, business)
- Выбирать словарь при создании профиля языка
- Переключаться между словарями без потери прогресса

## Доступные категории

### 1. Общий словарь (general)
- **Описание:** Базовые слова для повседневного общения
- **Иконка:** 📚
- **Доступные языки:** English, Deutsch, Español, Français
- **Использование:** По умолчанию для всех профилей

### 2. IT и программирование (it)
- **Описание:** Термины из сферы информационных технологий
- **Иконка:** 💻
- **Доступные языки:** English
- **Использование:** Для разработчиков и IT-специалистов

### 3. Бизнес (business)
- **Описание:** Деловая лексика и бизнес-термины
- **Иконка:** 💼
- **Доступные языки:** English
- **Использование:** Для бизнес-коммуникации

## Импорт слов в специализированный словарь

### Пример 1: Импорт IT-терминов

Создайте файл `it_words.json`:

```json
{
  "words": [
    {
      "lemma": "algorithm",
      "pos": "noun",
      "cefr_level": "B1",
      "translations": ["алгоритм"]
    },
    {
      "lemma": "database",
      "pos": "noun",
      "cefr_level": "B1",
      "translations": ["база данных"]
    },
    {
      "lemma": "function",
      "pos": "noun",
      "cefr_level": "A2",
      "translations": ["функция"]
    },
    {
      "lemma": "variable",
      "pos": "noun",
      "cefr_level": "A2",
      "translations": ["переменная"]
    },
    {
      "lemma": "debug",
      "pos": "verb",
      "cefr_level": "B1",
      "translations": ["отлаживать"]
    }
  ]
}
```

Выполните импорт:

```bash
cd backend
python import_dictionary.py --file it_words.json --lang en --category it
```

### Пример 2: Импорт бизнес-терминов

Создайте файл `business_words.json`:

```json
{
  "words": [
    {
      "lemma": "revenue",
      "pos": "noun",
      "cefr_level": "B2",
      "translations": ["выручка", "доход"]
    },
    {
      "lemma": "investment",
      "pos": "noun",
      "cefr_level": "B1",
      "translations": ["инвестиция", "вложение"]
    },
    {
      "lemma": "negotiate",
      "pos": "verb",
      "cefr_level": "B2",
      "translations": ["вести переговоры"]
    }
  ]
}
```

Выполните импорт:

```bash
python import_dictionary.py --file business_words.json --lang en --category business
```

### Пример 3: Смешанный импорт

Если в одном файле есть слова из разных категорий, можно указать категорию для каждого слова:

```json
{
  "words": [
    {
      "lemma": "computer",
      "pos": "noun",
      "cefr_level": "A1",
      "category": "general",
      "translations": ["компьютер"]
    },
    {
      "lemma": "software",
      "pos": "noun",
      "cefr_level": "B1",
      "category": "it",
      "translations": ["программное обеспечение"]
    },
    {
      "lemma": "hardware",
      "pos": "noun",
      "cefr_level": "B1",
      "category": "it",
      "translations": ["аппаратное обеспечение"]
    }
  ]
}
```

Выполните импорт:

```bash
python import_dictionary.py --file mixed_words.json --lang en
```

Категория будет браться из каждого слова индивидуально.

## Проверка импорта

### Через админку

1. Откройте http://localhost:8000/admin
2. Войдите с паролем из `.env`
3. Перейдите в таблицу `dictionaries`
4. Проверьте поле `category` для импортированных слов

### Через SQL

```sql
-- Посмотреть количество слов по категориям
SELECT category, COUNT(*) as count
FROM dictionaries
WHERE target_lang = 'en'
GROUP BY category;

-- Ожидаемый результат:
-- category  | count
-- ----------+-------
-- general   | 166
-- it        | 5
-- business  | 3
```

### Через API

```bash
# Получить список категорий с количеством слов
curl http://localhost:8000/api/dictionary-categories?target_lang=en
```

Ожидаемый ответ:

```json
{
  "categories": [
    {
      "id": "general",
      "name": "Общий словарь",
      "description": "Базовые слова для повседневного общения",
      "icon": "📚",
      "target_langs": ["en", "de", "es", "fr"],
      "word_count": 166
    },
    {
      "id": "it",
      "name": "IT и программирование",
      "description": "Термины из сферы информационных технологий",
      "icon": "💻",
      "target_langs": ["en"],
      "word_count": 5
    },
    {
      "id": "business",
      "name": "Бизнес",
      "description": "Деловая лексика и бизнес-термины",
      "icon": "💼",
      "target_langs": ["en"],
      "word_count": 3
    }
  ]
}
```

## Использование специализированных словарей

### Создание нового профиля с выбором словаря

При создании профиля через API укажите категорию:

```bash
curl -X POST http://localhost:8000/api/profile/setup \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "native_lang": "ru",
    "target_lang": "en",
    "cefr_level": "B1",
    "words_per_lesson_limit": 5,
    "dictionary_category": "it"
  }'
```

### Переключение словаря для существующего профиля

```bash
curl -X PUT http://localhost:8000/api/profile/{profile_id}/dictionary \
  -H "Content-Type: application/json" \
  -d '{
    "category": "business"
  }'
```

**Важно:** Уже изученные слова остаются в профиле. Новые уроки будут использовать слова из новой категории.

## Добавление новых категорий

### Шаг 1: Добавить категорию в БД

```sql
INSERT INTO dictionary_categories (id, name, description, icon, target_langs) VALUES
('medical', 'Медицина', 'Медицинские термины', '🏥', '["en", "ru"]');
```

### Шаг 2: Обновить VALID_CATEGORIES в скрипте импорта

Откройте `backend/import_dictionary.py` и добавьте новую категорию:

```python
VALID_CATEGORIES = ["general", "it", "business", "medical"]
```

### Шаг 3: Импортировать слова

```bash
python import_dictionary.py --file medical_words.json --lang en --category medical
```

## Frontend интеграция

### Страница добавления языка (будет реализована)

```
Шаг 1: Выберите язык
  [🇬🇧 English] [🇩🇪 Deutsch] [🇪🇸 Español] [🇫🇷 Français]

Шаг 2: Выберите уровень
  [A1] [A2] [B1] [B2]

Шаг 3: Выберите словарь
  ┌─────────────────┐  ┌─────────────────┐
  │ 📚 Общий        │  │ 💻 IT           │
  │ 166 слов        │  │ 5 слов          │
  │ Базовые слова   │  │ Термины IT      │
  └─────────────────┘  └─────────────────┘
  
  ┌─────────────────┐
  │ 💼 Бизнес       │
  │ 3 слова         │
  │ Деловая лексика │
  └─────────────────┘

Шаг 4: Настройки
  Слов в уроке: [====●====] 5
  Уроков в день: [==●======] 3
```

### Dashboard (будет реализован)

```
┌─────────────────────────────────────────┐
│  Привет, Иван!                          │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 🇬🇧 English │  │ 🇩🇪 Deutsch │      │
│  │ B1 • IT     │  │ A2 • Общий  │      │
│  │ 45 слов     │  │ 20 слов     │      │
│  │ [Начать]    │  │ [Начать]    │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  [➕ Добавить язык]                     │
└─────────────────────────────────────────┘
```

## Примеры использования

### Сценарий 1: Разработчик изучает английский

1. Создаёт профиль English с категорией "it"
2. Урок содержит IT-термины: algorithm, database, function
3. Пользователь изучает специализированную лексику

### Сценарий 2: Менеджер переключается на бизнес-английский

1. У пользователя профиль English с категорией "general"
2. Изучено 50 слов общего словаря
3. Переключается на категорию "business"
4. Изученные слова остаются
5. Новые уроки содержат бизнес-термины: revenue, investment, negotiate

### Сценарий 3: Пользователь изучает несколько языков

1. Создаёт профиль English с категорией "it"
2. Создаёт профиль Deutsch с категорией "general"
3. Каждый язык имеет свой словарь и настройки
4. Переключение между языками через Dashboard

## Решение проблем

### Проблема: Категория не отображается в API

**Решение:** Проверьте, что категория добавлена в таблицу `dictionary_categories`:

```sql
SELECT * FROM dictionary_categories;
```

### Проблема: Слова не импортируются в категорию

**Решение:** Убедитесь, что:
1. Категория существует в `dictionary_categories`
2. Параметр `--category` указан правильно
3. Категория добавлена в `VALID_CATEGORIES` в скрипте

### Проблема: Переключение словаря не работает

**Решение:** Проверьте:
1. Категория доступна для данного языка (поле `target_langs`)
2. Профиль существует
3. API вызов выполнен правильно

## API Reference

### GET /api/dictionary-categories

Получить список категорий для языка.

**Параметры:**
- `target_lang` (required): код языка (en, de, es, fr)

**Ответ:**
```json
{
  "categories": [
    {
      "id": "general",
      "name": "Общий словарь",
      "description": "Базовые слова для повседневного общения",
      "icon": "📚",
      "target_langs": ["en", "de", "es", "fr"],
      "word_count": 166
    }
  ]
}
```

### PUT /api/profile/{profile_id}/dictionary

Изменить словарь для профиля.

**Тело запроса:**
```json
{
  "category": "it"
}
```

**Ответ:**
```json
{
  "status": "success",
  "old_category": "general",
  "new_category": "it"
}
```

### GET /api/language-stats/{profile_id}

Получить статистику по языку.

**Ответ:**
```json
{
  "profile_id": "...",
  "target_lang": "en",
  "cefr_level": "B1",
  "dictionary_category": "it",
  "dictionary_name": "IT и программирование",
  "dictionary_icon": "💻",
  "words_per_lesson_limit": 5,
  "daily_lesson_limit": 3,
  "current_lesson_number": 10,
  "active_words": 30,
  "learned_words": 15,
  "total_words": 45,
  "completed_lessons": 10,
  "current_streak": 5,
  "longest_streak": 12
}
```

### GET /api/user/profiles

Получить все профили пользователя.

**Параметры:**
- `user_id` (required): ID пользователя

**Ответ:**
```json
{
  "profiles": [
    {
      "id": "...",
      "target_lang": "en",
      "cefr_level": "B1",
      "dictionary_category": "it",
      "dictionary_name": "IT и программирование",
      "dictionary_icon": "💻",
      "words_per_lesson_limit": 5,
      "daily_lesson_limit": 3,
      "current_lesson_number": 10,
      "total_words": 45
    },
    {
      "id": "...",
      "target_lang": "de",
      "cefr_level": "A2",
      "dictionary_category": "general",
      "dictionary_name": "Общий словарь",
      "dictionary_icon": "📚",
      "words_per_lesson_limit": 5,
      "daily_lesson_limit": 3,
      "current_lesson_number": 5,
      "total_words": 20
    }
  ]
}
```

## Заключение

Система специализированных словарей готова к использованию. Вы можете:
- Импортировать слова в разные категории
- Создавать профили с выбором словаря
- Переключаться между словарями
- Изучать несколько языков одновременно

Для полной интеграции необходимо реализовать frontend страницы согласно архитектуре в `MULTILANGUAGE_ARCHITECTURE.md`.
