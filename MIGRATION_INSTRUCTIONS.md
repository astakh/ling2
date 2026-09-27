# Инструкция по миграции базы данных

## Обзор

Для поддержки специализированных словарей необходимо выполнить миграцию базы данных. Эта миграция добавляет:
- Поле `category` в таблицу `dictionaries`
- Поле `dictionary_category` в таблицу `user_language_profiles`
- Новую таблицу `dictionary_categories`
- Начальные категории словарей (general, IT, business)

## Предварительные требования

- PostgreSQL 14+
- Доступ к базе данных с правами на создание таблиц и изменение структуры
- Резервная копия базы данных (рекомендуется)

## Шаг 1: Создание резервной копии

**ВАЖНО:** Перед выполнением миграции создайте резервную копию базы данных!

```bash
# Для Linux/Mac
pg_dump -h your-server-ip -U lingoflow -d lingoflow > backup_before_migration.sql

# Для Windows (PowerShell)
pg_dump -h your-server-ip -U lingoflow -d lingoflow > backup_before_migration.sql
```

## Шаг 2: Выполнение миграции

### Вариант A: Автоматическая миграция (рекомендуется)

```bash
cd backend
psql -h your-server-ip -U lingoflow -d lingoflow -f migrations/add_dictionary_categories.sql
```

### Вариант B: Ручная миграция

Если автоматическая миграция не работает, выполните следующие SQL команды вручную:

```sql
-- 1. Добавление поля category в таблицу dictionaries
ALTER TABLE dictionaries 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';

-- 2. Создание индексов
CREATE INDEX IF NOT EXISTS ix_dict_category ON dictionaries(category);
CREATE INDEX IF NOT EXISTS ix_dict_lang_category ON dictionaries(target_lang, category);

-- 3. Добавление поля dictionary_category в таблицу user_language_profiles
ALTER TABLE user_language_profiles 
ADD COLUMN IF NOT EXISTS dictionary_category VARCHAR(50) DEFAULT 'general';

-- 4. Создание таблицы dictionary_categories
CREATE TABLE IF NOT EXISTS dictionary_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    target_langs JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Добавление начальных категорий
INSERT INTO dictionary_categories (id, name, description, icon, target_langs) VALUES
('general', 'Общий словарь', 'Базовые слова для повседневного общения', '📚', '["en", "de", "es", "fr"]'),
('it', 'IT и программирование', 'Термины из сферы информационных технологий', '💻', '["en"]'),
('business', 'Бизнес', 'Деловая лексика и бизнес-термины', '💼', '["en"]')
ON CONFLICT (id) DO NOTHING;

-- 6. Обновление уникального индекса
DROP INDEX IF EXISTS uq_dict_lemma_pos_lang;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dict_lemma_pos_lang_category 
ON dictionaries(lemma, pos, target_lang, category);

-- 7. Обновление существующих записей
UPDATE dictionaries SET category = 'general' WHERE category IS NULL;
UPDATE user_language_profiles SET dictionary_category = 'general' WHERE dictionary_category IS NULL;
```

## Шаг 3: Проверка миграции

Выполните следующие SQL запросы для проверки:

```sql
-- Проверка поля category в dictionaries
SELECT category, COUNT(*) as count 
FROM dictionaries 
GROUP BY category;

-- Ожидаемый результат:
-- category  | count
-- ----------+-------
-- general   | <ваше количество слов>

-- Проверка поля dictionary_category в user_language_profiles
SELECT dictionary_category, COUNT(*) as count 
FROM user_language_profiles 
GROUP BY dictionary_category;

-- Ожидаемый результат:
-- dictionary_category | count
-- --------------------+-------
-- general             | <количество профилей>

-- Проверка таблицы dictionary_categories
SELECT id, name, icon, target_langs 
FROM dictionary_categories;

-- Ожидаемый результат:
-- id        | name                  | icon | target_langs
-- ----------+-----------------------+------+------------------
-- general   | Общий словарь         | 📚   | ["en", "de", "es", "fr"]
-- it        | IT и программирование | 💻   | ["en"]
-- business  | Бизнес                | 💼   | ["en"]
```

## Шаг 4: Перезапуск backend

После успешной миграции перезапустите backend:

```bash
cd backend
# Остановите текущий процесс (Ctrl+C)
python main.py
```

## Шаг 5: Проверка API

Проверьте новые эндпоинты:

```bash
# Получить список категорий для английского языка
curl http://localhost:8000/api/dictionary-categories?target_lang=en

# Ожидаемый ответ:
{
  "categories": [
    {
      "id": "general",
      "name": "Общий словарь",
      "description": "Базовые слова для повседневного общения",
      "icon": "📚",
      "target_langs": ["en", "de", "es", "fr"],
      "word_count": <количество слов>
    },
    {
      "id": "it",
      "name": "IT и программирование",
      "description": "Термины из сферы информационных технологий",
      "icon": "💻",
      "target_langs": ["en"],
      "word_count": 0
    },
    {
      "id": "business",
      "name": "Бизнес",
      "description": "Деловая лексика и бизнес-термины",
      "icon": "💼",
      "target_langs": ["en"],
      "word_count": 0
    }
  ]
}
```

## Откат миграции (если что-то пошло не так)

Если нужно откатить миграцию:

```sql
-- 1. Удаление новых индексов
DROP INDEX IF EXISTS ix_dict_category;
DROP INDEX IF EXISTS ix_dict_lang_category;
DROP INDEX IF EXISTS uq_dict_lemma_pos_lang_category;

-- 2. Восстановление старого уникального индекса
CREATE UNIQUE INDEX IF NOT EXISTS uq_dict_lemma_pos_lang 
ON dictionaries(lemma, pos, target_lang);

-- 3. Удаление новых полей
ALTER TABLE dictionaries DROP COLUMN IF EXISTS category;
ALTER TABLE user_language_profiles DROP COLUMN IF EXISTS dictionary_category;

-- 4. Удаление таблицы категорий
DROP TABLE IF EXISTS dictionary_categories;
```

## Решение проблем

### Проблема: Ошибка "column category does not exist"

**Решение:** Убедитесь, что миграция выполнена успешно. Проверьте наличие поля:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'dictionaries' AND column_name = 'category';
```

### Проблема: Ошибка "relation dictionary_categories does not exist"

**Решение:** Таблица не была создана. Выполните миграцию заново.

### Проблема: Категории не отображаются в API

**Решение:** Проверьте, что начальные данные добавлены:

```sql
SELECT COUNT(*) FROM dictionary_categories;
-- Должно быть 3
```

Если 0, выполните INSERT заново.

## Следующие шаги

После успешной миграции:

1. **Импорт специализированных слов** - используйте скрипт `import_dictionary.py` с параметром `--category`
2. **Обновление frontend** - реализуйте новые страницы согласно архитектуре
3. **Тестирование** - проверьте все новые функции

## Поддержка

Если возникли проблемы:
1. Проверьте логи backend
2. Проверьте логи PostgreSQL
3. Обратитесь к документации `MULTILANGUAGE_ARCHITECTURE.md`
