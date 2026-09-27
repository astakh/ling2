# Исправление ошибки KeyError: 'target_lang'

## Проблема

При оценке перевода возникала ошибка:
```
KeyError: 'target_lang'
```

**Причина:** В коде использовалось обращение `target_words[0]["target_lang"]`, но в словаре `target_words` нет ключа `target_lang`.

**Структура `target_words`:**
```python
{
    "id": "uuid",
    "lemma": "слово",
    "pos": "часть_речи"
}
```

## Решение

### 1. Получение `target_lang` из профиля

Добавлен запрос к базе данных для получения `target_lang` из профиля пользователя:

```python
# Получаем target_lang из профиля
target_lang = "en"  # дефолтное значение
if db and profile_id:
    from models import UserLanguageProfile
    profile_result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.id == profile_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile:
        target_lang = profile.target_lang
        logger.info(f"[GigaChat] Target language from profile: {target_lang}")
```

### 2. Замена обращений

Заменены все обращения `target_words[0]["target_lang"]` на переменную `target_lang`:

**Было:**
```python
Dictionary.target_lang == target_words[0]["target_lang"] if target_words else "en"
```

**Стало:**
```python
Dictionary.target_lang == target_lang
```

### 3. Логирование

Добавлено логирование для отладки:
```
[GigaChat] Target language from profile: en
```

## Затронутые файлы

- `backend/main.py` - функция `GigaChatService.evaluate_translation()`

## Тестирование

После исправления логи должны показывать:
```
[GigaChat] === Начало оценки перевода ===
[GigaChat] Предложение: The cat ran beyond the fence...
[GigaChat] Перевод пользователя: кот бажал по стене...
[GigaChat] Целевых слов: 2
[GigaChat] Profile ID: 9c0da6db-4aa2-4f7f-a0e6-b882ded7f1ee
[GigaChat] Target language from profile: en
[GigaChat] Найдены переводы для 'among': ['среди']
[GigaChat] Найдены переводы для 'beyond': ['за пределами']
[GigaChat] Evaluating translation for 2 target words
[GigaChat] === Результат от LLM ===
[GigaChat] Suggested new words от LLM: [{'lemma': 'ran', ...}, {'lemma': 'bushes', ...}]
[GigaChat] Начинаю фильтрацию 2 предложенных новых слов...
[GigaChat] Проверяю новое слово: 'ran' (verb)
[GigaChat] ✓ Слово 'ran' найдено в dictionaries (ID: ...)
[GigaChat] ✓✓✓ Слова 'ran' НЕТ в user_words, предлагаю добавить!
```

## Преимущества решения

✅ **Надёжность** - `target_lang` всегда доступен из профиля  
✅ **Корректность** - используется реальный язык пользователя, а не дефолтный  
✅ **Логирование** - легко отследить, какой язык используется  
✅ **Производительность** - один запрос к БД вместо потенциально ошибочного обращения к словарю
