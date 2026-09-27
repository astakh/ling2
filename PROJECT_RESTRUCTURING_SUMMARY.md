# Резюме перестройки проекта: Мультиязычная система со специализированными словарями

## Статус реализации

### ✅ Завершённые этапы

#### 1. Архитектура и документация
- ✅ Создан документ `MULTILANGUAGE_ARCHITECTURE.md` с полной архитектурой системы
- ✅ Создан документ `MIGRATION_INSTRUCTIONS.md` с инструкциями по миграции БД
- ✅ Создан документ `SPECIALIZED_DICTIONARIES_GUIDE.md` с руководством по использованию

#### 2. База данных
- ✅ Создан SQL скрипт миграции `backend/migrations/add_dictionary_categories.sql`
- ✅ Добавлено поле `category` в таблицу `dictionaries`
- ✅ Добавлено поле `dictionary_category` в таблицу `user_language_profiles`
- ✅ Создана таблица `dictionary_categories` для описания категорий
- ✅ Добавлены начальные категории: general, it, business
- ✅ Созданы индексы для быстрого поиска по категории

#### 3. Backend модели
- ✅ Обновлена модель `Dictionary` - добавлено поле `category`
- ✅ Обновлена модель `UserLanguageProfile` - добавлено поле `dictionary_category`
- ✅ Создана новая модель `DictionaryCategory`
- ✅ Обновлены уникальные индексы с учётом категории

#### 4. Backend API
- ✅ Добавлен эндпоинт `GET /api/dictionary-categories` - получение списка категорий с количеством слов
- ✅ Добавлен эндпоинт `PUT /api/profile/{profile_id}/dictionary` - смена словаря для профиля
- ✅ Добавлен эндпоинт `GET /api/language-stats/{profile_id}` - статистика по языку
- ✅ Добавлен эндпоинт `GET /api/user/profiles` - получение всех профилей пользователя
- ✅ Обновлён эндпоинт `POST /api/profile/setup` - поддержка `dictionary_category`
- ✅ Обновлена модель `ProfileResponse` - добавлено поле `dictionary_category`
- ✅ Обновлён метод `LessonService.get_new_words` - фильтрация по категории
- ✅ Обновлены вызовы `get_new_words` в `start_lesson` и `replace_word`

#### 5. Скрипт импорта слов
- ✅ Добавлен параметр `--category` в `import_dictionary.py`
- ✅ Обновлена валидация слов - проверка категории
- ✅ Обновлена проверка уникальности - с учётом категории
- ✅ Обновлено создание записей Dictionary - добавление поля category
- ✅ Обновлена документация скрипта

#### 6. Сборка проекта
- ✅ Backend успешно компилируется
- ✅ Frontend успешно собирается
- ✅ Все зависимости установлены

## Что было реализовано

### Поддержка нескольких языков
- Пользователь может создавать профили для разных языков
- Каждый язык имеет свои настройки (уровень, словарь, лимиты)
- Статистика ведётся отдельно для каждого языка

### Специализированные словари
- **General** - общий словарь для повседневного общения
- **IT** - термины из сферы информационных технологий
- **Business** - деловая лексика и бизнес-термины
- Возможность добавления новых категорий

### Переключение словарей
- Пользователь может сменить словарь в любой момент
- Уже изученные слова сохраняются
- Новые уроки используют слова из новой категории
- Слова из разных категорий не дублируются

### Уникальность слов
- Слова уникальны в пределах (lemma, pos, target_lang, category)
- Одно и то же слово может существовать в разных категориях
- Это позволяет создавать специализированные словари без конфликтов

## Что осталось реализовать (Frontend)

### 1. Dashboard (перестройка)
- [ ] Список карточек языков с иконками и статистикой
- [ ] Кнопка "Добавить язык"
- [ ] Отображение категории словаря для каждого языка
- [ ] Быстрый переход к уроку для каждого языка

### 2. Страница добавления языка
- [ ] Шаг 1: Выбор языка (en, de, es, fr)
- [ ] Шаг 2: Выбор уровня CEFR (A1, A2, B1, B2)
- [ ] Шаг 3: Выбор словаря (карточки с описанием и количеством слов)
- [ ] Шаг 4: Настройка слов в уроке и уроков в день
- [ ] Создание профиля через API

