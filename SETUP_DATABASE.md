# Инструкция по настройке удалённого PostgreSQL

## 1. Подключение к серверу

```bash
ssh user@your-server-ip
```

## 2. Создание базы данных и пользователя

```bash
# Войти в PostgreSQL
sudo -u postgres psql

# В PostgreSQL выполнить:
CREATE USER lingoflow WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE lingoflow OWNER lingoflow;

# Дать привилегии
GRANT ALL PRIVILEGES ON DATABASE lingoflow TO lingoflow;

# Выйти
\q
```

## 3. Разрешить удалённые подключения

Отредактировать `/etc/postgresql/15/main/postgresql.conf`:
```bash
sudo nano /etc/postgresql/15/main/postgresql.conf
```

Найти строку `#listen_addresses = 'localhost'` и изменить на:
```
listen_addresses = '*'
```

Отредактировать `/etc/postgresql/15/main/pg_hba.conf`:
```bash
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

Добавить в конец файла:
```
# Разрешить подключения с вашего IP (замените на ваш реальный IP)
host    lingoflow    lingoflow    YOUR_LOCAL_IP/32    md5
```

Перезапустить PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## 4. Открыть порт в firewall (если нужно)

```bash
# Для UFW
sudo ufw allow 5432/tcp

# Или для конкретного IP
sudo ufw allow from YOUR_LOCAL_IP to any port 5432
```

## 5. Проверка подключения с локальной машины

```bash
psql -h your-server-ip -U lingoflow -d lingoflow
```

Или с помощью `pg_isready`:
```bash
pg_isready -h your-server-ip -p 5432
```

## 6. Инициализация схемы БД

После успешного подключения выполнить SQL-скрипт:
```bash
psql -h your-server-ip -U lingoflow -d lingoflow -f backend/init_db.sql
```

Или через psql интерактивно:
```bash
psql -h your-server-ip -U lingoflow -d lingoflow
\i backend/init_db.sql
```

## 7. Настройка .env для бэкенда

Создать файл `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://lingoflow:your_secure_password_here@your-server-ip:5432/lingoflow
SECRET_KEY=your-random-secret-key-here
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4o-mini
```

Замените:
- `your_secure_password_here` — пароль из шага 2
- `your-server-ip` — IP адрес вашего сервера
- `your-random-secret-key-here` — любая случайная строка для JWT
- `sk-your-openai-key-here` — ваш API ключ OpenAI

## 8. Проверка подключения из Python

Создать тестовый скрипт `test_db.py`:
```python
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def test_connection():
    engine = create_async_engine(
        "postgresql+asyncpg://lingoflow:password@server-ip:5432/lingoflow",
        echo=True
    )
    async with engine.connect() as conn:
        result = await conn.execute("SELECT 1")
        print("Connection successful:", result.scalar())
    await engine.dispose()

asyncio.run(test_connection())
```

Запустить:
```bash
python test_db.py
```

Если видите `Connection successful: 1` — всё работает!

## Troubleshooting

### Ошибка: "could not connect to server"
- Проверьте, что PostgreSQL запущен: `sudo systemctl status postgresql`
- Проверьте firewall: `sudo ufw status`
- Проверьте `listen_addresses` в postgresql.conf

### Ошибка: "password authentication failed"
- Убедитесь, что пароль в DATABASE_URL совпадает с созданным
- Проверьте pg_hba.conf — должен быть `md5` или `scram-sha-256`

### Ошибка: "database does not exist"
- Создайте БД заново: `CREATE DATABASE lingoflow OWNER lingoflow;`
