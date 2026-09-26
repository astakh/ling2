# Импорт слов из JSON-файла

## Обзор

Скрипт `import_dictionary.py` позволяет импортировать слова из JSON-файла в базу данных. Это полезно, когда у вас уже есть готовый список слов в формате JSON.

## Формат JSON-файла

Файл должен содержать объект с ключом `words`, который является массивом объектов слов:

```json
{
  "words": [
    {
      "lemma": "house",
      "pos": "noun",
      "cefr_level": "A1",
      "target_lang": "en",
      "translations": ["дом", "жилище", "здание"]
    },
    {
      "lemma": "run",
      "pos": "verb",
      "cefr_level": "A1",
      "target_lang": "en",
      "translations": ["бежать", "бегать", "пробежать"]
    }
  ]
}
```

### Обязательные поля

- **`lemma`** (string) — начальная форма слова
- **`pos`** (string) — часть речи
- **`cefr_level`** (string) — уровень CEFR
- **`target_lang`** (string) — изучаемый язык
- **`translations`** (array of strings) — массив переводов на русский

### Допустимые значения

**Части речи (`pos`):**
- `noun` — существительное
- `verb` — глагол
- `adjective` — прилагательное
- `adverb` — наречие
- `preposition` — предлог
- `pronoun` — местоимение
- `conjunction` — союз
- `article` — артикль
- `numeral` — числительное

**Уровни CEFR (`cefr_level`):**
- `A1` — начальный
- `A2` — элементарный
- `B1` — средний
- `B2` — выше среднего
- `C1` — продвинутый
- `C2` — владение в совершенстве

**Языки (`target_lang`):**
- `en` — английский
- `de` — немецкий
- `es` — испанский
- `fr` — французский
- `ru` — русский
- `it` — итальянский
- `pt` — португальский
- `zh` — китайский
- `ja` — японский
- `ko` — корейский

## Использование

### Базовый импорт

```bash
cd backend
python import_dictionary.py
```

Скрипт по умолчанию ищет файл `words.json` в текущей директории.

### Импорт из другого файла

```bash
python import_dictionary.py --file my_words.json
```

### Тестовый прогон (dry-run)

```bash
python import_dictionary.py --dry-run
```

Покажет, какие слова будут добавлены, но не запишет их в БД.

### Комбинирование параметров

```bash
python import_dictionary.py --file custom_words.json --dry-run
```

## Примеры

### Пример 1: Импорт английских слов

Создайте файл `english_words.json`:

```json
{
  "words": [
    {
      "lemma": "apple",
      "pos": "noun",
      "cefr_level": "A1",
      "target_lang": "en",
      "translations": ["яблоко"]
    },
    {
      "lemma": "eat",
      "pos": "verb",
      "cefr_level": "A1",
      "target_lang": "en",
      "translations": ["есть", "кушать"]
    }
  ]
}
```

Запустите:

```bash
python import_dictionary.py --file english_words.json
```

### Пример 2: Импорт немецких слов

```json
{
  "words": [
    {
      "lemma": "Haus",
      "pos": "noun",
      "cefr_level": "A1",
      "target_lang": "de",
      "translations": ["дом"]
    },
    {
      "lemma": "laufen",
      "pos": "verb",
      "cefr_level": "A1",
      "target_lang": "de",
      "translations": ["бежать", "бегать"]
    }
  ]
}
```

### Пример 3: Массив переводов

Вы можете указать несколько вариантов перевода:

```json
{
  "lemma": "run",
  "pos": "verb",
  "cefr_level": "A1",
  "target_lang": "en",
  "translations": ["бежать", "бегать", "пробежать", "мчаться"]
}
```

## Проверка уникальности

Скрипт автоматически проверяет уникальность по комбинации `lemma + pos + target_lang`. Если слово уже существует в базе, оно будет пропущено.

Пример вывода:

```
✅ Добавлено: house (noun) [en] - дом, жилище
⏭️  Пропущено (дубликат): house (noun) [en]
```

## Валидация

Скрипт проверяет каждое слово на корректность:

- Все обязательные поля должны присутствовать
- Значения полей должны быть из списка допустимых
- `translations` должен быть непустым массивом

Пример ошибки валидации:

```
❌ Слово #5: неверный pos 'adjectiv'
❌ Слово #5: неверный cefr_level 'A3'
```

## Статистика

После завершения импорта скрипт выводит статистику:

```
📈 ИТОГО:
  ✅ Добавлено слов: 18
  ⏭️  Пропущено (дубликаты): 2
  ❌ Ошибок валидации: 1
  ❌ Других ошибок: 0
```

## Проверка результата

После импорта откройте админку:

```
http://localhost:8000/admin
```

Проверьте таблицы:
- `dictionaries` — новые слова
- `dictionary_translations` — переводы

## Пример файла words.json

В папке `backend/` уже есть пример файла `words.json` с 20 английскими словами уровня A1-A2. Вы можете использовать его для тестирования:

```bash
cd backend
python import_dictionary.py
```

## Структура БД

### Таблица `dictionaries`

```sql
id              UUID PRIMARY KEY
target_lang     VARCHAR(10)      -- en, de, es, fr
lemma           VARCHAR(100)     -- начальная форма слова
pos             VARCHAR(20)      -- часть речи
cefr_level      VARCHAR(5)       -- A1, A2, B1, B2
```

### Таблица `dictionary_translations`

```sql
id              UUID PRIMARY KEY
dictionary_id   UUID FK          -- ссылка на dictionaries
lang            VARCHAR(10)      -- язык перевода (всегда "ru")
translations    JSONB            -- массив переводов
```

## Ошибки

### Файл не найден

```
❌ Файл не найден: words.json
```

**Решение:** Убедитесь, что файл существует в текущей директории или укажите правильный путь через `--file`.

### Ошибка парсинга JSON

```
❌ Ошибка парсинга JSON: Expecting ',' delimiter: line 5 column 3
```

**Решение:** Проверьте синтаксис JSON-файла. Используйте валидатор JSON.

### Ошибка подключения к БД

```
❌ Ошибка подключения к базе данных
```

**Решение:** Проверьте `DATABASE_URL` в `.env` и убедитесь, что PostgreSQL запущен.

## Рекомендации

1. **Используйте dry-run** перед реальным импортом
2. **Проверяйте валидацию** — исправьте все ошибки перед импортом
3. **Сохраняйте исходные JSON-файлы** — для повторного импорта
4. **Используйте массив переводов** — 2-3 варианта для лучшего понимания
5. **Соблюдайте формат** — начальная форма слова, правильная часть речи

## Автоматизация

Вы можете комбинировать генерацию и импорт:

```bash
# 1. Сгенерировать слова через GigaChat
python generate_dictionary.py --lang en --level A1 --count 50

# 2. Экспортировать в JSON (если нужно)
# (требует дополнительной реализации)

# 3. Импортировать из JSON
python import_dictionary.py --file my_words.json
```

## Подробная документация

См. также:
- [DICTIONARY_GENERATION.md](./DICTIONARY_GENERATION.md) — генерация через GigaChat
- [DICTIONARY_CHEATSHEET.md](./DICTIONARY_CHEATSHEET.md) — шпаргалка