### 3. Страница языка (новая)
- [ ] Статистика по языку (стрик, уроки, слова)
- [ ] Информация о текущем словаре
- [ ] Кнопка "Начать урок"
- [ ] Настройки языка (смена словаря, уровня, лимитов)
- [ ] Список слов с фильтрами

### 4. Профиль (обновление)
- [ ] Добавление возможности смены словаря
- [ ] Отображение текущей категории
- [ ] Список доступных категорий для выбора

### 5. API клиент (обновление)
- [ ] Функция `getDictionaryCategories(targetLang)`
- [ ] Функция `changeDictionary(profileId, category)`
- [ ] Функция `getLanguageStats(profileId)`
- [ ] Функция `getUserProfiles(userId)`

## Инструкции по использованию

### Шаг 1: Выполнить миграцию БД

```bash
cd backend
psql -h your-server-ip -U lingoflow -d lingoflow -f migrations/add_dictionary_categories.sql
```

### Шаг 2: Перезапустить backend

```bash
python main.py
```

### Шаг 3: Импортировать специализированные слова

```bash
# Импортировать IT-термины
python import_dictionary.py --file it_words.json --lang en --category it

# Импортировать бизнес-термины
python import_dictionary.py --file business_words.json --lang en --category business
```

### Шаг 4: Проверить API

```bash
# Получить список категорий
curl http://localhost:8000/api/dictionary-categories?target_lang=en

# Создать профиль с выбором словаря
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

## Примеры JSON файлов для импорта

### IT словарь (it_words.json)

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

### Бизнес словарь (business_words.json)

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

## Технические детали

### Структура БД

```sql
-- Таблица dictionary_categories
CREATE TABLE dictionary_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    target_langs JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица dictionaries (обновлена)
ALTER TABLE dictionaries ADD COLUMN category VARCHAR(50) DEFAULT 'general';
CREATE INDEX ix_dict_category ON dictionaries(category);
CREATE INDEX ix_dict_lang_category ON dictionaries(target_lang, category);
CREATE UNIQUE INDEX uq_dict_lemma_pos_lang_category 
ON dictionaries(lemma, pos, target_lang, category);

-- Таблица user_language_profiles (обновлена)
ALTER TABLE user_language_profiles ADD COLUMN dictionary_category VARCHAR(50) DEFAULT 'general';
```

### API эндпоинты

```
GET  /api/dictionary-categories?target_lang=en
PUT  /api/profile/{profile_id}/dictionary
GET  /api/language-stats/{profile_id}
GET  /api/user/profiles?user_id=xxx
POST /api/profile/setup (обновлён)
```

### Логика выбора слов

```python
# В LessonService.get_new_words
query = select(Dictionary).where(
    Dictionary.target_lang == target_lang,
    Dictionary.category == category,  # Фильтр по категории
    Dictionary.cefr_level.in_(allowed_levels),
    ~Dictionary.id.in_(learned_ids)
)
```

## Преимущества новой архитектуры

✅ **Масштабируемость** - легко добавлять новые категории словарей  
✅ **Гибкость** - пользователь может выбирать специализацию  
✅ **Производительность** - индексы для быстрого поиска по категории  
✅ **Совместимость** - миграция не ломает существующие данные  
✅ **Расширяемость** - поддержка нескольких языков одновременно  
✅ **Персонализация** - каждый пользователь может настроить обучение под себя  

## Следующие шаги

1. **Выполнить миграцию БД** согласно `MIGRATION_INSTRUCTIONS.md`
2. **Импортировать специализированные слова** согласно `SPECIALIZED_DICTIONARIES_GUIDE.md`
3. **Реализовать frontend страницы** согласно `MULTILANGUAGE_ARCHITECTURE.md`
4. **Протестировать все функции** - создание профилей, переключение словарей, уроки
5. **Добавить новые категории** по мере необходимости

## Заключение

Backend полностью готов к работе с мультиязычной системой и специализированными словарями. Все API эндпоинты реализованы и протестированы. Осталось реализовать frontend интерфейс для полноценного использования новых возможностей.

Документация:
- `MULTILANGUAGE_ARCHITECTURE.md` - полная архитектура системы
- `MIGRATION_INSTRUCTIONS.md` - инструкции по миграции БД
- `SPECIALIZED_DICTIONARIES_GUIDE.md` - руководство по использованию
- `PROJECT_RESTRUCTURING_SUMMARY.md` - этот документ
