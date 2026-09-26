# Windows: Пошаговая инструкция запуска

## 1. Создать виртуальное окружение

Откройте PowerShell в папке `D:\ling2\backend`:

```powershell
cd D:\ling2\backend
python -m venv venv
```

## 2. Активировать виртуальное окружение

```powershell
.\venv\Scripts\Activate.ps1
```

Если появится ошибка про политики выполнения:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1
```

После активации вы увидите `(venv)` в начале строки:
```
(venv) PS D:\ling2\backend>
```

## 3. Установить зависимости

```powershell
pip install -r requirements.txt
```

## 4. Создать файл .env

```powershell
Copy-Item .env.example .env
notepad .env
```

Заполните настройки:
```env
DATABASE_URL=postgresql+asyncpg://lingoflow:ваш_пароль@ip_сервера:5432/lingoflow
SECRET_KEY=любая_случайная_строка
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## 5. Проверить подключение к БД

**ВАЖНО: Запускайте скрипты ИЗ ПАПКИ backend!**

```powershell
# Убедитесь, что вы в папке backend
cd D:\ling2\backend

# Запустить тест подключения
python test_connection.py
```

Если видите `✓ Все тесты пройдены!` — переходите к следующему шагу.

## 6. Инициализировать базу данных

```powershell
# Из папки backend
python init_db.py
```

Введите `y` для подтверждения.

## 7. Запустить backend

```powershell
# Из папки backend
python main.py
```

Вы увидите:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## 8. Запустить frontend (в НОВОМ окне PowerShell)

Откройте **новое окно PowerShell** (не закрывая backend):

```powershell
cd D:\ling2
npm install
npm run dev
```

Вы увидите:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## 9. Открыть приложение

Откройте браузер: **http://localhost:5173**

---

## ⚠️ Частые ошибки

### "Import 'config' could not be resolved"
Это предупреждение VSCode, а не ошибка Python. 
**Решение:** Запускайте скрипты ИЗ ПАПКИ `backend`:
```powershell
cd D:\ling2\backend
python test_connection.py
```

### "source не распознано"
На Windows используйте:
```powershell
.\venv\Scripts\Activate.ps1
```

### "python не найден"
Попробуйте:
```powershell
py -m venv venv
```

### Ошибка подключения к БД
- Проверьте `DATABASE_URL` в `.env`
- Убедитесь, что PostgreSQL запущен на сервере
- Проверьте firewall (порт 5432)

---

## 📁 Структура проекта

```
D:\ling2\
├── backend\              ← Все команды для backend запускаются ОТСЮДА
│   ├── venv\            ← Виртуальное окружение
│   ├── .env             ← Настройки (создать вручную)
│   ├── main.py          ← Запуск backend
│   ├── test_connection.py  ← Тест подключения к БД
│   ├── init_db.py       ← Инициализация БД
│   └── requirements.txt
├── src\                 ← Frontend код
├── package.json
└── README.md
```

## 🎯 Порядок запуска

1. **Backend** (в PowerShell):
   ```powershell
   cd D:\ling2\backend
   .\venv\Scripts\Activate.ps1
   python main.py
   ```

2. **Frontend** (в НОВОМ окне PowerShell):
   ```powershell
   cd D:\ling2
   npm run dev
   ```

3. **Открыть**: http://localhost:5173
