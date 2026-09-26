#!/usr/bin/env python3
"""
Тестовый скрипт для проверки подключения к PostgreSQL
"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Загрузить настройки
sys.path.insert(0, 'backend')
from config import settings


async def test_connection():
    print("=" * 60)
    print("Тест подключения к PostgreSQL")
    print("=" * 60)
    print(f"DATABASE_URL: {settings.DATABASE_URL}")
    print()
    
    try:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        
        async with engine.connect() as conn:
            # Тест 1: Простой запрос
            result = await conn.execute(text("SELECT 1"))
            value = result.scalar()
            print(f"✓ SELECT 1 = {value}")
            
            # Тест 2: Проверка версии PostgreSQL
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✓ PostgreSQL version: {version.split()[0]} {version.split()[1]}")
            
            # Тест 3: Проверка таблиц
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = [row[0] for row in result.fetchall()]
            print(f"✓ Таблиц в БД: {len(tables)}")
            for table in tables:
                print(f"  - {table}")
            
            # Тест 4: Проверка словаря
            if 'dictionaries' in tables:
                result = await conn.execute(text("SELECT COUNT(*) FROM dictionaries"))
                count = result.scalar()
                print(f"✓ Слов в словаре: {count}")
            
            print()
            print("=" * 60)
            print("✓ Все тесты пройдены! Подключение работает.")
            print("=" * 60)
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print()
        print("=" * 60)
        print("✗ Ошибка подключения!")
        print("=" * 60)
        print(f"Ошибка: {e}")
        print()
        print("Возможные причины:")
        print("1. Неверный DATABASE_URL в backend/.env")
        print("2. PostgreSQL не запущен на сервере")
        print("3. Firewall блокирует порт 5432")
        print("4. Неверный пароль или имя пользователя")
        print()
        print("Следуйте инструкции в SETUP_DATABASE.md")
        print("=" * 60)
        return False


if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)
