# Мультиязычная система - Реализация

## Обзор

Реализована полная поддержка изучения нескольких языков одновременно с возможностью выбора специализированных словарей.

## Что было реализовано

### 1. Dashboard с карточками языков

**Новый дизайн Dashboard:**
- Отображение всех языков пользователя в виде карточек
- Каждая карточка показывает:
  - Флаг и название языка
  - Уровень CEFR и словарь
  - Статистику (слова, уроки, интенсивность)
  - Кнопку "Начать урок"
- Кнопка "Добавить новый язык" внизу страницы

**Пример:**
```
┌─────────────────────────────────────────┐
│  Привет, Иван! 👋                       │
│  2 языка в изучении                     │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 🇬🇧 English │  │ 🇩🇪 Deutsch │      │
│  │ B1 • 💻 IT  │  │ A2 • 📚 Общий│     │
│  │             │  │             │      │
│  │ 45  12  5   │  │ 20  5   5   │      │
│  │ Слов Ур С/У │  │ Слов Ур С/У │      │
│  │             │  │             │      │
│  │ [Начать]    │  │ [Начать]    │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ➕ Добавить новый язык          │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 2. Страница добавления нового языка

**Мастер из 4 шагов:**

**Шаг 1: Выбор языка**
- 🇬🇧 English
- 🇩🇪 Deutsch
- 🇪🇸 Español
- 🇫🇷 Français

**Шаг 2: Выбор уровня**
- A1 — Beginner
- A2 — Elementary
- B1 — Intermediate
- B2 — Upper-Intermediate

**Шаг 3: Выбор словаря**
- 📚 Общий словарь (166 слов)
- 💻 IT и программирование (5 слов)
- 💼 Бизнес (3 слова)

**Шаг 4: Интенсивность**
- Лёгкая (3 слова за урок)
- Средняя (5 слов за урок)
- Интенсивная (7 слов за урок)
- Максимальная (10 слов за урок)

### 3. Страница конкретного языка

**URL:** `/language/:profileId`

**Содержимое:**
- Заголовок с флагом и названием языка
- Статистика:
  - Всего слов
  - В изучении
  - Выучено
  - Уроков пройдено
- Кнопка "Начать урок"
- Настройки (уровень, слова в уроке, уроков в день, словарь)

### 4. Backend API

**Новые эндпоинты:**

```python
# Получить все профили пользователя
GET /api/user/profiles?user_id={user_id}

# Получить категории словарей для языка
GET /api/dictionary-categories?target_lang={lang}

# Получить статистику по языку
GET /api/language-stats/{profile_id}

# Изменить словарь для профиля
PUT /api/profile/{profile_id}/dictionary
```

**Обновлённые эндпоинты:**

```python
# Создание профиля (добавлено dictionary_category)
POST /api/profile/setup
{
  "user_id": "...",
  "native_lang": "ru",
  "target_lang": "en",
  "cefr_level": "B1",
  "words_per_lesson_limit": 5,
  "dictionary_category": "general"  # НОВОЕ
}
```

### 5. База данных

**Новые поля:**

```sql
-- Таблица dictionaries
ALTER TABLE dictionaries ADD COLUMN category VARCHAR(50) DEFAULT 'general';

-- Таблица user_language_profiles
ALTER TABLE user_language_profiles ADD COLUMN dictionary_category VARCHAR(50) DEFAULT 'general';

-- Новая таблица dictionary_categories
CREATE TABLE dictionary_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    target_langs JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Начальные категории:**
- `general` - Общий словарь (📚)
- `it` - IT и программирование (💻)
- `business` - Бизнес (💼)

## Файлы

### Frontend

- `src/pages/Dashboard.tsx` - обновлён для отображения списка языков
- `src/pages/AddLanguage.tsx` - НОВАЯ страница добавления языка
- `src/pages/LanguagePage.tsx` - НОВАЯ страница конкретного языка
- `src/pages/Lesson.tsx` - обновлён для работы с currentProfileId
- `src/services/api.ts` - добавлены новые функции API
- `src/types.ts` - добавлено поле dictionaryCategory
- `src/App.tsx` - добавлены новые роуты

### Backend

