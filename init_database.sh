#!/bin/bash
# Скрипт для инициализации базы данных LingoFlow
# Использует psql для выполнения init_db.sql

set -e  # Остановить при ошибке

echo "========================================================================"
echo "Инициализация базы данных LingoFlow"
echo "========================================================================"
echo ""

# Проверить наличие psql
if ! command -v psql &> /dev/null; then
    echo "✗ psql не найден!"
    echo ""
    echo "Установите PostgreSQL client:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  Или используйте Python скрипт: python init_database.py"
    echo ""
    exit 1
fi

# Проверить наличие .env файла
if [ ! -f backend/.env ]; then
    echo "✗ Файл backend/.env не найден!"
    echo ""
    echo "Создайте его:"
    echo "  cp backend/.env.example backend/.env"
    echo "  nano backend/.env"
    echo ""
    exit 1
fi

# Загрузить переменные из .env
export $(grep -v '^#' backend/.env | xargs)

# Проверить DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "✗ DATABASE_URL не указан в backend/.env"
    echo ""
    exit 1
fi

# Парсить DATABASE_URL
# Формат: postgresql+asyncpg://user:password@host:port/database
DB_URL_CLEAN=${DATABASE_URL#postgresql+asyncpg://}
DB_USER=$(echo $DB_URL_CLEAN | cut -d: -f1)
DB_PASS_TEMP=$(echo $DB_URL_CLEAN | cut -d@ -f1 | cut -d: -f2)
DB_HOST_PORT=$(echo $DB_URL_CLEAN | cut -d@ -f2 | cut -d/ -f1)
DB_HOST=$(echo $DB_HOST_PORT | cut -d: -f1)
DB_PORT=$(echo $DB_HOST_PORT | cut -d: -f2)
DB_NAME=$(echo $DB_URL_CLEAN | cut -d/ -f2)

# Если порт не указан, использовать 5432
if [ -z "$DB_PORT" ]; then
    DB_PORT=5432
fi

echo "Настройки подключения:"
echo "  Хост: $DB_HOST:$DB_PORT"
echo "  База: $DB_NAME"
echo "  Пользователь: $DB_USER"
echo ""

# Проверить файл init_db.sql
if [ ! -f backend/init_db.sql ]; then
    echo "✗ Файл backend/init_db.sql не найден!"
    echo ""
    exit 1
fi

# Подтверждение
if [ "$1" != "--force" ]; then
    echo "⚠️  Это создаст таблицы и добавит начальные данные в БД."
    echo ""
    read -p "Продолжить? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[YyДд]$ ]]; then
        echo "Отменено."
        exit 0
    fi
fi

echo ""
echo "Подключение к базе данных..."
echo ""

# Выполнить SQL файл
export PGPASSWORD=$DB_PASS_TEMP

if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f backend/init_db.sql; then
    echo ""
    echo "========================================================================"
    echo "✓ База данных успешно инициализирована!"
    echo "========================================================================"
    echo ""
    echo "Следующие шаги:"
    echo "1. Запустить backend: cd backend && python main.py"
    echo "2. Запустить frontend: npm run dev"
    echo "3. Открыть http://localhost:5173"
    echo ""
else
    echo ""
    echo "========================================================================"
    echo "✗ Ошибка при инициализации базы данных!"
    echo "========================================================================"
    echo ""
    echo "Возможные причины:"
    echo "1. Неверный пароль или имя пользователя"
    echo "2. База данных не существует"
    echo "3. Нет прав на создание таблиц"
    echo ""
    echo "Следуйте инструкции в SETUP_DATABASE.md"
    echo "========================================================================"
    exit 1
fi

unset PGPASSWORD
