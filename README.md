# LingoFlow — Учи слова в контексте

Приложение для изучения иностранных слов через перевод осмысленных предложений с использованием LLM.

## 🏗️ Архитектура

### Frontend
- **React 18** + TypeScript
- **Vite** (сборка)
- **Tailwind CSS 4** (стили)
- **Framer Motion** (анимации)
- **React Router** (навигация)

### Backend
- **FastAPI** (async Python API)
- **PostgreSQL** (удалённый сервер)
- **SQLAlchemy 2.0** (async ORM)
- **OpenAI API** (опционально, есть моковый режим)

## 🚀 Быстрый старт

### 1. Настройка удалённой базы данных

Следуйте инструкции в [SETUP_DATABASE.md](./SETUP_DATABASE.md)

Кратко:
```bash
# На удалённом сервере
sudo -u postgres psql
CREATE USER lingoflow WITH PASSWORD 'your_password';
CREATE DATABASE lingoflow OWNER lingoflow;
GRANT ALL PRIVILEGES ON DATABASE lingoflow TO lingoflow;
\q

# Разрешить удалённые подключения (postgresql.conf, pg_hba.conf)
sudo systemctl restart postgresql
```

### 1.1. Инициализация схемы БД

После создания БД на сервере, выполните инициализацию схемы:

**Вариант 1: Python скрипт (рекомендуется)**
```bash
python init_database.py
```

**Вариант 2: Bash скрипт (Linux/Mac)**
```bash
chmod +x init_database.sh
./init_database.sh
```

**Вариант 3: Напрямую через psql**
```bash
psql -h your-server-ip -U lingoflow -d lingoflow -f backend/init_db.sql
```

Все скрипты автоматически читают настройки из `backend/.env`.

### 2. Запуск Backend

**Windows (PowerShell):**
```powershell
cd backend

# Создать виртуальное окружение
python -m venv venv

# Активировать
.\venv\Scripts\Activate.ps1

# Если ошибка про политики выполнения:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1

# Установить зависимости
pip install -r requirements.txt

# Создать .env файл
Copy-Item .env.example .env
notepad .env
# Указать:
# DATABASE_URL=postgresql+asyncpg://lingoflow:password@server-ip:5432/lingoflow
# OPENAI_API_KEY=sk-... (или оставить пустым для мокового режима)

# Запустить сервер
python main.py
```

**Linux/Mac:**
```bash
cd backend

# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt

# Создать .env файл
cp .env.example .env
nano .env
# Указать:
# DATABASE_URL=postgresql+asyncpg://lingoflow:password@server-ip:5432/lingoflow
# OPENAI_API_KEY=sk-... (или оставить пустым для мокового режима)

# Запустить сервер
python main.py
```

Backend будет доступен на `http://localhost:8000`

### 3. Запуск Frontend

```bash
# В корне проекта
npm install
npm run dev
```

Frontend будет доступен на `http://localhost:5173`

## 📋 Режимы работы

### Моковый режим (без OpenAI API)

Если `OPENAI_API_KEY` не указан или пустой, приложение автоматически использует моковый LLM:
- Генерирует простые предложения
- Проверяет переводы по простому алгоритму
- Работает полностью локально

### Реальный режим (с OpenAI API)

Если указан валидный `OPENAI_API_KEY`:
- Генерирует осмысленные предложения через GPT-4o-mini
- Оценивает переводы с учётом контекста
- Поддерживает typo-tolerance

## 📖 User Journey

### Этап 1: Онбординг
1. Регистрация, выбор языка, уровня (A1-B2)
2. Создание профиля, инициализация статистики

### Этап 2: Начало урока
1. Проверка незавершённого урока
2. Проверка дневного лимита
3. Выбор слов для повторения (due words)
4. Добираем новые слова до лимита (5 слов)
5. Кластеризация на подгруппы по 2-3 слова
6. Генерация предложений через LLM
7. Создание заготовок упражнений

### Этап 3: Основной цикл
1. Пользователь видит предложение на изучаемом языке
2. Вводит перевод на родной язык
3. LLM оценивает перевод целевых слов
4. Typo-tolerance: прощаем опечатки

### Этап 4: Разбор результатов
1. Подсветка слов (зелёный/красный/жёлтый)
2. Обновление интервалов повторения
3. Переход к следующему упражнению

### Этап 5: Завершение
1. Агрегация статистики
2. Обновление стрика
3. Конфетти! 🎉

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

## 🔧 API Endpoints

- `POST /api/auth/register` — регистрация
- `POST /api/profile/setup` — создание профиля
- `GET /api/profile/{id}` — получить профиль
- `GET /api/stats/{user_id}` — получить статистику
- `POST /api/lesson/start` — начать урок
- `POST /api/lesson/submit` — отправить перевод
- `POST /api/words/add` — добавить слово
- `GET /api/words/{profile_id}` — получить слова пользователя
- `GET /api/health` — проверка здоровья

## 📝 Переменные окружения

```env
# PostgreSQL (удалённый сервер)
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/lingoflow

# Безопасность
SECRET_KEY=your-random-secret-key

# JWT
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# OpenAI API (опционально)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

## 🐛 Troubleshooting

### Ошибка подключения к БД
- Проверьте `DATABASE_URL` в `.env`
- Убедитесь, что PostgreSQL принимает удалённые подключения
- Проверьте firewall на сервере

### Frontend не видит Backend
- Проверьте CORS настройки в `backend/main.py`
- Убедитесь, что Backend запущен на порту 8000
- Проверьте консоль браузера на ошибки

### LLM не работает
- Проверьте `OPENAI_API_KEY` в `.env`
- Или оставьте пустым для мокового режима
- Проверьте `USE_MOCK_LLM` в `config.py`