- `backend/main.py` - добавлены новые эндпоинты
- `backend/models.py` - добавлены новые поля и модель DictionaryCategory
- `backend/migrations/add_dictionary_categories.sql` - SQL миграция
- `backend/run_migration.py` - скрипт для запуска миграции

### Документация

- `MULTILANGUAGE_ARCHITECTURE.md` - архитектура системы
- `MIGRATION_INSTRUCTIONS.md` - инструкции по миграции
- `SPECIALIZED_DICTIONARIES_GUIDE.md` - руководство по словарям
- `PROJECT_RESTRUCTURING_SUMMARY.md` - резюме изменений
- `MULTILANGUAGE_IMPLEMENTATION.md` - этот документ

## Как использовать

### 1. Выполнить миграцию БД

```bash
cd backend
python run_migration.py
```

### 2. Перезапустить backend

```bash
python main.py
```

### 3. Обновить страницу в браузере

Нажмите `Ctrl+Shift+R`

### 4. Добавить новый язык

1. На Dashboard нажмите "Добавить новый язык"
2. Выберите язык, уровень, словарь, интенсивность
3. Профиль создан!

### 5. Начать урок

1. На Dashboard нажмите "Начать урок" на карточке языка
2. Или откройте страницу языка и нажмите "Начать урок"

### 6. Импортировать специализированные слова

```bash
# IT-термины
python import_dictionary.py --file it_words.json --lang en --category it

# Бизнес-термины
python import_dictionary.py --file business_words.json --lang en --category business
```

## Пример JSON для импорта IT-слов

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
    }
  ]
}
```

## API примеры

### Получить все профили пользователя

```bash
curl http://localhost:8000/api/user/profiles?user_id=3e935e0a-09e6-41e5-9e61-f31574145664
```

**Ответ:**
```json
{
  "profiles": [
    {
      "id": "9c0da6db-4aa2-4f7f-a0e6-b882ded7f1ee",
      "target_lang": "en",
      "cefr_level": "B1",
      "dictionary_category": "general",
      "dictionary_name": "Общий словарь",
      "dictionary_icon": "📚",
      "words_per_lesson_limit": 5,
      "daily_lesson_limit": 3,
      "current_lesson_number": 32,
      "total_words": 45
    }
  ]
}
```

### Получить категории словарей

```bash
curl http://localhost:8000/api/dictionary-categories?target_lang=en
```

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
    },
    {
      "id": "it",
      "name": "IT и программирование",
      "description": "Термины из сферы информационных технологий",
      "icon": "💻",
      "target_langs": ["en"],
      "word_count": 5
    }
  ]
}
```

### Получить статистику по языку

```bash
curl http://localhost:8000/api/language-stats/9c0da6db-4aa2-4f7f-a0e6-b882ded7f1ee
```

**Ответ:**
```json
{
  "profile_id": "9c0da6db-4aa2-4f7f-a0e6-b882ded7f1ee",
  "target_lang": "en",
  "cefr_level": "B1",
  "dictionary_category": "general",
  "dictionary_name": "Общий словарь",
  "dictionary_icon": "📚",
  "words_per_lesson_limit": 5,
  "daily_lesson_limit": 3,
  "current_lesson_number": 32,
  "active_words": 30,
  "learned_words": 15,
  "total_words": 45,
  "completed_lessons": 32,
  "current_streak": 5,
  "longest_streak": 12
}
```

## Преимущества

✅ **Несколько языков** - пользователь может изучать несколько языков одновременно  
✅ **Специализированные словари** - выбор между general, IT, business  
✅ **Удобный UI** - карточки языков с статистикой  
✅ **Гибкость** - можно менять словарь без потери прогресса  
✅ **Масштабируемость** - легко добавлять новые категории словарей  

## Следующие шаги

1. **Импортировать больше специализированных слов** для каждой категории
2. **Добавить новые категории** (медицина, юриспруденция, путешествия)
3. **Улучшить UI** страницы языка (графики, прогресс)
4. **Добавить экспорт/импорт** профилей
5. **Реализовать синхронизацию** между устройствами

## Заключение

Мультиязычная система полностью реализована и готова к использованию. Пользователи могут:
- Изучать несколько языков одновременно
- Выбирать специализированные словари
- Переключаться между словарями без потери прогресса
- Видеть статистику по каждому языку
- Удобно управлять профилями через Dashboard
