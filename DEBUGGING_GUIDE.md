# Руководство по отладке предложения новых слов

## Обзор

Добавлено подробное логирование для отслеживания процесса предложения новых слов при неправильном переводе. Логи помогут определить, на каком этапе возникает проблема.

## Уровни логирования

### 1. SubmitTranslation (эндпоинт `/api/lesson/submit`)

**Префикс:** `[SubmitTranslation]`

**Что логируется:**
- Начало обработки перевода
- ID упражнения и перевод пользователя
- Загрузка целевых слов из `dictionaries`
- Информация о пользователе и профиле
- Вызов LLM для оценки
- Результат от LLM (overall_correct, suggested_new_words, word_results)
- Конец обработки

**Пример логов:**
```
[SubmitTranslation] === Начало обработки перевода ===
[SubmitTranslation] Exercise ID: abc-123-def
[SubmitTranslation] Перевод пользователя: быстрый собака бежать
[SubmitTranslation] Exercise найден, target_word_ids: ['word-1', 'word-2', 'word-3']
[SubmitTranslation] Загружено 3 целевых слов из dictionaries
[SubmitTranslation]   - quick (ID: word-1, POS: adjective)
[SubmitTranslation]   - dog (ID: word-2, POS: noun)
[SubmitTranslation]   - run (ID: word-3, POS: verb)
[SubmitTranslation] Lesson ID: lesson-456
[SubmitTranslation] User ID: user-789, Native lang: ru
[SubmitTranslation] Profile ID: profile-012
[SubmitTranslation] Вызываю LLM для оценки перевода...
[SubmitTranslation] === Результат от LLM ===
[SubmitTranslation] Overall correct: False
[SubmitTranslation] Suggested new words: ['word-3']
[SubmitTranslation] Word results:
[SubmitTranslation]   - quick: is_correct=True, has_typo=False
[SubmitTranslation]   - dog: is_correct=True, has_typo=False
[SubmitTranslation]   - run: is_correct=False, has_typo=False
[SubmitTranslation] === Конец обработки перевода ===
```

### 2. MockLLM (локальная оценка)

**Префикс:** `[MockLLM]`

**Что логируется:**
- Начало оценки перевода
- Проверка каждого слова:
  - Поиск переводов в БД
  - Сравнение с переводом пользователя
  - Определение правильности (is_correct, has_typo)
  - Проверка наличия слова в `user_words`
  - Решение о предложении слова
- Результат оценки

**Пример логов:**
```
[MockLLM] === Начало оценки перевода ===
[MockLLM] Предложение: The quick dog runs
[MockLLM] Перевод пользователя: быстрый собака
[MockLLM] Целевых слов: 3
[MockLLM] Profile ID: profile-012
[MockLLM] --- Проверка слова: quick (ID: word-1) ---
[MockLLM] Найдены переводы в БД: ['быстрый', 'скорый']
[MockLLM] Перевод пользователя (lower): 'быстрый собака'
[MockLLM] Проверяем перевод: 'быстрый'
[MockLLM] ✓ Слово 'quick' переведено ПРАВИЛЬНО (найдено 'быстрый')
[MockLLM] --- Проверка слова: dog (ID: word-2) ---
[MockLLM] Найдены переводы в БД: ['собака', 'пёс']
[MockLLM] Проверяем перевод: 'собака'
[MockLLM] ✓ Слово 'dog' переведено ПРАВИЛЬНО (найдено 'собака')
[MockLLM] --- Проверка слова: run (ID: word-3) ---
[MockLLM] Найдены переводы в БД: ['бежать', 'бегать']
[MockLLM] Проверяем перевод: 'бежать'
[MockLLM] ✗ Слово 'run' переведено НЕПРАВИЛЬНО
[MockLLM] Слово 'run' переведено неправильно, проверяем возможность предложения...
[MockLLM] Проверяем наличие слова 'run' в user_words пользователя...
[MockLLM] Слова 'run' НЕТ в user_words, предлагаем добавить!
[MockLLM] ✓✓✓ Добавлено в suggested_new_words: run (word-3)
[MockLLM] === Результат оценки ===
[MockLLM] Overall correct: False
[MockLLM] Suggested new words: 1 слов
[MockLLM] IDs предложенных слов: ['word-3']
[MockLLM] === Конец оценки перевода ===
```

### 3. GigaChat (оценка через API)

**Префикс:** `[GigaChat]`

**Что логируется:**
- Начало оценки перевода
- Получение переводов из БД
- Результат от LLM (до фильтрации)
- Фильтрация `suggested_new_words`:
  - Проверка наличия слова в `dictionaries`
  - Проверка отсутствия слова в `user_words`
  - Решение о предложении слова
- Результат после фильтрации

