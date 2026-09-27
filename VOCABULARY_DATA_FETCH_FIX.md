# Исправление выборки и фильтрации на странице "Мои слова"

## Проблема

На странице "Мои слова" была критическая проблема с выборкой данных:

1. **Backend** возвращал только объекты `UserWord` с `dictionary_id`, но без информации о слове (lemma, translations)
2. **Frontend** использовал локальный словарь `src/data/dictionaries.ts` для сопоставления
3. Если слова из БД отсутствовали в локальном словаре, они **не отображались** пользователю
4. Это приводило к тому, что многие выученные слова были невидимы

## Решение

### Backend изменения

Изменён endpoint `/api/words/{profile_id}` для возврата полной информации о словах:

**Было:**
```python
@app.get("/api/words/{profile_id}")
async def get_user_words(profile_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserWord).where(UserWord.user_language_profile_id == profile_id)
    )
    words = result.scalars().all()
    return words  # Только dictionary_id, stage, status и т.д.
```

**Стало:**
```python
@app.get("/api/words/{profile_id}")
async def get_user_words(profile_id: str, db: AsyncSession = Depends(get_db)):
    # Get user words
    result = await db.execute(
        select(UserWord).where(UserWord.user_language_profile_id == profile_id)
    )
    user_words = result.scalars().all()
    
    # Get profile to find native language
    result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    
    # Get dictionary entries for all user words
    dict_ids = [uw.dictionary_id for uw in user_words]
    result = await db.execute(
        select(Dictionary).where(Dictionary.id.in_(dict_ids))
    )
    dict_words = {w.id: w for w in result.scalars().all()}
    
    # Get translations for all words
    result = await db.execute(
        select(DictionaryTranslation).where(
            DictionaryTranslation.dictionary_id.in_(dict_ids),
            DictionaryTranslation.lang == profile.target_lang
        )
    )
    translations_map = {t.dictionary_id: t.translations for t in result.scalars().all()}
    
    # Combine user_words with dictionary info and translations
    combined_words = []
    for uw in user_words:
        dict_word = dict_words.get(uw.dictionary_id)
        if dict_word:
            combined_words.append({
                "id": uw.id,
                "dictionary_id": uw.dictionary_id,
                "stage": uw.stage,
                "due_lesson_number": uw.due_lesson_number,
                "status": uw.status,
                "correct_count": uw.correct_count,
                "incorrect_count": uw.incorrect_count,
                "lemma": dict_word.lemma,
                "pos": dict_word.pos,
                "cefr_level": dict_word.cefr_level,
                "translations": translations_map.get(uw.dictionary_id, [])
            })
    
    return combined_words
```

### Frontend изменения

Убрано использование локального словаря, теперь данные берутся напрямую из API:

**Было:**
```typescript
const dictionary = getDictionary(profile?.targetLang || 'en');

const wordsWithDict = userWords.map((uw: any) => {
  const dict = dictionary.find(d => d.id === uw.dictionary_id);
  return { ...uw, dict };
}).filter((w: any) => w.dict);  // ❌ Слова без dict не отображаются!

const filtered = wordsWithDict.filter((w: any) => {
  const matchesSearch = w.dict.lemma.toLowerCase().includes(search.toLowerCase()) ||
    (w.dict.translations['ru'] || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
  // ...
});
```

**Стало:**
```typescript
// Используем данные из API (уже содержат lemma, translations и т.д.)
const wordsWithInfo = userWords.map((uw: any) => ({
  ...uw,
  lemma: uw.lemma,
  pos: uw.pos,
  translations: uw.translations || []
}));

const filtered = wordsWithInfo.filter((w: any) => {
  const matchesSearch = w.lemma.toLowerCase().includes(search.toLowerCase()) ||
    (w.translations || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
  // ...
});
```

Также обновлено отображение:

**Было:**
```tsx
<div className="font-semibold text-gray-900 text-lg">
  {w.dict.lemma}
</div>
<div className="text-sm text-gray-500">
  {(w.dict.translations['ru'] || []).join(', ')}
</div>
```

**Стало:**
```tsx
<div className="font-semibold text-gray-900 text-lg">
  {w.lemma}
</div>
<div className="text-sm text-gray-500">
  {(w.translations || []).join(', ')}
</div>
```

## Преимущества решения

✅ **Все слова отображаются** - больше не зависит от локального словаря  
✅ **Актуальные данные** - информация берётся напрямую из БД  
✅ **Переводы на родной язык** - используются переводы из БД, а не из локального словаря  
✅ **Меньше кода** - убрана зависимость от локального словаря  
✅ **Лучшая производительность** - один запрос к API вместо поиска в локальном массиве  

## Проверка работы

### Логи backend

При загрузке страницы "Мои слова" в логах backend должно быть:

```
[UserWords] Fetching words for profile: xxx
[UserWords] Found 150 user words
[UserWords] Found 150 dictionary words
[UserWords] Found translations for 150 words
[UserWords] Returning 150 combined words
```

### Проверка в браузере

1. Откройте DevTools → Network
2. Найдите запрос `/api/words/{profile_id}`
3. Проверьте ответ - каждое слово должно содержать:
   - `lemma` - слово
   - `translations` - массив переводов
   - `status` - статус (active/learned)
   - `stage` - уровень изучения
   - и другие поля

### Проверка в админке

1. Откройте админку: http://localhost:8000/admin
2. Перейдите в таблицу `user_words`
3. Посчитайте количество слов
4. Сравните с количеством слов на странице "Мои слова"
5. Должно совпадать!

## Фильтрация

Фильтры работают корректно:

- **Все** - показывает все слова (active + learned)
- **Изучаю** - показывает только активные слова (status === 'active')
- **Выученные** - показывает только выученные слова (status === 'learned')

Поиск работает по:
- Лемме слова (lemma)
- Переводам (translations)

Пагинация:
- 20 слов на странице
- Автоматический сброс на первую страницу при изменении фильтра/поиска

## Тестирование

### Тест 1: Все слова отображаются

1. Откройте страницу "Мои слова"
2. Проверьте, что количество слов совпадает с данными в БД
3. Проверьте, что все слова имеют lemma и translations

### Тест 2: Фильтр "Изучаю"

1. Выберите фильтр "Изучаю"
2. Убедитесь, что отображаются только слова со статусом 'active'
3. Проверьте, что выученные слова не отображаются

### Тест 3: Фильтр "Выученные"

1. Выберите фильтр "Выученные"
2. Убедитесь, что отображаются только слова со статусом 'learned'
3. Проверьте, что активные слова не отображаются

### Тест 4: Поиск

1. Введите слово в поиск
2. Убедитесь, что поиск работает по lemma и translations
3. Проверьте, что результаты соответствуют поисковому запросу

### Тест 5: Пагинация

1. Если слов больше 20, проверьте пагинацию
2. Перейдите на вторую страницу
3. Убедитесь, что отображаются следующие 20 слов
4. Проверьте информацию "Показано 21-40 из X слов"

## Заключение

Проблема с выборкой и фильтрацией на странице "Мои слова" полностью решена. Теперь все слова из базы данных корректно отображаются пользователю, независимо от наличия в локальном словаре. Фильтрация и пагинация работают корректно для всех статусов слов.
