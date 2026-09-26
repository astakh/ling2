# Быстрый старт (TL;DR)

## 1. Настроить PostgreSQL на удалённом сервере

```bash
# На сервере
sudo -u postgres psql
CREATE USER lingoflow WITH PASSWORD 'your_password';
CREATE DATABASE lingoflow OWNER lingoflow;
\q

# Разрешить подключения (postgresql.conf, pg_hba.conf)
sudo systemctl restart postgresql
```

## 2. Инициализировать БД

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

## 3. Настроить Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env  # указать DATABASE_URL
```

## 4. Проверить подключение

```bash
python test_db_connection.py
```

## 5. Запустить Backend

```bash
python main.py
# или
python start_backend.py
```

## 6. Запустить Frontend

```bash
npm install
npm run dev
```

## Готово!

Открыть http://localhost:5173

---

Подробные инструкции:
- Настройка БД: [SETUP_DATABASE.md](./SETUP_DATABASE.md)
- Полная документация: [README.md](./README.md)
