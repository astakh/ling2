# Настройка лимита уроков в день

## Что было изменено

Слайдер "Уроков в день" в профиле пользователя теперь использует максимальное значение из переменной окружения `MAX_LESSONS` вместо захардкоженного значения 10.

## Изменения в коде

### Backend

#### 1. Валидация лимита уроков (backend/main.py)

**Было:**
```python
if req.daily_lesson_limit < 1 or req.daily_lesson_limit > 10:
    raise HTTPException(status_code=400, detail="Daily lesson limit must be between 1 and 10")
```

**Стало:**
```python
if req.daily_lesson_limit < 1 or req.daily_lesson_limit > settings.MAX_LESSONS:
    raise HTTPException(status_code=400, detail=f"Daily lesson limit must be between 1 and {settings.MAX_LESSONS}")
```

#### 2. Конфигурация (backend/config.py)

```python
MAX_LESSONS: int = 100  # Максимальное количество уроков в день (лимит для пользователя)
```

#### 3. Пример .env (backend/.env.example)

```env
# Spaced repetition parameters
# Максимальное количество уроков в день (лимит для пользователя)
MAX_LESSONS=100
```

### Frontend

#### 1. API клиент (src/services/api.ts)

**Добавлена функция:**
```typescript
export async function getMaxLessons(): Promise<{ max_lessons: number }> {
  return request('/config/max-lessons');
}
```

#### 2. Страница профиля (src/pages/Profile.tsx)

**Добавлено состояние:**
```typescript
const [systemMaxLessons, setSystemMaxLessons] = useState(100);
```

**Загрузка конфигурации:**
```typescript
// Load system max lessons from config
try {
  const config = await getMaxLessons();
  setSystemMaxLessons(config.max_lessons);
} catch (err) {
  console.error('Failed to load max lessons config:', err);
}
```

**Обновлён слайдер:**
```tsx
<input
  type="range"
  min="1"
  max={systemMaxLessons}  // Было: max="10"
  value={dailyLessons}
  onChange={(e) => setDailyLessons(Number(e.target.value))}
  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
/>
<div className="flex justify-between items-center">
  <span className="text-sm text-gray-500">1 урок</span>
  <span className="text-2xl font-bold text-indigo-600">{dailyLessons}</span>
  <span className="text-sm text-gray-500">{systemMaxLessons} уроков</span>  // Было: "10 уроков"
</div>
```

#### 3. Backend API (backend/main.py)

**Добавлен эндпоинт:**
```python
@app.get("/api/config/max-lessons")
async def get_max_lessons():
    """Получить максимальное количество уроков из конфигурации"""
    return {
        "max_lessons": settings.MAX_LESSONS
    }
```

## Как использовать

### Для администратора

1. Откройте `backend/.env`
2. Измените значение `MAX_LESSONS`:
   ```env
   MAX_LESSONS=50  # или другое значение
   ```
3. Перезапустите backend:
   ```bash
   # Остановите текущий процесс (Ctrl+C)
   python main.py
   ```

### Для пользователя

1. Откройте страницу профиля (иконка шестерёнки на Dashboard)
2. Найдите секцию "Уроков в день"
3. Переместите ползунок в нужное положение (от 1 до MAX_LESSONS)
4. Нажмите "Сохранить настройки"

## Примеры

### Сценарий 1: Стандартная настройка

**backend/.env:**
```env
MAX_LESSONS=100
```

**Результат:**
- Пользователь может установить от 1 до 100 уроков в день
- Слайдер показывает: "1 урок ━━━━━●━━━━━ 100 уроков"

### Сценарий 2: Ограниченная настройка

**backend/.env:**
```env
MAX_LESSONS=10
```

**Результат:**
- Пользователь может установить от 1 до 10 уроков в день
- Слайдер показывает: "1 урок ━━━━━●━━━━━ 10 уроков"

### Сценарий 3: Интенсивная настройка

**backend/.env:**
```env
MAX_LESSONS=50
```

**Результат:**
- Пользователь может установить от 1 до 50 уроков в день
- Слайдер показывает: "1 урок ━━━━━●━━━━━ 50 уроков"

## Логи

При запуске backend в логах отображается:

```
Spaced Repetition Configuration:
  MAX_LESSONS: 100
  WORDS_PER_LESSON: 5
  REPETITION_INTERVALS: 1,2,4,7,14,21,30,45,60,90
```

При обновлении профиля:

```
[Profile Update] Updated daily_lesson_limit to 15
```

## Преимущества

✅ **Гибкость** - администратор может настроить лимит под разные сценарии  
✅ **Контроль** - ограничение на уровне системы, а не кода  
✅ **Прозрачность** - пользователь видит максимальное значение  
✅ **Масштабируемость** - легко изменить без перекомпиляции  
✅ **Персонализация** - разные пользователи могут иметь разные лимиты

## Технические детали

### API эндпоинт

**GET /api/config/max-lessons**

Возвращает максимальное количество уроков из конфигурации.

**Ответ:**
```json
{
  "max_lessons": 100
}
```

### Валидация

Backend проверяет, что значение `daily_lesson_limit` находится в диапазоне от 1 до `settings.MAX_LESSONS`.

**Пример ошибки:**
```json
{
  "detail": "Daily lesson limit must be between 1 and 100"
}
```

### Хранение в БД

**Таблица `user_language_profiles`:**
```sql
daily_lesson_limit INTEGER DEFAULT 3
```

Значение хранится в профиле пользователя и может быть изменено через API.

## Заключение

Настройка лимита уроков в день теперь полностью управляется через переменную окружения `MAX_LESSONS`. Администратор может легко изменить максимальное значение без изменения кода, а пользователь видит актуальный лимит в своём профиле.
