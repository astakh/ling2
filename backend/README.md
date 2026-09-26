# LingoFlow — Учи слова в контексте

Приложение для изучения иностранных слов через перевод осмысленных предложений с использованием LLM.

## 🏗️ Архитектура

### Frontend
- **React 18** + TypeScript
- **Vite** (сборка)
- **Tailwind CSS 4** (стили)
- **Framer Motion** (анимации)
- **React Router** (навигация)
- **Lucide React** (иконки)
- **Canvas Confetti** (эффекты)

### Backend
- **FastAPI** (async Python API)
- **PostgreSQL 15+** (база данных)
- **SQLAlchemy 2.0** (async ORM)
- **OpenAI API** (LLM для генерации предложений и оценки переводов)
- **Alembic** (миграции)

## 📋 User Journey

### Этап 1: Онбординг
1. Регистрация, выбор языка, уровня (A1-B2)
2. Создание профиля, инициализация статистики

### Этап 2: Начало урока
1. Проверка незавершённого урока
2. Проверка дневного лимита
3. Выбор слов для повторения (due words)
4. Добираем новые слова до лимита (5 слов)
5. Кластеризация на подгруппы по 2-3 слова
6. Генерация предложений через LLM (Prompt 1)
7. Создание заготовок упражнений

### Этап 3: Основной цикл
1. Пользователь видит предложение на изучаемом языке
2. Вводит перевод на родной язык
3. LLM оценивает перевод целевых слов (Prompt 2)
4. Typo-tolerance: прощаем опечатки

### Этап 4: Разбор результатов
1. Подсветка слов (зелёный/красный/жёлтый)
2. Обновление интервалов повторения
3. Переход к следующему упражнению

### Этап 5: Завершение
1. Агрегация статистики
2. Обновление стрика
3. Конфетти! 🎉

## 🚀 Запуск

### Frontend (демо-режим с localStorage)

```bash
npm install
npm run dev
```

Приложение работает полностью автономно с моковыми данными.

### Backend (полный стек)

```bash
# 1. PostgreSQL
createdb lingoflow
psql lingoflow < backend/init_db.sql

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Заполнить ключи
python main.py
```

### Переменные окружения (.env)

```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/lingoflow
SECRET_KEY=your-secret-key
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
```

## 🗄️ Схема БД

- `users` — пользователи
- `user_language_profiles` — профили языков
- `user_stats` — статистика (стрик, уроки)
- `dictionaries` — словарь слов
- `dictionary_translations` — переводы слов
- `user_words` — слова пользователя (с интервалами)
- `lessons` — уроки
- `lesson_exercises` — упражнения в уроке
- `llm_call_logs` — логи вызовов LLM

## 💡 Ключевые особенности

1. **Кластеризация слов** — 2-3 слова в каждом предложении для осмысленного контекста
2. **Scoped Evaluation** — LLM оценивает только целевые слова
3. **Typo-tolerance** — прощаем опечатки (1-2 буквы)
4. **Spaced Repetition** — интервалы повторения по stage
5. **Дневной лимит** — защита от перегрузки
6. **Стрик** — мотивация ежедневных занятий
