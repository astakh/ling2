# Настройка максимального количества уроков

## Обзор

Пользователи теперь могут настраивать максимальное количество уроков (stage) для достижения полного mastery слов. Это значение ограничено системным параметром `MAX_LESSONS` из файла `.env`.

## Как это работает

### Системный уровень (backend/.env)

```env
MAX_LESSONS=100
```

Это максимальное значение, которое может установить пользователь. Изменяется администратором.

### Пользовательский уровень (Profile.tsx)

Пользователь может установить своё персональное значение от 10 до `MAX_LESSONS` (по умолчанию 100).

## Изменения в коде

### Backend

#### 1. Модель `UserLanguageProfile` (backend/models.py)

Добавлено поле:
```python
max_lessons = Column(Integer, nullable=True)  # Максимальное количество уроков для пользователя
```

#### 2. API эндпоинты (backend/main.py)

**GET /api/config/max-lessons**
```python
@app.get("/api/config/max-lessons")
async def get_max_lessons():
    """Получить максимальное количество уроков из конфигурации"""
    return {
        "max_lessons": settings.MAX_LESSONS
    }
```

**PUT /api/profile/{profile_id}**
- Добавлена обработка поля `max_lessons`
- Валидация: значение должно быть от 1 до `settings.MAX_LESSONS`

```python
if req.max_lessons is not None:
    if req.max_lessons < 1 or req.max_lessons > settings.MAX_LESSONS:
        raise HTTPException(status_code=400, detail=f"Max lessons must be between 1 and {settings.MAX_LESSONS}")
    profile.max_lessons = req.max_lessons
```

#### 3. Миграция БД (backend/migrations/add_max_lessons.sql)

```sql
ALTER TABLE user_language_profiles
ADD COLUMN IF NOT EXISTS max_lessons INTEGER;

UPDATE user_language_profiles
SET max_lessons = 100
WHERE max_lessons IS NULL;
```

### Frontend

#### 1. API клиент (src/services/api.ts)

**Добавлена функция:**
```typescript
export async function getMaxLessons(): Promise<{ max_lessons: number }> {
  return request('/config/max-lessons');
}
```

**Обновлён тип Profile:**
```typescript
export interface Profile {
  // ... другие поля
  max_lessons?: number;
}
```

**Обновлена функция updateProfile:**
```typescript
export async function updateProfile(
  profileId: string,
  data: {
    cefr_level?: string;
    words_per_lesson_limit?: number;
    daily_lesson_limit?: number;
    max_lessons?: number;  // Новое поле
  }
): Promise<Profile>
```

#### 2. Типы (src/types.ts)

**Обновлён интерфейс UserLanguageProfile:**
```typescript
export interface UserLanguageProfile {
  // ... другие поля
  maxLessons?: number;
}
```

#### 3. Страница профиля (src/pages/Profile.tsx)

**Добавлены состояния:**
```typescript
const [maxLessons, setMaxLessons] = useState(100);
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

**UI компонент:**
```tsx
{/* Max Lessons */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.45 }}
  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
>
  <div className="flex items-center gap-2 mb-4">
    <Award className="w-5 h-5 text-indigo-500" />
    <h3 className="text-lg font-semibold text-gray-800">Максимум уроков</h3>
  </div>
  <div className="space-y-4">
    <input
      type="range"
      min="10"
      max={systemMaxLessons}
      step="10"
      value={maxLessons}
      onChange={(e) => setMaxLessons(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
    />
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">10 уроков</span>
      <span className="text-2xl font-bold text-indigo-600">{maxLessons}</span>
      <span className="text-sm text-gray-500">{systemMaxLessons} уроков</span>
    </div>
    <p className="text-sm text-gray-500 text-center">
      Максимальное количество уроков для достижения полного mastery
    </p>
  </div>
</motion.div>
```

## Как использовать

### Для администратора

1. Откройте `backend/.env`
2. Измените значение `MAX_LESSONS`:
   ```env
   MAX_LESSONS=150  # или другое значение
   ```
3. Перезапустите backend

### Для пользователя

1. Откройте страницу профиля (иконка шестерёнки на Dashboard)
2. Найдите секцию "Максимум уроков"
3. Переместите ползунок в нужное положение (от 10 до системного максимума)
4. Нажмите "Сохранить настройки"

## Применение параметра

Параметр `max_lessons` используется в логике spaced repetition:

```python
# При правильном переводе
if is_correct:
    user_word.stage = min(user_word.stage + 1, profile.max_lessons or settings.MAX_LESSONS)
    interval = intervals[min(user_word.stage, len(intervals) - 1)]
    user_word.due_lesson_number = current_lesson + interval
```

Когда `stage` достигает `max_lessons`, слово считается полностью выученным и больше не повторяется.

## Миграция базы данных

Для применения изменений к существующей базе данных:

```bash
cd backend
psql -h your-server-ip -U lingoflow -d lingoflow -f migrations/add_max_lessons.sql
```

Или выполните SQL вручную:

```sql
ALTER TABLE user_language_profiles
ADD COLUMN IF NOT EXISTS max_lessons INTEGER;

UPDATE user_language_profiles
SET max_lessons = 100
WHERE max_lessons IS NULL;
```

## Примеры использования

### Сценарий 1: Начинающий пользователь

- **MAX_LESSONS** (в .env): 100
- **max_lessons** (в профиле): 30
- **Результат**: Пользователь хочет достичь mastery за 30 уроков вместо 100

### Сценарий 2: Продвинутый пользователь

- **MAX_LESSONS** (в .env): 100
- **max_lessons** (в профиле): 100
- **Результат**: Пользователь использует стандартную систему

### Сценарий 3: Администратор меняет системный лимит

- **MAX_LESSONS** (в .env): 150
- **max_lessons** (в профиле): 100 (было)
- **Результат**: Пользователь теперь может установить до 150 уроков

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
[Profile Update] Updated max_lessons to 50
```

## Преимущества

✅ **Гибкость** - пользователи могут настроить систему под себя  
✅ **Мотивация** - чёткая цель для достижения mastery  
✅ **Контроль** - администратор может ограничить максимальное значение  
✅ **Персонализация** - разные пользователи могут иметь разные цели  
✅ **Прозрачность** - пользователь видит системный лимит

## Технические детали

### Хранение в БД

**Таблица `user_language_profiles`:**
```sql
max_lessons INTEGER  -- NULL означает использование системного значения
```

### Логика fallback

Если `profile.max_lessons` не установлен (NULL), используется `settings.MAX_LESSONS`:

```python
effective_max_lessons = profile.max_lessons or settings.MAX_LESSONS
```

### Валидация

- Минимум: 10 уроков
- Максимум: `settings.MAX_LESSONS` (из .env)
- Шаг: 10 уроков

## Заключение

Настройка максимального количества уроков позволяет пользователям персонализировать систему обучения под свои цели и возможности. Системный лимит из `.env` обеспечивает контроль со стороны администратора.
