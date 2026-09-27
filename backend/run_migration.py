#!/usr/bin/env python3
"""
Скрипт для выполнения миграции базы данных

Использование:
    python run_migration.py
"""
import asyncio
import sys
from pathlib import Path

# Добавить backend в путь
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from config import settings


async def run_migration():
    """Выполнение миграции базы данных"""
    print("=" * 70)
    print("Миграция базы данных LingoFlow")
    print("=" * 70)
    print()
    
    # Проверка подключения
    print(f"📡 Подключение к базе данных...")
    print(f"   URL: {settings.DATABASE_URL[:50]}...")
    print()
    
    try:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        
        async with engine.connect() as conn:
            # Проверка соединения
            result = await conn.execute(text("SELECT 1"))
            print("✅ Подключение успешно")
            print()
            
            # Чтение SQL файла миграции
            migration_file = Path(__file__).parent / "migrations" / "add_dictionary_categories.sql"
            
            if not migration_file.exists():
                print(f"❌ Файл миграции не найден: {migration_file}")
                return False
            
            print(f"📖 Чтение файла миграции: {migration_file.name}")
            with open(migration_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            print(f"✅ Файл прочитан ({len(sql_content)} символов)")
            print()
            
            # Разделение на отдельные команды
            print("🔧 Выполнение миграции...")
            print()
            
            # Разделяем SQL на команды по ';'
            commands = []
            current_command = []
            
            for line in sql_content.split('\n'):
                line = line.strip()
                
                # Пропускаем комментарии и пустые строки
                if not line or line.startswith('--'):
                    continue
                
                current_command.append(line)
                
                # Если строка заканчивается на ';', это конец команды
                if line.endswith(';'):
                    command = ' '.join(current_command)
                    if command:
                        commands.append(command)
                    current_command = []
            
            print(f"   Найдено {len(commands)} SQL команд")
            print()
            
            # Выполнение каждой команды
            success_count = 0
            error_count = 0
            
            for i, command in enumerate(commands, 1):
                try:
                    # Показываем краткое описание команды
                    cmd_preview = command[:80].replace('\n', ' ')
                    if len(command) > 80:
                        cmd_preview += "..."
                    
                    print(f"   [{i}/{len(commands)}] Выполнение: {cmd_preview}")
                    
                    await conn.execute(text(command))
                    success_count += 1
                    
                except Exception as e:
                    error_count += 1
                    print(f"   ❌ Ошибка: {str(e)[:100]}")
                    print()
            
            print()
            print("=" * 70)
            print(f"✅ Миграция завершена!")
            print(f"   Успешно выполнено: {success_count}/{len(commands)} команд")
            
            if error_count > 0:
                print(f"   ⚠️  Ошибок: {error_count}")
            else:
                print(f"   ✅ Ошибок нет")
            
            print("=" * 70)
            print()
            
            # Проверка результатов
            print("🔍 Проверка результатов миграции...")
            print()
            
            # Проверка поля category в dictionaries
            try:
                result = await conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'dictionaries' 
                    AND column_name = 'category'
                """))
                if result.scalar():
                    print("   ✅ Поле 'category' добавлено в таблицу 'dictionaries'")
                else:
                    print("   ❌ Поле 'category' НЕ найдено в таблице 'dictionaries'")
            except Exception as e:
                print(f"   ❌ Ошибка проверки: {e}")
            
            # Проверка поля dictionary_category в user_language_profiles
            try:
                result = await conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'user_language_profiles' 
                    AND column_name = 'dictionary_category'
                """))
                if result.scalar():
                    print("   ✅ Поле 'dictionary_category' добавлено в таблицу 'user_language_profiles'")
                else:
                    print("   ❌ Поле 'dictionary_category' НЕ найдено в таблице 'user_language_profiles'")
            except Exception as e:
                print(f"   ❌ Ошибка проверки: {e}")
            
            # Проверка таблицы dictionary_categories
            try:
                result = await conn.execute(text("""
                    SELECT COUNT(*) FROM dictionary_categories
                """))
                count = result.scalar()
                print(f"   ✅ Таблица 'dictionary_categories' создана ({count} категорий)")
            except Exception as e:
                print(f"   ❌ Таблица 'dictionary_categories' НЕ создана: {e}")
            
            print()
            print("=" * 70)
            print("🎉 Миграция успешно завершена!")
            print()
            print("Следующие шаги:")
            print("1. Перезапустите backend: python main.py")
            print("2. Обновите страницу в браузере: Ctrl+Shift+R")
            print("3. Проверьте API: curl http://localhost:8000/api/dictionary-categories?target_lang=en")
            print("=" * 70)
            
            return True
            
    except Exception as e:
        print()
        print("=" * 70)
        print("❌ Ошибка выполнения миграции!")
        print("=" * 70)
        print(f"Ошибка: {e}")
        print()
        print("Возможные причины:")
        print("1. Неверный DATABASE_URL в backend/.env")
        print("2. PostgreSQL не запущен на сервере")
        print("3. Firewall блокирует порт 5432")
        print("4. Недостаточно прав для выполнения миграции")
        print()
        print("Проверьте настройки в backend/.env и попробуйте снова.")
        print("=" * 70)
        return False


if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)
