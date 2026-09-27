-- Миграция: Добавление поддержки специализированных словарей
-- Дата: 2026-09-27
-- Описание: Добавление поля category в таблицу dictionaries и dictionary_category в user_language_profiles

-- Шаг 1: Добавление поля category в таблицу dictionaries
ALTER TABLE dictionaries 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';

-- Шаг 2: Создание индексов для быстрого поиска по категории
CREATE INDEX IF NOT EXISTS ix_dict_category ON dictionaries(category);
CREATE INDEX IF NOT EXISTS ix_dict_lang_category ON dictionaries(target_lang, category);

-- Шаг 3: Добавление поля dictionary_category в таблицу user_language_profiles
ALTER TABLE user_language_profiles 
ADD COLUMN IF NOT EXISTS dictionary_category VARCHAR(50) DEFAULT 'general';

-- Шаг 4: Создание таблицы dictionary_categories для описания категорий
CREATE TABLE IF NOT EXISTS dictionary_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    target_langs JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Шаг 5: Добавление начальных категорий
INSERT INTO dictionary_categories (id, name, description, icon, target_langs) VALUES
('general', 'Общий словарь', 'Базовые слова для повседневного общения', '📚', '["en", "de", "es", "fr"]'),
('it', 'IT и программирование', 'Термины из сферы информационных технологий', '💻', '["en"]'),
('business', 'Бизнес', 'Деловая лексика и бизнес-термины', '💼', '["en"]')
ON CONFLICT (id) DO NOTHING;

-- Шаг 6: Уникальность слов по категории
-- Сначала удаляем старый constraint (если есть)
DO $$
BEGIN
    -- Удаляем constraint, если он существует
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'dictionaries' 
        AND constraint_name = 'uq_dict_lemma_pos_lang'
    ) THEN
        ALTER TABLE dictionaries DROP CONSTRAINT uq_dict_lemma_pos_lang;
    END IF;
    
    -- Удаляем индекс, если он существует
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'dictionaries' 
        AND indexname = 'uq_dict_lemma_pos_lang'
    ) THEN
        DROP INDEX uq_dict_lemma_pos_lang;
    END IF;
END $$;

-- Создаём новый уникальный индекс с учётом категории
CREATE UNIQUE INDEX IF NOT EXISTS uq_dict_lemma_pos_lang_category 
ON dictionaries(lemma, pos, target_lang, category);

-- Шаг 7: Обновление существующих записей (все существующие слова получают category='general')
-- Это уже сделано через DEFAULT значение, но явно обновим для ясности
UPDATE dictionaries SET category = 'general' WHERE category IS NULL;
UPDATE user_language_profiles SET dictionary_category = 'general' WHERE dictionary_category IS NULL;

-- Проверка результатов
SELECT 'dictionaries' as table_name, category, COUNT(*) as count 
FROM dictionaries 
GROUP BY category;

SELECT 'user_language_profiles' as table_name, dictionary_category, COUNT(*) as count 
FROM user_language_profiles 
GROUP BY dictionary_category;

SELECT 'dictionary_categories' as table_name, COUNT(*) as count 
FROM dictionary_categories;
