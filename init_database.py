#!/usr/bin/env python3
"""
Скрипт для инициализации базы данных PostgreSQL
Выполняет backend/init_db.sql на удалённом сервере

Использование:
    python init_database.py
    python init_database.py --force  # пересоздать таблицы
    python init_database.py --dry-run  # только показать SQL
"""
import asyncio
import sys
import os
import argparse
from pathlib import Path

# Добавить backend в путь для импорта config
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from config import settings


def load_sql_file(filepath: str) -> str:
    """Загрузить SQL файл"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


async def init_database(force: bool = False, dry_run: bool = False):
    """Инициализировать базу данных"""
    print("=" * 70)
    print("Инициализация базы данных LingoFlow")
    print("=" * 70)
    print()
    
    # Показать настройки
    print(f"DATABASE_URL: {settings.DATABASE_URL}")
    print(f"SQL файл: backend/init_db.sql")
    print()
    
    # Проверить наличие SQL файла
    sql_file = Path(__file__).parent / 'backend' / 'init_db.sql'
    if not sql_file.exists():
        print("✗ Файл backend/init_db.sql не найден!")
        print()
        return False
    
    # Загрузить SQL
    sql_content = load_sql_file(str(sql_file))
    
    if dry_run:
        print("=" * 70)
        print("DRY RUN - SQL команды:")
        print("=" * 70)
        print(sql_content)
        print("=" * 70)
        return True
    
    # Подтверждение
    if not force:
        print("⚠️  Это создаст таблицы и добавит начальные данные в БД.")
        print()
        response = input("Продолжить? (y/n): ").strip().lower()
        if response not in ['y', 'yes', 'д', 'да']:
            print("Отменено.")
            return False
    
    print()
    print("Подключение к базе данных...")
    
    try:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        
        async with engine.begin() as conn:
            # Разделить SQL на отдельные команды
            # Убрать комментарии и пустые строки
            statements = []
            current_statement = []
            
            for line in sql_content.split('\n'):
                line = line.strip()
                
                # Пропустить комментарии и пустые строки
                if not line or line.startswith('--'):
                    continue
                
                current_statement.append(line)
                
                # Если строка заканчивается на ;, это конец команды
                if line.endswith(';'):
                    statement = ' '.join(current_statement)
                    statements.append(statement)
                    current_statement = []
            
            # Выполнить каждую команду
            total = len(statements)
            success = 0
            errors = 0
            
            for i, statement in enumerate(statements, 1):
                try:
                    await conn.execute(text(statement))
                    success += 1
                    
                    # Показать прогресс
                    if i % 5 == 0 or i == total:
                        print(f"  Выполнено: {i}/{total} команд", end='\r')
                    
                except Exception as e:
                    errors += 1
                    print()
                    print(f"✗ Ошибка в команде #{i}:")
                    print(f"  {statement[:100]}...")
                    print(f"  Ошибка: {e}")
                    print()
            
            print()
            print()
            print("=" * 70)
            print(f"✓ Выполнено успешно: {success}/{total} команд")
            
            if errors > 0:
                print(f"✗ Ошибок: {errors}")
                print("=" * 70)
                return False
            else:
                print("✓ База данных успешно инициализирована!")
                print("=" * 70)
                print()
                print("Следующие шаги:")
                print("1. Запустить backend: cd backend && python main.py")
                print("2. Запустить frontend: npm run dev")
                print("3. Открыть http://localhost:5173")
                print()
                return True
        
        await engine.dispose()
        
    except Exception as e:
        print()
        print("=" * 70)
        print("✗ Ошибка подключения к базе данных!")
        print("=" * 70)
        print(f"Ошибка: {e}")
        print()
        print("Возможные причины:")
        print("1. Неверный DATABASE_URL в backend/.env")
        print("2. PostgreSQL не запущен на сервере")
        print("3. Firewall блокирует порт 5432")
        print("4. База данных не создана")
        print()
        print("Следуйте инструкции в SETUP_DATABASE.md")
        print("=" * 70)
        return False


def main():
    parser = argparse.ArgumentParser(description='Инициализация базы данных LingoFlow')
    parser.add_argument('--force', action='store_true', 
                       help='Не спрашивать подтверждение')
    parser.add_argument('--dry-run', action='store_true',
                       help='Только показать SQL команды, не выполнять')
    
    args = parser.parse_args()
    
    success = asyncio.run(init_database(force=args.force, dry_run=args.dry_run))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
