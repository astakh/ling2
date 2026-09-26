#!/usr/bin/env python3
"""
Скрипт для быстрого запуска Backend
"""
import subprocess
import sys
import os

def check_venv():
    """Проверить, активировано ли виртуальное окружение"""
    if sys.prefix == sys.base_prefix:
        print("⚠️  Виртуальное окружение не активировано!")
        print()
        print("Активируйте его:")
        print("  source backend/venv/bin/activate  # Linux/Mac")
        print("  backend\\venv\\Scripts\\activate    # Windows")
        print()
        return False
    return True

def check_dependencies():
    """Проверить установленные зависимости"""
    try:
        import fastapi
        import sqlalchemy
        import asyncpg
        print("✓ Зависимости установлены")
        return True
    except ImportError as e:
        print(f"✗ Не установлена зависимость: {e}")
        print()
        print("Установите зависимости:")
        print("  cd backend")
        print("  pip install -r requirements.txt")
        print()
        return False

def check_env():
    """Проверить наличие .env файла"""
    if not os.path.exists("backend/.env"):
        print("⚠️  Файл backend/.env не найден!")
        print()
        print("Создайте его:")
        print("  cp backend/.env.example backend/.env")
        print("  nano backend/.env  # отредактируйте настройки")
        print()
        return False
    
    print("✓ Файл .env найден")
    return True

def main():
    print("=" * 60)
    print("Запуск LingoFlow Backend")
    print("=" * 60)
    print()
    
    # Перейти в директорию backend
    if not os.path.exists("backend"):
        print("✗ Директория backend не найдена!")
        print("Запустите скрипт из корня проекта.")
        sys.exit(1)
    
    os.chdir("backend")
    
    # Проверки
    checks = [
        check_venv,
        check_dependencies,
        check_env,
    ]
    
    all_passed = True
    for check in checks:
        if not check():
            all_passed = False
    
    if not all_passed:
        print("=" * 60)
        print("Исправьте ошибки выше и попробуйте снова.")
        print("=" * 60)
        sys.exit(1)
    
    print()
    print("=" * 60)
    print("Запуск сервера...")
    print("=" * 60)
    print()
    print("Backend будет доступен на: http://localhost:8000")
    print("Документация API: http://localhost:8000/docs")
    print()
    print("Нажмите Ctrl+C для остановки")
    print("=" * 60)
    print()
    
    # Запустить сервер
    try:
        subprocess.run([sys.executable, "main.py"])
    except KeyboardInterrupt:
        print()
        print("Сервер остановлен.")

if __name__ == "__main__":
    main()
