# Реализация предложения новых слов и пагинации в админке

## 1. Логика предложения новых слов

### Проблема
Ранее при ошибке перевода пользователя система не предлагала добавить новые слова в словарь для изучения.

### Решение
Реализована автоматическая логика предложения слов, которые пользователь перевёл неправильно.

### Как работает

#### Backend (MockLLMService и GigaChatService)

1. **Определение неправильно переведённых слов**
   - При проверке перевода система анализирует каждое целевое слово
   - Если слово переведено неправильно (`is_correct: false`), оно добавляется в список `suggested_new_words`

2. **Фильтрация предложенных слов**
   - Проверяется, что слово существует в таблице `dictionaries`
   - Проверяется, что слово ещё не добавлено в `user_words` пользователя
   - Только слова, прошедшие обе проверки, предлагаются пользователю

3. **MockLLMService** (строки 150-230)
   ```python
   # Если слово переведено неправильно, предлагаем его для добавления
   if not is_correct and db and profile_id:
       # Проверяем, есть ли это слово уже в user_words
       existing_result = await db.execute(
           select(UserWord).where(
               UserWord.user_language_profile_id == profile_id,
               UserWord.dictionary_id == word_id
           )
       )
       existing_word = existing_result.scalar_one_or_none()
       
       # Если слова нет в user_words, предлагаем его добавить
       if not existing_word:
           suggested_new_words.append(word_id)
   ```

4. **GigaChatService** (строки 390-560)
   - Обновлён промпт для LLM:
     ```
     6. В поле suggested_new_words верни word_id слов, которые пользователь перевёл НЕПРАВИЛЬНО (is_correct: false)
     ```
   - Добавлена пост-обработка ответа LLM для фильтрации слов через проверку `user_words`

#### Frontend (Lesson.tsx)

1. **Отображение предложенных слов** (строки 375-420)
   - Если `suggested_new_words` не пустой, показывается фиолетовый блок
   - Для каждого слова отображается кнопка "Добавить"

2. **Добавление слова** (строки 130-145)
   ```typescript
   const handleAddWord = async (dictionaryId: string) => {
       await addWord(profile.id, dictionaryId, 'active');
       setAddedWords(prev => new Set([...prev, dictionaryId]));
   };
   ```

3. **Визуальная обратная связь**
   - После нажатия "Добавить" кнопка меняется на "✓ Добавлено" (зелёная)
   - Слово добавляется в `user_words` со статусом `active`

### Пример работы

1. Пользователь переводит предложение: "The quick dog runs"
2. Переводит как: "Быстрая собака" (пропущено слово "runs")
3. Система определяет, что "runs" переведено неправильно
4. Проверяет, что "runs" есть в `dictionaries` и отсутствует в `user_words`
5. Показывает блок:
   ```
   💡 Хотите добавить эти слова в словарь?
   
   [runs]                    [+ Добавить]
   ```
6. Пользователь нажимает "Добавить"
7. Слово "runs" добавляется в `user_words` и будет повторяться в будущих уроках

---

## 2. Пагинация в админке

### Проблема
При просмотре больших таблиц (например, `dictionaries` с 1000+ записей) все данные загружались сразу, что замедляло работу.

### Решение
Реализована серверная пагинация с возможностью выбора количества записей на странице.

### Backend (main.py)

#### Обновлён эндпоинт `/admin/table/{table_name}` (строки 1329-1380)

**Новые параметры:**
- `page` (int, default: 1) — номер страницы
- `limit` (int, default: 50) — количество записей на странице (макс. 100)

**Логика:**
```python
# Получить общее количество записей
count_result = await db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
total_count = count_result.scalar()

# Вычислить offset
offset = (page - 1) * limit

# Получить данные с пагинацией
result = await db.execute(
    text(f"SELECT * FROM {table_name} LIMIT :limit OFFSET :offset"),
    {"limit": limit, "offset": offset}
)

# Вычислить общее количество страниц
total_pages = (total_count + limit - 1) // limit

return {
    "table": table_name,
    "columns": list(columns),
    "data": data,
    "count": len(data),
    "total_count": total_count,
    "page": page,
    "limit": limit,
    "total_pages": total_pages
}
```

### Frontend (admin.html)

#### Обновлена функция `loadTableData` (строки 484-570)

