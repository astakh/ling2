-- Миграция: Добавление поля max_lessons в таблицу user_language_profiles
-- Дата: 2026-09-27
-- Описание: Добавлено поле для настройки максимального количества уроков для пользователя

ALTER TABLE user_language_profiles
ADD COLUMN IF NOT EXISTS max_lessons INTEGER;

-- Установить значение по умолчанию для существующих записей (100 уроков)
UPDATE user_language_profiles
SET max_lessons = 100
WHERE max_lessons IS NULL;
