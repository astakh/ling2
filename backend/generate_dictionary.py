#!/usr/bin/env python3
"""
Скрипт для пополнения словаря через GigaChat API

Использование:
    python generate_dictionary.py                    # Все языки, все уровни
    python generate_dictionary.py --lang en          # Только английский
    python generate_dictionary.py --level A1         # Только уровень A1
    python generate_dictionary.py --count 50         # 50 слов за запрос
    python generate_dictionary.py --dry-run          # Только показать, что будет добавлено
"""
import asyncio
import sys
import uuid
import json
import argparse
import httpx
import urllib3
from pathlib import Path

# Подавить SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Добавить backend в путь
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, text
from config import settings
from models import Dictionary, DictionaryTranslation

# ==================== ПРОМПТ ДЛЯ ГЕНЕРАЦИИ СЛОВАРЯ ====================

DICTIONARY_PROMPT_TEMPLATE = """Ты — лингвист-эксперт. Сгенерируй список слов для изучения языка.

Требования:
1. Язык изучения: {target_lang_name} ({target_lang})
2. Уровень CEFR: {cefr_level}
3. Количество слов: {count}
4. Родной язык пользователя: русский

Для каждого слова укажи:
- lemma — начальная форма слова
- pos — часть речи (noun, verb, adjective, adverb, preposition, pronoun, conjunction)
- cefr_level — уровень ({cefr_level})
- translations — массив переводов на русский (2-3 варианта)

Распределение частей речи:
- 40% nouns (существительные)
- 30% verbs (глаголы)
- 20% adjectives (прилагательные)
- 10% другие части речи

Требования к словам:
- Слова должны быть практичными и часто используемыми
- Переводы должны быть точными
- Для глаголов — инфинитив
- Для существительных — единственное число
- Для прилагательных — мужской род (если применимо)

Верни ТОЛЬКО JSON в формате:
{{
    "words": [
        {{
            "lemma": "слово",
            "pos": "noun",
            "cefr_level": "{cefr_level}",
            "translations": ["перевод1", "перевод2"]
        }}
    ]
}}

Не добавляй никакого текста до или после JSON."""

# Названия языков
LANG_NAMES = {
    "en": "English",
    "de": "Deutsch",
    "es": "Español",
    "fr": "Français",
}

# Уровни CEFR
CEFR_LEVELS = ["A1", "A2", "B1", "B2"]


async def get_gigachat_token() -> str:
    """Получить токен доступа GigaChat"""
    import time
    
    auth_header = settings.GIGACHAT_CREDENTIALS
    if not auth_header.startswith("Basic "):
        auth_header = f"Basic {auth_header}"
    
    async with httpx.AsyncClient(verify=False) as client:
        response = await client.post(
            settings.GIGACHAT_OAUTH_URL,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "RqUID": str(uuid.uuid4()),
                "Authorization": auth_header,
            },
            data={"scope": settings.GIGACHAT_SCOPE},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        return data["access_token"]


async def generate_words(token: str, target_lang: str, cefr_level: str, count: int = 30) -> list:
    """Сгенерировать слова через GigaChat"""
    prompt = DICTIONARY_PROMPT_TEMPLATE.format(
        target_lang=LANG_NAMES.get(target_lang, target_lang),
        target_lang_name=target_lang,
        cefr_level=cefr_level,
        count=count,
    )
    
    print(f"  Генерация {count} слов для {LANG_NAMES.get(target_lang, target_lang)} ({cefr_level})...")
    
    async with httpx.AsyncClient(verify=False) as client:
        response = await client.post(
            f"{settings.GIGACHAT_API_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "LingoFlow/1.0",
            },
            json={
                "model": settings.GIGACHAT_MODEL,
                "messages": [
                    {"role": "system", "content": "Ты — лингвист-эксперт. Отвечай строго в формате JSON без дополнительного текста."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 3000,
            },
            timeout=60.0,
        )
        
        if response.status_code != 200:
            print(f"  Ошибка API: {response.status_code} - {response.text}")
            return []
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        # Парсим JSON
        try:
            result = json.loads(content)
            words = result.get("words", [])
            print(f"  Сгенерировано {len(words)} слов")
            return words
        except json.JSONDecodeError:
            # Попробовать извлечь JSON
            import re
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group())
                    words = result.get("words", [])
                    print(f"  Извлечено {len(words)} слов из текста")
                    return words
                except json.JSONDecodeError:
                    pass
            
            print(f"  Ошибка парсинга JSON")
            return []


