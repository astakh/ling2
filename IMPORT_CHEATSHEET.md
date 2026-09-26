# Шпаргалка: Импорт слов из JSON

## Быстрый старт

```bash
# Перейти в папку backend
cd backend

# Активировать виртуальное окружение (если ещё не активировано)
.\venv\Scripts\Activate.ps1  # Windows
# или
source venv/bin/activate  # Linux/Mac

# Импортировать слова из words.json (пример уже включён)
python import_dictionary.py

# Тестовый прогон (без записи в БД)
python import_dictionary.py --dry-run

# Импортировать из другого файла
python import_dictionary.py --file my_words.json
```

## Формат JSON-файла

```json
{
  "words": [
    {
      "lemma": "house",
      "pos": "noun",
      "cefr_level": "A1",
      "target_lang": "en",
      "translations": ["дом", "жилище"]
    }
  ]
}
```

### Обязательные поля

| Поле | Тип | Описание | Примеры |
|------|-----|----------|---------|
| `lemma` | string | Начальная форма слова | `"house"`, `"run"`, `"big"` |
| `pos` | string | Часть речи | `"noun"`, `"verb"`, `"adjective"` |
| `cefr_level` | string | Уровень CEFR | `"A1"`, `"A2"`, `"B1"`, `"B2"` |
| `target_lang` | string | Изучаемый язык | `"en"`, `"de"`, `"es"`, `"fr"` |
| `translations` | array | Переводы на русский | `["дом", "жилище"]` |

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

## Примеры

### Пример 1: Английские слова

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

### Пример 2: Немецкие слова

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

### Пример 3: Несколько переводов

```json
{
  "lemma": "run",
  "pos": "verb",
  "cefr_level": "A1",
  "target_lang": "en",
  "translations": ["бежать", "бегать", "пробежать", "мчаться"]
}
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

В папке `backend/` уже есть пример файла `words.json` с 20 английскими словами уровня A1-A2:

```bash
cd backend
python import_dictionary.py
```

## Ошибки

### Файл не найден

```
❌ Файл не найден: words.json
```

**Решение:** Убедитесь, что файл существует или укажите путь через `--file`.

### Ошибка парсинга JSON

```
❌ Ошибка парсинга JSON: Expecting ',' delimiter
```

**Решение:** Проверьте синтаксис JSON. Используйте валидатор: https://jsonlint.com/

### Ошибка валидации

```
❌ Слово #5: неверный pos 'adjectiv'
```

**Решение:** Используйте только допустимые значения из списка выше.

## Рекомендации

1. **Используйте dry-run** перед реальным импортом
2. **Проверяйте валидацию** — исправьте все ошибки
3. **Сохраняйте JSON-файлы** — для повторного импорта
4. **Используйте 2-3 перевода** — для лучшего понимания
5. **Соблюдайте формат** — начальная форма, правильная часть речи

## Подробная документация

См. [IMPORT_DICTIONARY.md](./IMPORT_DICTIONARY.md)