**Пример логов:**
```
[GigaChat] === Начало оценки перевода ===
[GigaChat] Предложение: The quick dog runs
[GigaChat] Перевод пользователя: быстрый собака
[GigaChat] Целевых слов: 3
[GigaChat] Profile ID: profile-012
[GigaChat] Найдены переводы для 'quick': ['быстрый', 'скорый']
[GigaChat] Найдены переводы для 'dog': ['собака', 'пёс']
[GigaChat] Найдены переводы для 'run': ['бежать', 'бегать']
[GigaChat] === Результат от LLM ===
[GigaChat] Overall correct: False
[GigaChat] Suggested new words от LLM: ['word-3']
[GigaChat] Word results:
[GigaChat]   - quick: is_correct=True, has_typo=False
[GigaChat]   - dog: is_correct=True, has_typo=False
[GigaChat]   - run: is_correct=False, has_typo=False
[GigaChat] Начинаю фильтрацию 1 предложенных слов...
[GigaChat] Проверяю слово ID: word-3
[GigaChat] ✓ Слово 'run' найдено в dictionaries
[GigaChat] ✓✓✓ Слова 'run' НЕТ в user_words, предлагаю добавить!
[GigaChat] После фильтрации: 1 слов для предложения
[GigaChat] === Конец оценки перевода ===
```

## Типичные проблемы и их диагностика

### Проблема 1: Слова не предлагаются вообще

**Симптомы:**
- В логах `[SubmitTranslation]` видно `Suggested new words: []`
- В логах `[MockLLM]` или `[GigaChat]` нет сообщений о предложении слов

**Возможные причины:**
1. Все слова переведены правильно
2. Все неправильно переведённые слова уже есть в `user_words`
3. Неправильно переведённые слова отсутствуют в `dictionaries`
4. Не передаётся `profile_id` в `evaluate_translation`

**Диагностика:**
```bash
# Проверьте логи
[MockLLM] ✗ Слово 'run' переведено НЕПРАВИЛЬНО
[MockLLM] Слова 'run' УЖЕ есть в user_words, не предлагаю
# или
[MockLLM] Не могу проверить user_words: db=None, profile_id=None
```

**Решение:**
- Убедитесь, что `profile_id` передаётся в `evaluate_translation`
- Проверьте, что слова есть в `dictionaries`
- Удалите слова из `user_words` для тестирования

### Проблема 2: LLM не определяет ошибки

**Симптомы:**
- В логах `[GigaChat]` все слова `is_correct=True`
- Пользователь явно ошибся, но LLM не заметил

**Возможные причины:**
1. Неправильный промпт для LLM
2. LLM не понимает задачу
3. Переводы в `dictionaries` неполные

**Диагностика:**
```bash
[GigaChat] Word results:
[GigaChat]   - run: is_correct=True, has_typo=False
# но пользователь не перевёл это слово!
```

**Решение:**
- Проверьте промпт в `GigaChatService.evaluate_translation`
- Убедитесь, что переводы в `dictionaries` полные
- Попробуйте другую модель GigaChat

### Проблема 3: Слова предлагаются, но не добавляются

**Симптомы:**
- В логах видно `✓✓✓ Добавлено в suggested_new_words`
- На фронтенде блок с предложением не появляется

**Возможные причины:**
1. Фронтенд не обрабатывает `suggested_new_words`
2. Ошибка в API ответе
3. Ошибка в фронтенде при отображении

**Диагностика:**
```bash
# Backend логи
[MockLLM] ✓✓✓ Добавлено в suggested_new_words: run (word-3)
[SubmitTranslation] Suggested new words: ['word-3']

# Frontend консоль
[API] Response: {..., suggested_new_words: []}
# или
[Lesson] Failed to add word: Error
```

**Решение:**
- Проверьте ответ API в браузере (DevTools → Network)
- Проверьте консоль браузера на ошибки
- Убедитесь, что фронтенд правильно обрабатывает `suggested_new_words`

### Проблема 4: Ошибки при проверке user_words

**Симптомы:**
- В логах видны ошибки SQL
- Слова не предлагаются из-за ошибок БД

**Возможные причины:**
1. Неправильная структура таблицы `user_words`
2. Отсутствие индексов
3. Проблемы с соединением с БД

**Диагностика:**
```bash
[MockLLM] Проверяем наличие слова 'run' в user_words пользователя...
ERROR:    Exception in ASGI application
sqlalchemy.exc.ProgrammingError: ...
```

**Решение:**
- Проверьте структуру таблицы `user_words`
- Убедитесь, что есть индексы на `user_language_profile_id` и `dictionary_id`
- Проверьте соединение с БД

## Как использовать логи для отладки

### Шаг 1: Запустите backend с логированием

```bash
cd backend
python main.py
```

