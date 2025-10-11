#!/usr/bin/env python3
"""
Простой скрипт деплоя для REG.RU
Загружает файлы на сервер через SCP
"""

import os
import subprocess
import json
import sys

def load_config():
    """Загружает конфигурацию из файла"""
    try:
        with open('deploy_config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки конфигурации: {e}")
        return None

def run_command(command, description):
    """Выполняет команду и выводит результат"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} - успешно")
            if result.stdout:
                print(f"📄 Вывод: {result.stdout.strip()}")
            return True
        else:
            print(f"❌ {description} - ошибка")
            print(f"📄 Ошибка: {result.stderr.strip()}")
            return False
    except Exception as e:
        print(f"❌ {description} - исключение: {e}")
        return False

def deploy_to_regru():
    """Основная функция деплоя"""
    print("🚀 Начинаем деплой на REG.RU...")
    
    # Загружаем конфигурацию
    config = load_config()
    if not config:
        return False
    
    server = config['server']
    ssh_key_path = os.path.expanduser("~/.ssh/trailspot_deploy")
    
    print(f"📋 Конфигурация:")
    print(f"   Сервер: {server['host']}")
    print(f"   Пользователь: {server['user']}")
    print(f"   Путь: {server['path']}")
    print(f"   SSH ключ: {ssh_key_path}")
    
    # Проверяем SSH ключ
    if not os.path.exists(ssh_key_path):
        print(f"❌ SSH ключ не найден: {ssh_key_path}")
        print("💡 Создайте SSH ключ командой:")
        print(f"   ssh-keygen -t rsa -b 4096 -f {ssh_key_path} -N ''")
        return False
    
    # Список файлов для загрузки
    files_to_upload = [
        'backend_simple.py',
        'passenger_wsgi.py', 
        'requirements.txt',
        'index.html',
        'src/',
        'favicon.svg',
        'manifest.json',
        '.htaccess'
    ]
    
    # Создаем команды для загрузки
    upload_commands = []
    
    for file_path in files_to_upload:
        if os.path.exists(file_path):
            if os.path.isdir(file_path):
                # Для директорий используем rsync
                cmd = f"rsync -avz -e 'ssh -i {ssh_key_path}' {file_path}/ {server['user']}@{server['host']}:{server['path']}/{file_path}/"
            else:
                # Для файлов используем scp
                cmd = f"scp -i {ssh_key_path} {file_path} {server['user']}@{server['host']}:{server['path']}/"
            upload_commands.append((cmd, f"Загрузка {file_path}"))
        else:
            print(f"⚠️  Файл не найден: {file_path}")
    
    # Выполняем загрузку
    success_count = 0
    for cmd, description in upload_commands:
        if run_command(cmd, description):
            success_count += 1
    
    print(f"\n📊 Результат деплоя:")
    print(f"   Успешно загружено: {success_count}/{len(upload_commands)} файлов")
    
    if success_count == len(upload_commands):
        print("🎉 Деплой завершен успешно!")
        print(f"🌐 Приложение должно быть доступно по адресу:")
        print(f"   http://{server['host']}")
        return True
    else:
        print("❌ Деплой завершен с ошибками")
        return False

if __name__ == "__main__":
    success = deploy_to_regru()
    sys.exit(0 if success else 1)
