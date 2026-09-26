#!/usr/bin/env python3
"""
Скрипт для импорта слов из JSON-файла в базу данных

Использование:
    python import_dictionary.py                          # Импорт из words.json
    python import_dictionary.py --file custom_words.json # Импорт из другого файла
    python import_dictionary.py --dry-run                # Тестовый прогон
"""
import asyncio
import sys
import uuid
import json
import argparse
from pathlib import Path

# Добавить backend в путь
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from config import settings
from models import Dictionary, DictionaryTranslation

# Валидные значения
VALID_POS = ["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "article", "numeral"]
VALID_LANGS = ["en", "de", "es", "fr", "ru", "it", "pt", "zh", "ja", "ko"]
VALID_CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"]


def validate_word(word_data: dict, index: int) -> tuple[bool, list[str]]:
    """Валидация данных слова"""
    errors = []
    
    # Обязательные поля
    if not word_data.get("lemma"):
        errors.append(f"Слово #{index+1}: отсутствует lemma")
    
    if not word_data.get("target_lang"):
        errors.append(f"Слово #{index+1}: отсутствует target_lang")
    elif word_data["target_lang"] not in VALID_LANGS:
        errors.append(f"Слово #{index+1}: неверный target_lang '{word_data['target_lang']}'")
    
    if not word_data.get("pos"):
        errors.append(f"Слово #{index+1}: отсутствует pos")
    elif word_data["pos"] not in VALID_POS:
        errors.append(f"Слово #{index+1}: неверный pos '{word_data['pos']}'")
    
    if not word_data.get("cefr_level"):
        errors.append(f"Слово #{index+1}: отсутствует cefr_level")
    elif word_data["cefr_level"] not in VALID_CEFR:
        errors.append(f"Слово #{index+1}: неверный cefr_level '{word_data['cefr_level']}'")
    
    if not word_data.get("translations"):
        errors.append(f"Слово #{index+1}: отсутствуют translations")
    elif not isinstance(word_data["translations"], list):
        errors.append(f"Слово #{index+1}: translations должен быть массивом")
    elif len(word_data["translations"]) == 0:
        errors.append(f"Слово #{index+1}: translations пустой")
    
    return len(errors) == 0, errors


async def import_words(session: AsyncSession, words: list, dry_run: bool = False) -> dict:
    """Импорт слов в базу данных"""
    stats = {"added": 0, "skipped": 0, "errors": 0, "validation_errors": 0}
    
    for index, word_data in enumerate(words):
        try:
            # Валидация
            is_valid, errors = validate_word(word_data, index)
            if not is_valid:
                for error in errors:
                    print(f"  ❌ {error}")
                stats["validation_errors"] += 1
                stats["errors"] += 1
                continue
            
            lemma = word_data["lemma"].strip()
            pos = word_data["pos"].strip()
            cefr_level = word_data["cefr_level"].strip()
            target_lang = word_data["target_lang"].strip()
            translations = word_data["translations"]
            
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
                    print(f"  ⏭️  Пропущено (дубликат): {lemma} ({pos}) [{target_lang}]")
                continue
            
            if dry_run:
                print(f"  ✅ [DRY] Будет добавлено: {lemma} ({pos}) [{target_lang}] - {', '.join(translations[:2])}")
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
            trans_id = str(uuid.uuid4())
            trans_entry = DictionaryTranslation(
                id=trans_id,
                dictionary_id=dict_id,
                lang="ru",
                translations=translations,
            )
            session.add(trans_entry)
            
            stats["added"] += 1
            print(f"  ✅ Добавлено: {lemma} ({pos}) [{target_lang}] - {', '.join(translations[:2])}")
            
        except Exception as e:
            print(f"  ❌ Ошибка добавления '{word_data.get('lemma', '?')}': {e}")
            stats["errors"] += 1
    
    return stats


async def main():
    parser = argparse.ArgumentParser(description='Импорт слов из JSON-файла в базу данных')
    parser.add_argument('--file', type=str, default='words.json', help='Путь к JSON-файлу (по умолчанию: words.json)')
    parser.add_argument('--dry-run', action='store_true', help='Только показать, что будет добавлено')
    args = parser.parse_args()
    
    # Проверить наличие файла
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"❌ Файл не найден: {file_path}")
        print(f"\nСоздайте файл {file_path} со следующей структурой:")
        print("""
{
  "words": [
    {
      "lemma": "house",
      "pos": "noun",
      "cefr_level": "A1",
      "target_lang": "en",
      "translations": ["дом", "жилище"]
    },
    {
      "lemma": "run",
      "pos": "verb",
      "cefr_level": "A1",
      "target_lang": "en",
      "translations": ["бежать", "бегать"]
    }
  ]
}
""")
        sys.exit(1)
    
    # Загрузить JSON
    print(f"📖 Загрузка файла: {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка парсинга JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Ошибка чтения файла: {e}")
        sys.exit(1)
    
    # Проверить структуру
    if "words" not in data:
        print("❌ Ошибка: JSON должен содержать ключ 'words'")
        sys.exit(1)
    
    words = data["words"]
    if not isinstance(words, list):
        print("❌ Ошибка: 'words' должен быть массивом")
        sys.exit(1)
    
    print(f"📊 Найдено слов: {len(words)}")
    print(f"🔧 Режим: {'DRY RUN (без записи в БД)' if args.dry_run else 'REAL (запись в БД)'}")
    print("=" * 70)
    
    # Подключение к БД
    print("\n🔌 Подключение к базе данных...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    async with engine.begin() as session:
        stats = await import_words(session, words, args.dry_run)
    
    await engine.dispose()
    
    # Итоги
    print("\n" + "=" * 70)
    print("📈 ИТОГО:")
    print(f"  ✅ Добавлено слов: {stats['added']}")
    print(f"  ⏭️  Пропущено (дубликаты): {stats['skipped']}")
    print(f"  ❌ Ошибок валидации: {stats['validation_errors']}")
    print(f"  ❌ Других ошибок: {stats['errors'] - stats['validation_errors']}")
    print("=" * 70)
    
    if args.dry_run:
        print("\n⚠️  Это был DRY RUN. Для реального импорта запустите без флага --dry-run")
    
    if stats['added'] > 0 and not args.dry_run:
        print("\n✅ Импорт завершён успешно!")
        print("💡 Проверьте результат в админке: http://localhost:8000/admin")


if __name__ == "__main__":
    asyncio.run(main())