async def add_words_to_db(session: AsyncSession, target_lang: str, words: list, dry_run: bool = False) -> dict:
    """Добавить слова в базу данных"""
    stats = {"added": 0, "skipped": 0, "errors": 0}
    
    for word_data in words:
        try:
            lemma = word_data.get("lemma", "").strip()
            pos = word_data.get("pos", "noun").strip()
            cefr_level = word_data.get("cefr_level", "A1").strip()
            translations = word_data.get("translations", [])
            
            if not lemma:
                stats["errors"] += 1
                continue
            
            # Проверить уникальность
            result = await session.execute(
                select(Dictionary).where(
                    Dictionary.lemma == lemma,
                    Dictionary.pos == pos,
                    Dictionary.target_lang == target_lang,
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                stats["skipped"] += 1
                if not dry_run:
                    continue
            
            if dry_run:
                print(f"    [DRY] Добавлено: {lemma} ({pos}) - {', '.join(translations[:2])}")
                stats["added"] += 1
                continue
            
            # Создать запись в dictionaries
            dict_id = str(uuid.uuid4())
            dict_entry = Dictionary(
                id=dict_id,
                target_lang=target_lang,
                lemma=lemma,
                pos=pos,
                cefr_level=cefr_level,
            )
            session.add(dict_entry)
            await session.flush()
            
            # Создать перевод
            if translations:
                trans_id = str(uuid.uuid4())
                trans_entry = DictionaryTranslation(
                    id=trans_id,
                    dictionary_id=dict_id,
                    lang="ru",
                    translations=translations,
                )
                session.add(trans_entry)
            
            stats["added"] += 1
            
        except Exception as e:
            print(f"    Ошибка добавления '{word_data.get('lemma', '?')}': {e}")
            stats["errors"] += 1
    
    return stats


async def main():
    parser = argparse.ArgumentParser(description='Пополнение словаря через GigaChat')
    parser.add_argument('--lang', type=str, help='Язык (en, de, es, fr). По умолчанию - все')
    parser.add_argument('--level', type=str, help='Уровень CEFR (A1, A2, B1, B2). По умолчанию - все')
    parser.add_argument('--count', type=int, default=30, help='Количество слов за запрос (по умолчанию 30)')
    parser.add_argument('--dry-run', action='store_true', help='Только показать, что будет добавлено')
    args = parser.parse_args()
    
    # Проверка credentials
    if not settings.GIGACHAT_CREDENTIALS or settings.GIGACHAT_CREDENTIALS == "your-gigachat-credentials-here":
        print("❌ GIGACHAT_CREDENTIALS не установлен в .env")
        sys.exit(1)
    
    # Определяем языки и уровни
    languages = [args.lang] if args.lang else list(LANG_NAMES.keys())
    levels = [args.level] if args.level else CEFR_LEVELS
    
    print("=" * 70)
    print("Пополнение словаря через GigaChat")
    print("=" * 70)
    print(f"Языки: {', '.join(languages)}")
    print(f"Уровни: {', '.join(levels)}")
    print(f"Слов за запрос: {args.count}")
    print(f"Режим: {'DRY RUN' if args.dry_run else 'REAL'}")
    print("=" * 70)
    
    # Получить токен
    print("\nПолучение токена GigaChat...")
    try:
        token = await get_gigachat_token()
        print("✅ Токен получен")
    except Exception as e:
        print(f"❌ Ошибка получения токена: {e}")
        sys.exit(1)
    
    # Подключение к БД
    print("\nПодключение к базе данных...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    total_stats = {"added": 0, "skipped": 0, "errors": 0}
    
    async with engine.begin() as session:
        for lang in languages:
            for level in levels:
                print(f"\n{'='*50}")
                print(f"Обработка: {LANG_NAMES.get(lang, lang)} / {level}")
                print(f"{'='*50}")
                
                # Генерация слов
                words = await generate_words(token, lang, level, args.count)
                
                if not words:
                    print("  Нет слов для добавления")
                    continue
                
                # Добавление в БД
                stats = await add_words_to_db(session, lang, words, args.dry_run)
                
                print(f"\n  Результат:")
                print(f"    Добавлено: {stats['added']}")
                print(f"    Пропущено (дубликаты): {stats['skipped']}")
                print(f"    Ошибок: {stats['errors']}")
                
                total_stats["added"] += stats["added"]
                total_stats["skipped"] += stats["skipped"]
                total_stats["errors"] += stats["errors"]
    
    await engine.dispose()
    
    # Итоги
    print("\n" + "=" * 70)
    print("ИТОГО:")
    print(f"  Добавлено слов: {total_stats['added']}")
    print(f"  Пропущено (дубликаты): {total_stats['skipped']}")
    print(f"  Ошибок: {total_stats['errors']}")
    print("=" * 70)
    
    if args.dry_run:
        print("\n⚠️  Это был DRY RUN. Для реального добавления запустите без флага --dry-run")


if __name__ == "__main__":
    asyncio.run(main())