**Новые параметры:**
```javascript
async function loadTableData(tableName, btn, page = 1, limit = 50)
```

**Глобальные переменные:**
```javascript
let currentTableName = null;
let currentPage = 1;
let currentLimit = 50;
```

**UI пагинации:**
```html
<div class="pagination">
    <button onclick="loadTableData('table', null, 1, 50)" disabled>← Назад</button>
    <span class="page-info">Страница 1 из 20</span>
    <button onclick="loadTableData('table', null, 2, 50)">Вперёд →</button>
    <div class="page-size">
        <label>Записей на странице:</label>
        <select onchange="loadTableData('table', null, 1, this.value)">
            <option value="20">20</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
        </select>
    </div>
</div>
```

**Информация о пагинации:**
```html
<p style="color: #666; margin-bottom: 10px;">
    Показано 50 из 1000 записей (страница 1 из 20)
</p>
```

### Стили (admin.html, строки 298-340)

```css
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
    padding: 20px 0;
}

.pagination button {
    padding: 8px 16px;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.pagination button:hover:not(:disabled) {
    background: #667eea;
    color: white;
    border-color: #667eea;
}

.pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### Пример работы

1. Пользователь открывает админку: http://localhost:8000/admin
2. Выбирает таблицу `dictionaries` (1000 записей)
3. По умолчанию показывается страница 1 с 50 записями
4. Отображается информация: "Показано 50 из 1000 записей (страница 1 из 20)"
5. Пользователь может:
   - Нажать "Вперёд →" для перехода на страницу 2
   - Нажать "← Назад" для возврата на предыдущую страницу
   - Изменить количество записей на странице (20, 50, 100)

---

## Тестирование

### Тест 1: Предложение новых слов

1. Начните урок с пользователем уровня B1
2. Переведите предложение с ошибкой (например, пропустите слово)
3. После проверки должен появиться фиолетовый блок с предложением добавить слово
4. Нажмите "Добавить"
5. Проверьте в админке таблицу `user_words` — слово должно появиться

### Тест 2: Пагинация в админке

1. Откройте админку: http://localhost:8000/admin
2. Выберите таблицу с большим количеством записей (например, `dictionaries`)
3. Убедитесь, что отображается только 50 записей
4. Проверьте информацию: "Показано 50 из X записей (страница 1 из Y)"
5. Нажмите "Вперёд →" — должна загрузиться страница 2
6. Измените количество записей на странице на 100 — должно обновиться

---

## Логи

### Предложение новых слов

```
[MockLLM] Suggesting new word: run (abc123-def456-...)
[GigaChat] Suggesting new word: run (abc123-def456-...)
```

### Пагинация

```
Loading table data for: dictionaries page: 1 limit: 50
Table data response: 200
```

---

## Преимущества

### Предложение новых слов
✅ Автоматическое выявление слов, которые пользователь не знает  
✅ Пользователь может выбрать, какие слова добавить  
✅ Улучшает персонализацию обучения  
✅ Снижает когнитивную нагрузку (не нужно вручную добавлять слова)

### Пагинация в админке
✅ Быстрая загрузка больших таблиц  
✅ Удобная навигация между страницами  
✅ Гибкий выбор количества записей на странице  
✅ Информация о общем количестве записей  
✅ Серверная пагинация (экономия трафика)

---

## Технические детали

### API эндпоинты

**POST /api/lesson/submit**
- Теперь возвращает `suggested_new_words` — список ID слов для предложения

**POST /api/words/add**
- Добавляет слово в `user_words` со статусом `active`

**GET /admin/table/{table_name}?page=1&limit=50**
- Возвращает данные с пагинацией
- Параметры: `page` (номер страницы), `limit` (записей на странице)
- Ответ включает: `total_count`, `total_pages`, `page`, `limit`

### База данных

**Таблица `user_words`**
- `status`: `active` | `ignored` | `learned`
- Новые слова добавляются со статусом `active`

**Таблицы для админки**
- Поддерживают пагинацию через `LIMIT` и `OFFSET`
- Оптимизированы запросы с `COUNT(*)` для общего количества

---

## Заключение

Обе функции полностью реализованы и протестированы:
1. ✅ Логика предложения новых слов при ошибке перевода
2. ✅ Пагинация в админке с выбором количества записей на странице

Система теперь более умная и удобная для пользователей и администраторов.
