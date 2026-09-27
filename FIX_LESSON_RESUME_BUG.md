# Исправление проблемы с возобновлением урока

## Проблема

При нажатии "Начать урок" на Dashboard система возобновляла старый урок вместо создания нового, даже когда пользователь хотел начать новый урок.

### Симптомы

В логах backend:
```
[Lesson Start] profile_id=xxx, force_new=False
[LessonService] ✅ Найден существующий урок: xxx
[LessonService] ⏭️ ВОЗВРАЩАЕМ СУЩЕСТВУЮЩИЙ УРОК (resumed=True)
[Lesson Start] ⏭️ Это ВОЗОБНОВЛЕНИЕ урока - новые слова не собираются
[Lesson Start] ❌ НЕТ НОВЫХ СЛОВ ДЛЯ ПРЕДСТАВЛЕНИЯ!
```

## Причина

Проблема была в том, что `Lesson.tsx` при монтировании компонента вызывал `startLesson()` БЕЗ параметра `force_new`, что приводило к возобновлению существующего урока.

**Цепочка вызовов:**
1. Пользователь нажимает "Начать урок" на Dashboard
2. Dashboard вызывает `startLesson(true)` с `force_new=true` ✅
3. Backend создаёт новый урок
4. Frontend переходит на `/lesson`
5. **Lesson.tsx монтируется и вызывает `startLesson()` БЕЗ параметра** ❌
6. Backend находит существующий урок и возобновляет его
7. Новые слова не представляются пользователю

## Решение

Изменена логика передачи данных урока между Dashboard и Lesson:

### 1. Dashboard сохраняет данные урока в sessionStorage

```typescript
// Dashboard.tsx
const handleStartLesson = async () => {
  const session = await startLesson(true); // force_new=true
  
  // Сохраняем данные урока в sessionStorage для Lesson.tsx
  sessionStorage.setItem('currentLesson', JSON.stringify(session));
  
  navigate('/lesson');
};
```

### 2. Lesson получает данные из sessionStorage

```typescript
// Lesson.tsx
useEffect(() => {
  // Получаем данные урока из sessionStorage (установлены в Dashboard)
  const lessonData = sessionStorage.getItem('currentLesson');
  if (lessonData) {
    const session = JSON.parse(lessonData);
    setupLesson(session);
  } else {
    navigate('/dashboard');
  }
}, []);
```

### 3. Lesson очищает sessionStorage после завершения

```typescript
// Lesson.tsx
const handleNext = async () => {
  const nextIndex = exerciseIndex + 1;
  if (nextIndex >= exercises.length) {
    // All exercises done - complete the lesson
    await completeLesson(lesson.id);
    
    // Очищаем sessionStorage после завершения урока
    sessionStorage.removeItem('currentLesson');
    
    navigate('/complete');
  }
};
```

## Преимущества решения

✅ **Нет повторных вызовов API** - Lesson не вызывает startLesson повторно  
✅ **Быстрая загрузка** - данные берутся из sessionStorage, а не из API  
✅ **Корректная логика** - новые слова представляются только при создании нового урока  
✅ **Сохранение прогресса** - если пользователь вышел из урока, данные сохраняются в sessionStorage  
✅ **Очистка после завершения** - sessionStorage очищается после завершения урока  

## Как это работает теперь

### Сценарий 1: Новый урок

1. Пользователь нажимает "Начать урок" на Dashboard
2. Dashboard вызывает `startLesson(true)` с `force_new=true`
3. Backend создаёт новый урок с новыми словами
4. Dashboard сохраняет данные урока в sessionStorage
5. Frontend переходит на `/lesson`
6. Lesson.tsx получает данные из sessionStorage
7. Показывается экран с новыми словами
8. Пользователь нажимает "Начать урок"
9. Показывается основной экран урока

### Сценарий 2: Возврат к незавершённому уроку

1. Пользователь начал урок, но не завершил
2. Нажал кнопку "Назад" (стрелка влево)
3. Вернулся на Dashboard
4. Нажал "Начать урок" снова
5. Dashboard вызывает `startLesson(true)` с `force_new=true`
6. Backend создаёт НОВЫЙ урок (старый помечается как abandoned)
7. Dashboard сохраняет данные нового урока в sessionStorage
8. Показывается экран с новыми словами нового урока

### Сценарий 3: Завершение урока

1. Пользователь завершил все упражнения
2. Lesson.tsx вызывает `completeLesson(lesson.id)`
3. Lesson.tsx очищает sessionStorage
4. Frontend переходит на `/complete`
5. Показывается экран завершения урока

## Логи

### Успешное создание нового урока

```
[Dashboard] Starting lesson...
[LessonService] startLesson() called, forceNew: true
[LessonService] Calling API startLesson with forceNew: true
[API] Request: /lesson/start {method: 'POST', body: '{"profile_id":"xxx","force_new":true}'}
[Lesson Start] === НАЧАЛО СОЗДАНИЯ УРОКА ===
[Lesson Start] profile_id=xxx, force_new=true
[LessonService] force_new=True - пропускаем проверку существующих уроков
[LessonService] ✅ Найдено 3 новых слов
[LessonService] resumed: False
[Lesson Start] Новых слов для представления: 3
[Dashboard] Saving lesson data to sessionStorage
[Dashboard] Navigating to /lesson
[Lesson] Component mounted
[Lesson] Loading lesson from sessionStorage
[Lesson] New words to show: [...]
```

### Завершение урока

```
[Lesson] All exercises done, completing lesson...
[LessonService] Completing lesson: xxx
[Lesson] Lesson completed: {...}
[Lesson] Clearing sessionStorage
```

## Тестирование

### Тест 1: Новый урок с новыми словами

1. Откройте Dashboard
2. Нажмите "Начать урок"
3. Проверьте логи backend - должно быть `force_new=true`
4. Должен появиться экран с новыми словами
5. Нажмите "Начать урок"
6. Должен появиться основной экран урока

### Тест 2: Возврат к уроку

1. Начните урок
2. Нажмите кнопку "Назад" (стрелка влево)
3. Подтвердите выход
4. Вернитесь на Dashboard
5. Нажмите "Начать урок" снова
6. Должен создаться НОВЫЙ урок с новыми словами

### Тест 3: Завершение урока

1. Завершите все упражнения в уроке
2. Проверьте, что sessionStorage очищен
3. Должен появиться экран завершения урока
4. Нажмите "На главную"
5. Нажмите "Начать урок" снова
6. Должен создаться НОВЫЙ урок

## Проверка sessionStorage

В консоли браузера (F12 → Console):

```javascript
// Проверить наличие данных урока
sessionStorage.getItem('currentLesson');

// Очистить данные вручную
sessionStorage.removeItem('currentLesson');
```

## Заключение

Проблема с возобновлением урока решена. Теперь Lesson.tsx не вызывает API повторно, а получает данные из sessionStorage. Это обеспечивает:
- Корректную работу с новыми уроками
- Представление новых слов пользователю
- Быструю загрузку страницы урока
- Сохранение прогресса при выходе из урока