Убедитесь, что уровень логирования установлен в `INFO`:
```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Шаг 2: Выполните действие в фронтенде

1. Начните урок
2. Переведите предложение с ошибкой (пропустите слово)
3. Нажмите "Проверить"

### Шаг 3: Проанализируйте логи

Ищите следующие паттерны:

**Успешное предложение слова:**
```
[MockLLM] ✗ Слово 'run' переведено НЕПРАВИЛЬНО
[MockLLM] Слова 'run' НЕТ в user_words, предлагаем добавить!
[MockLLM] ✓✓✓ Добавлено в suggested_new_words: run (word-3)
[SubmitTranslation] Suggested new words: ['word-3']
```

**Слово уже есть в user_words:**
```
[MockLLM] ✗ Слово 'run' переведено НЕПРАВИЛЬНО
[MockLLM] Слова 'run' УЖЕ есть в user_words, не предлагаю
```

**Слово отсутствует в dictionaries:**
```
[GigaChat] Проверяю слово ID: word-999
[GigaChat] ✗ Слово ID word-999 НЕ найдено в dictionaries
```

**Не передаётся profile_id:**
```
[MockLLM] Не могу проверить user_words: db=True, profile_id=None
```

### Шаг 4: Проверьте фронтенд

Откройте DevTools (F12) → Console и ищите:

**Успешное добавление:**
```
[Lesson] Marking word as learned: word-3
[Lesson] Word marked as learned successfully
```

**Ошибка добавления:**
```
[Lesson] Failed to add word: Error: ...
```

### Шаг 5: Проверьте базу данных

```sql
-- Проверьте, есть ли слово в user_words
SELECT * FROM user_words 
WHERE user_language_profile_id = 'profile-012' 
AND dictionary_id = 'word-3';

-- Проверьте, есть ли слово в dictionaries
SELECT * FROM dictionaries WHERE id = 'word-3';
```

## Пример полного лога успешного предложения

```
[SubmitTranslation] === Начало обработки перевода ===
[SubmitTranslation] Exercise ID: abc-123-def
[SubmitTranslation] Перевод пользователя: быстрый собака
[SubmitTranslation] Exercise найден, target_word_ids: ['word-1', 'word-2', 'word-3']
[SubmitTranslation] Загружено 3 целевых слов из dictionaries
[SubmitTranslation]   - quick (ID: word-1, POS: adjective)
[SubmitTranslation]   - dog (ID: word-2, POS: noun)
[SubmitTranslation]   - run (ID: word-3, POS: verb)
[SubmitTranslation] Lesson ID: lesson-456
[SubmitTranslation] User ID: user-789, Native lang: ru
[SubmitTranslation] Profile ID: profile-012
[SubmitTranslation] Вызываю LLM для оценки перевода...
[MockLLM] === Начало оценки перевода ===
[MockLLM] Предложение: The quick dog runs
[MockLLM] Перевод пользователя: быстрый собака
[MockLLM] Целевых слов: 3
[MockLLM] Profile ID: profile-012
[MockLLM] --- Проверка слова: quick (ID: word-1) ---
[MockLLM] Найдены переводы в БД: ['быстрый', 'скорый']
[MockLLM] ✓ Слово 'quick' переведено ПРАВИЛЬНО
[MockLLM] --- Проверка слова: dog (ID: word-2) ---
[MockLLM] Найдены переводы в БД: ['собака', 'пёс']
[MockLLM] ✓ Слово 'dog' переведено ПРАВИЛЬНО
[MockLLM] --- Проверка слова: run (ID: word-3) ---
[MockLLM] Найдены переводы в БД: ['бежать', 'бегать']
[MockLLM] ✗ Слово 'run' переведено НЕПРАВИЛЬНО
[MockLLM] Проверяем наличие слова 'run' в user_words пользователя...
[MockLLM] Слова 'run' НЕТ в user_words, предлагаем добавить!
[MockLLM] ✓✓✓ Добавлено в suggested_new_words: run (word-3)
[MockLLM] === Результат оценки ===
[MockLLM] Overall correct: False
[MockLLM] Suggested new words: 1 слов
[MockLLM] IDs предложенных слов: ['word-3']
[SubmitTranslation] === Результат от LLM ===
[SubmitTranslation] Overall correct: False
[SubmitTranslation] Suggested new words: ['word-3']
[SubmitTranslation] === Конец обработки перевода ===
```

## Чек-лист для отладки

- [ ] Backend запущен с логированием уровня INFO
- [ ] Frontend открыт с DevTools (Console + Network)
- [ ] Пользователь выполнил урок с ошибкой
- [ ] В логах backend видны сообщения `[SubmitTranslation]`
- [ ] В логах backend видны сообщения `[MockLLM]` или `[GigaChat]`
- [ ] В логах видны сообщения о проверке `user_words`
- [ ] В логах видны сообщения о предложении слов (`✓✓✓`)
- [ ] В ответе API есть `suggested_new_words`
- [ ] На фронтенде отображается блок с предложением
- [ ] В консоли браузера нет ошибок
- [ ] В базе данных слово отсутствует в `user_words`

## Контакты для поддержки

Если проблема не решена, предоставьте:
1. Полные логи backend (от `[SubmitTranslation]` до конца)
2. Скриншот консоли браузера
3. Скриншот Network tab с ответом API
4. Результат SQL запроса к `user_words` и `dictionaries`
