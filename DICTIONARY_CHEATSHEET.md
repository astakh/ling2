# Шпаргалка: Пополнение словаря

## Быстрый старт

```bash
# Перейти в папку backend
cd backend

# Активировать виртуальное окружение (если ещё не активировано)
.\venv\Scripts\Activate.ps1  # Windows
# или
source venv/bin/activate  # Linux/Mac

# Проверить, что будет добавлено (без записи в БД)
python generate_dictionary.py --dry-run

# Добавить все слова для всех языков и уровней
python generate_dictionary.py

# Добавить только английские слова уровня A1
python generate_dictionary.py --lang en --level A1

# Добавить 100 слов за один запрос
python generate_dictionary.py --count 100
```

## Примеры использования

### 1. Тестовый прогон

```bash
python generate_dictionary.py --dry-run --lang en --level A1 --count 10
```

Покажет 10 английских слов уровня A1, которые будут добавлены, но не запишет их в БД.

### 2. Populate English A1

```bash
python generate_dictionary.py --lang en --level A1
```

Добавит ~30 английских слов уровня A1.

### 3. Populate all languages, level A1

```bash
python generate_dictionary.py --level A1
```

Добавит слова уровня A1 для всех 4 языков (en, de, es, fr).

### 4. Populate everything

```bash
python generate_dictionary.py
```

Добавит слова для всех языков и всех уровней (4 языка × 4 уровня × 30 слов = ~480 слов).

### 5. Generate more words

```bash
python generate_dictionary.py --count 100
```

Добавит 100 слов за один запрос (вместо 30 по умолчанию).

## Проверка результата

После запуска откройте админку:

```
http://localhost:8000/admin
```

Проверьте таблицу `dictionaries` — там должны появиться новые слова.

## Ошибки

### Ошибка: GIGACHAT_CREDENTIALS не установлен

```
❌ GIGACHAT_CREDENTIALS не установлен в .env
```

**Решение:** Добавьте в `backend/.env`:
```env
GIGACHAT_CREDENTIALS=Basic ваш_ключ_тут
```

### Ошибка: Rate limit exceeded

```
Ошибка API: 429 - Rate limit exceeded
```

**Решение:** Подождите несколько минут и попробуйте снова.

### Ошибка: No module named 'httpx'

```
ModuleNotFoundError: No module named 'httpx'
```

**Решение:**
```bash
pip install httpx
```

## Параметры скрипта

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `--lang` | Язык (en, de, es, fr) | Все языки |
| `--level` | Уровень CEFR (A1, A2, B1, B2) | Все уровни |
| `--count` | Количество слов за запрос | 30 |
| `--dry-run` | Только показать, не добавлять | False |

## Что генерируется

Для каждого слова создаётся:
- Запись в таблице `dictionaries` (lemma, pos, cefr_level, target_lang)
- Запись в таблице `dictionary_translations` (переводы на русский)

Распределение частей речи:
- 40% nouns (существительные)
- 30% verbs (глаголы)
- 20% adjectives (прилагательные)
- 10% другие части речи

## Рекомендации

1. **Начните с dry-run** — проверьте, какие слова будут добавлены
2. **Генерируйте по одному языку** — для лучшего контроля
3. **Используйте --count 50-100** — для большего количества слов
4. **Проверяйте дубликаты** — скрипт автоматически их пропускает
5. **Сохраняйте логи** — для отслеживания прогресса

## Подробная документация

См. [DICTIONARY_GENERATION.md](./DICTIONARY_GENERATION.md)
