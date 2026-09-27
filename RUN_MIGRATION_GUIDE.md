# Инструкция по запуску миграции базы данных

## Проблема

При попытке зарегистрировать пользователя возникает ошибка:
```
column user_language_profiles.dictionary_category does not exist
```

Это означает, что база данных не обновлена для поддержки специализированных словарей.

## Решение

Запустите скрипт миграции из VSCode:

### Шаг 1: Откройте терминал в VSCode

```powershell
# Убедитесь, что вы в папке backend
cd D:\ling2\backend

# Активируйте виртуальное окружение
.\venv\Scripts\Activate.ps1
```

### Шаг 2: Запустите скрипт миграции

```powershell
python run_migration.py
```

### Шаг 3: Ожидаемый результат

```
======================================================================
Миграция базы данных LingoFlow
======================================================================

📡 Подключение к базе данных...
   URL: postgresql+asyncpg://lingoflow:***@46.173.24.73:5432/lingoflow

✅ Подключение успешно

📖 Чтение файла миграции: add_dictionary_categories.sql
✅ Файл прочитан (2513 символов)

🔧 Выполнение миграции...

   Найдено 13 SQL команд

   [1/13] Выполнение: ALTER TABLE dictionaries ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '...
   [2/13] Выполнение: CREATE INDEX IF NOT EXISTS ix_dict_category ON dictionaries(category);
   [3/13] Выполнение: CREATE INDEX IF NOT EXISTS ix_dict_lang_category ON dictionaries(target_lang, ca...
   [4/13] Выполнение: ALTER TABLE user_language_profiles ADD COLUMN IF NOT EXISTS dictionary_category ...
   [5/13] Выполнение: CREATE TABLE IF NOT EXISTS dictionary_categories ( id VARCHAR(50) PRIMARY KEY, n...
   [6/13] Выполнение: INSERT INTO dictionary_categories (id, name, description, icon, target_langs) VA...
   [7/13] Выполнение: DO $$ BEGIN IF EXISTS ( SELECT 1 FROM information_schema.table_constraints WHERE ...
   [8/13] Выполнение: CREATE UNIQUE INDEX IF NOT EXISTS uq_dict_lemma_pos_lang_category ON dictionarie...
   [9/13] Выполнение: UPDATE dictionaries SET category = 'general' WHERE category IS NULL;
   [10/13] Выполнение: UPDATE user_language_profiles SET dictionary_category = 'general' WHERE dictiona...
   [11/13] Выполнение: SELECT 'dictionaries' as table_name, category, COUNT(*) as count FROM dictionari...
   [12/13] Выполнение: SELECT 'user_language_profiles' as table_name, dictionary_category, COUNT(*) as ...
   [13/13] Выполнение: SELECT 'dictionary_categories' as table_name, COUNT(*) as count FROM dictionary_...

======================================================================
✅ Миграция завершена!
   Успешно выполнено: 13/13 команд
   ✅ Ошибок нет
======================================================================

🔍 Проверка результатов миграции...

   ✅ Поле 'category' добавлено в таблицу 'dictionaries'
   ✅ Поле 'dictionary_category' добавлено в таблицу 'user_language_profiles'
   ✅ Таблица 'dictionary_categories' создана (3 категорий)

======================================================================
🎉 Миграция успешно завершена!

Следующие шаги:
1. Перезапустите backend: python main.py
2. Обновите страницу в браузере: Ctrl+Shift+R
3. Проверьте API: curl http://localhost:8000/api/dictionary-categories?target_lang=en
======================================================================
```

### Шаг 4: Перезапустите backend

```powershell
# Остановите текущий процесс (Ctrl+C)
python main.py
```

### Шаг 5: Обновите страницу в браузере

Нажмите `Ctrl+Shift+R` для жёсткого обновления.

### Шаг 6: Проверьте работу

Попробуйте зарегистрироваться и создать профиль снова.

## Что делает миграция

1. **Добавляет поле `category`** в таблицу `dictionaries`
   - Позволяет categorize слова по типу словаря (general, it, business)
   - По умолчанию: `'general'`

2. **Добавляет поле `dictionary_category`** в таблицу `user_language_profiles`
   - Позволяет пользователю выбрать специализированный словарь
   - По умолчанию: `'general'`

3. **Создаёт таблицу `dictionary_categories`**
   - Хранит информацию о доступных категориях словарей
   - Начальные категории: general, it, business

4. **Обновляет индексы**
   - Создаёт индексы для быстрого поиска по категории
   - Обновляет уникальный индекс с учётом категории

5. **Мигрирует существующие данные**
   - Все существующие слова получают `category = 'general'`
   - Все существующие профили получают `dictionary_category = 'general'`

## Возможные проблемы

### Ошибка подключения

```
❌ Ошибка выполнения миграции!
Ошибка: could not connect to server
```

**Решение:** Проверьте настройки в `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://lingoflow:ваш_пароль@ваш_ip:5432/lingoflow
```

### Ошибка прав доступа

```
❌ Ошибка: permission denied for table
```

**Решение:** Убедитесь, что пользователь `lingoflow` имеет права на создание таблиц и изменение структуры БД.

### Ошибка файла миграции

```
❌ Файл миграции не найден: backend/migrations/add_dictionary_categories.sql
```

**Решение:** Убедитесь, что файл существует в папке `backend/migrations/`.

### Ошибка зависимых объектов

```
⚠️  Пропущено: есть зависимые объекты
```

**Это нормально!** Скрипт автоматически обрабатывает такие случаи и продолжает выполнение.

## Проверка после миграции

### Через SQL

```sql
-- Проверка поля category в dictionaries
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'dictionaries' AND column_name = 'category';

-- Проверка поля dictionary_category в user_language_profiles
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_language_profiles' AND column_name = 'dictionary_category';

-- Проверка таблицы dictionary_categories
SELECT * FROM dictionary_categories;
```

### Через API

```bash
curl http://localhost:8000/api/dictionary-categories?target_lang=en
```

Ожидаемый ответ:
```json
{
  "categories": [
    {
      "id": "general",
      "name": "Общий словарь",
      "description": "Базовые слова для повседневного общения",
      "icon": "📚",
      "target_langs": ["en", "de", "es", "fr"],
      "word_count": 166
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

## Следующие шаги

После успешной миграции:

1. **Перезапустите backend:**
   ```powershell
   python main.py
   ```

2. **Обновите страницу в браузере:** `Ctrl+Shift+R`

3. **Импортируйте специализированные слова:**
   ```powershell
   # IT-термины
   python import_dictionary.py --file it_words.json --lang en --category it
   
   # Бизнес-термины
   python import_dictionary.py --file business_words.json --lang en --category business
   ```

4. **Протестируйте создание профиля с выбором словаря**

## Документация

- `MULTILANGUAGE_ARCHITECTURE.md` - полная архитектура системы
- `SPECIALIZED_DICTIONARIES_GUIDE.md` - руководство по использованию специализированных словарей
- `MIGRATION_INSTRUCTIONS.md` - подробные инструкции по миграции
