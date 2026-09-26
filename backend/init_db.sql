-- LingoFlow Database Schema
-- PostgreSQL 15+

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    native_lang VARCHAR(10) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- User Language Profiles
CREATE TABLE IF NOT EXISTS user_language_profiles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_lang VARCHAR(10) NOT NULL,
    cefr_level VARCHAR(5) NOT NULL,
    current_lesson_number INTEGER DEFAULT 0,
    words_per_lesson_limit INTEGER DEFAULT 5,
    daily_lesson_limit INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_user_target_lang UNIQUE (user_id, target_lang)
);

-- User Stats
CREATE TABLE IF NOT EXISTS user_stats (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_lesson_date TIMESTAMP,
    total_words_learned INTEGER DEFAULT 0,
    total_lessons_completed INTEGER DEFAULT 0
);

-- Dictionary
CREATE TABLE IF NOT EXISTS dictionaries (
    id VARCHAR(36) PRIMARY KEY,
    target_lang VARCHAR(10) NOT NULL,
    lemma VARCHAR(100) NOT NULL,
    pos VARCHAR(20) NOT NULL,
    cefr_level VARCHAR(5) NOT NULL,
    CONSTRAINT uq_dict_lemma_pos_lang UNIQUE (lemma, pos, target_lang)
);

CREATE INDEX IF NOT EXISTS ix_dict_lang ON dictionaries(target_lang);
CREATE INDEX IF NOT EXISTS ix_dict_lang_level ON dictionaries(target_lang, cefr_level);

-- Dictionary Translations
CREATE TABLE IF NOT EXISTS dictionary_translations (
    id VARCHAR(36) PRIMARY KEY,
    dictionary_id VARCHAR(36) NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
    lang VARCHAR(10) NOT NULL,
    translations JSONB NOT NULL,
    CONSTRAINT uq_dict_trans_lang UNIQUE (dictionary_id, lang)
);

-- User Words (with spaced repetition)
CREATE TABLE IF NOT EXISTS user_words (
    id VARCHAR(36) PRIMARY KEY,
    user_language_profile_id VARCHAR(36) NOT NULL REFERENCES user_language_profiles(id) ON DELETE CASCADE,
    dictionary_id VARCHAR(36) NOT NULL REFERENCES dictionaries(id),
    stage INTEGER DEFAULT 0,
    due_lesson_number INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    context_exercise_id VARCHAR(36),
    CONSTRAINT uq_user_word UNIQUE (user_language_profile_id, dictionary_id)
);

CREATE INDEX IF NOT EXISTS ix_user_word_due ON user_words(user_language_profile_id, due_lesson_number);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    user_language_profile_id VARCHAR(36) NOT NULL REFERENCES user_language_profiles(id),
    lesson_number INTEGER NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'in_progress',
    total_words INTEGER DEFAULT 0,
    correct_words INTEGER DEFAULT 0,
    new_words_added INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_lesson_user_status ON lessons(user_id, status);

-- Partial unique index: only one in_progress lesson per user
CREATE UNIQUE INDEX IF NOT EXISTS ix_lesson_user_in_progress 
    ON lessons(user_id) WHERE status = 'in_progress';

-- Lesson Exercises
CREATE TABLE IF NOT EXISTS lesson_exercises (
    id VARCHAR(36) PRIMARY KEY,
    lesson_id VARCHAR(36) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    target_sentence TEXT NOT NULL,
    target_word_ids JSONB NOT NULL,
    user_translation TEXT,
    llm_response_json JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    CONSTRAINT uq_exercise_order UNIQUE (lesson_id, order_index)
);

-- LLM Call Logs
CREATE TABLE IF NOT EXISTS llm_call_logs (
    id VARCHAR(36) PRIMARY KEY,
    lesson_exercise_id VARCHAR(36) REFERENCES lesson_exercises(id),
    prompt_type VARCHAR(50) NOT NULL,
    prompt_version VARCHAR(20) NOT NULL,
    model VARCHAR(50) NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    cost INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed: Sample English dictionary entries
INSERT INTO dictionaries (id, target_lang, lemma, pos, cefr_level) VALUES
    ('en-1', 'en', 'quick', 'adjective', 'A1'),
    ('en-2', 'en', 'run', 'verb', 'A1'),
    ('en-3', 'en', 'dog', 'noun', 'A1'),
    ('en-4', 'en', 'house', 'noun', 'A1'),
    ('en-5', 'en', 'big', 'adjective', 'A1'),
    ('en-6', 'en', 'eat', 'verb', 'A1'),
    ('en-7', 'en', 'water', 'noun', 'A1'),
    ('en-8', 'en', 'sleep', 'verb', 'A1'),
    ('en-9', 'en', 'cat', 'noun', 'A1'),
    ('en-10', 'en', 'small', 'adjective', 'A1')
ON CONFLICT DO NOTHING;

-- Seed: Translations for sample words
INSERT INTO dictionary_translations (id, dictionary_id, lang, translations) VALUES
    ('trans-1', 'en-1', 'ru', '["быстрый", "скорый"]'),
    ('trans-2', 'en-2', 'ru', '["бежать", "бегать"]'),
    ('trans-3', 'en-3', 'ru', '["собака", "пёс"]'),
    ('trans-4', 'en-4', 'ru', '["дом", "жилище"]'),
    ('trans-5', 'en-5', 'ru', '["большой", "крупный"]'),
    ('trans-6', 'en-6', 'ru', '["есть", "кушать"]'),
    ('trans-7', 'en-7', 'ru', '["вода"]'),
    ('trans-8', 'en-8', 'ru', '["спать"]'),
    ('trans-9', 'en-9', 'ru', '["кошка", "кот"]'),
    ('trans-10', 'en-10', 'ru', '["маленький", "малый"]')
ON CONFLICT DO NOTHING;
