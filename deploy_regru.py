#!/usr/bin/env python3
"""
Простой скрипт деплоя для REG.RU
Загружает файлы на сервер через SCP
"""

import os
import subprocess
import json
import sys
import platform

def load_config():
    """Загружает конфигурацию из файла"""
    try:
        with open('deploy_config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Ошибка загрузки конфигурации: {e}")
        return None

def run_command(command, description):
    """Выполняет команду и выводит результат"""
    print(f"[{description}]...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[{description}] - успешно")
            if result.stdout:
                print(f"Вывод: {result.stdout.strip()}")
            return True
        else:
            print(f"[{description}] - ошибка")
            print(f"Ошибка: {result.stderr.strip()}")
            return False
    except Exception as e:
        print(f"[{description}] - исключение: {e}")
        return False

def deploy_to_regru():
    """Основная функция деплоя"""
    # Определяем окружение из аргументов
    env = 'prod'
    if '--env' in sys.argv:
        env_index = sys.argv.index('--env')
        if env_index + 1 < len(sys.argv):
            env = sys.argv[env_index + 1]
    
    if env not in ['prod', 'dev']:
        print(f"Ошибка: неизвестное окружение '{env}'. Используйте 'prod' или 'dev'")
        return False
    
    print(f"Деплой в окружение: {env.upper()}")
    print("Начинаем деплой на REG.RU...")
    
    # Загружаем конфигурацию
    config = load_config()
    if not config:
        return False
    
    # Определяем путь назначения в зависимости от окружения
    base_path = config['server']['path']
    if env == 'dev':
        # Если путь www/trailspot.app, меняем на www/dev.trailspot.app
        if 'trailspot.app' in base_path and 'dev.trailspot.app' not in base_path:
            deploy_path = base_path.replace('trailspot.app', 'dev.trailspot.app')
        elif '/www/' in base_path:
            # Если путь вида www/trailspot.app, добавляем dev.
            parts = base_path.split('/')
            if len(parts) > 0 and 'trailspot.app' in parts[-1]:
                parts[-1] = 'dev.trailspot.app'
                deploy_path = '/'.join(parts)
            else:
                deploy_path = base_path.replace('/www/', '/www/dev.')
        else:
            deploy_path = base_path
        print(f"DEV путь: {deploy_path}")
    else:
        deploy_path = base_path
        print(f"PROD путь: {deploy_path}")
    
    server = config['server']
    ssh_key_path = os.path.expanduser("~/.ssh/trailspot_deploy")
    
    print(f"Конфигурация:")
    print(f"   Сервер: {server['host']}")
    print(f"   Пользователь: {server['user']}")
    print(f"   Путь: {deploy_path}")
    print(f"   SSH ключ: {ssh_key_path}")
    
    # Проверяем SSH ключ
    if not os.path.exists(ssh_key_path):
        print(f"SSH ключ не найден: {ssh_key_path}")
        print("Создайте SSH ключ командой:")
        print(f"   ssh-keygen -t rsa -b 4096 -f {ssh_key_path} -N ''")
        return False
    
    # SSH опции для неинтерактивного режима
    # Используем nul для Windows, /dev/null для Unix-подобных систем
    null_file = "nul" if platform.system() == "Windows" else "/dev/null"
    ssh_opts = f"-o StrictHostKeyChecking=no -o UserKnownHostsFile={null_file} -o BatchMode=yes -o ConnectTimeout=10"
    
    # Сначала создаем папку assets на сервере
    print("\nСоздаем папку assets на сервере...")
    mkdir_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && mkdir -p assets/icons\""
    if not run_command(mkdir_cmd, "Создание папки assets"):
        print("Ошибка создания папки assets")
        return False
    
    # Список файлов для загрузки
    files_to_upload = [
        'backend_simple.py',
        'passenger_wsgi.py', 
        'requirements.txt',
        'index.html',
        'src/',
        'assets/',
        'RogeinProject/libs/',
        'favicon.svg',
        'manifest.json',
        'sw.js',
        '.htaccess',
        'setup_venv.sh',
        'debug_server.sh',
        'test_import.py'
    ]
    
    # Создаем команды для загрузки
    upload_commands = []
    
    for file_path in files_to_upload:
        if os.path.exists(file_path):
            if os.path.isdir(file_path):
                # Для директорий используем scp с рекурсией
                cmd = f"scp -r {ssh_opts} -i {ssh_key_path} {file_path} {server['user']}@{server['host']}:{deploy_path}/"
            else:
                # Для файлов используем scp
                cmd = f"scp {ssh_opts} -i {ssh_key_path} {file_path} {server['user']}@{server['host']}:{deploy_path}/"
            upload_commands.append((cmd, f"Загрузка {file_path}"))
        else:
            print(f"Файл не найден: {file_path}")
    
    # Выполняем загрузку
    success_count = 0
    for cmd, description in upload_commands:
        if run_command(cmd, description):
            success_count += 1
    
    print(f"\nРезультат загрузки файлов:")
    print(f"   Успешно загружено: {success_count}/{len(upload_commands)} файлов")
    
    # Перемещаем RogeinProject/libs в libs (если загрузили)
    print("\nПроверяем и перемещаем libs в правильное место...")
    move_libs_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && if [ -d RogeinProject/libs ]; then rm -rf libs 2>/dev/null; mv RogeinProject/libs libs; rmdir RogeinProject 2>/dev/null || true; echo 'libs перемещена'; elif [ -d libs ]; then echo 'libs уже на месте'; else echo 'RogeinProject/libs не найдена'; fi\""
    run_command(move_libs_cmd, "Перемещение libs")
    
    # Проверяем, что файлы на месте
    print("\nПроверяем наличие файлов...")
    check_files_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && ls -la libs/leaflet/ 2>/dev/null | head -5 && ls -la assets/icons/ 2>/dev/null | head -5\""
    run_command(check_files_cmd, "Проверка файлов")
    
    if success_count == len(upload_commands):
        print("\nИсправляем права доступа...")
        chmod_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && chmod -R 755 src/ 2>/dev/null || true && find src/ -type f -name '*.js' -exec chmod 644 {{}} \\; 2>/dev/null || true && chmod -R 755 assets/ 2>/dev/null || true && find assets/ -type f -name '*.png' -exec chmod 644 {{}} \\; 2>/dev/null || true && chmod -R 755 libs/ 2>/dev/null || true && find libs/ -type f \\( -name '*.js' -o -name '*.css' \\) -exec chmod 644 {{}} \\; 2>/dev/null || true && chmod 644 index.html sw.js manifest.json favicon.svg 2>/dev/null || true\""
        
        if run_command(chmod_cmd, "Исправление прав доступа"):
            # Проверяем существование виртуального окружения
            print("\nПроверяем виртуальное окружение...")
            check_venv_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && test -d venv && echo 'exists' || echo 'not_exists'\""
            result = subprocess.run(check_venv_cmd, shell=True, capture_output=True, text=True)
            venv_exists = 'exists' in result.stdout.strip()
            
            if venv_exists:
                print("Виртуальное окружение уже существует, обновляем зависимости...")
                # Только обновляем зависимости, если requirements.txt изменился
                update_deps_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && source venv/bin/activate && pip install -r requirements.txt --quiet\""
                if run_command(update_deps_cmd, "Обновление зависимостей"):
                    print("Перезапускаем Passenger...")
                    restart_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && touch passenger_wsgi.py\""
                    run_command(restart_cmd, "Перезапуск Passenger")
                    print("Деплой завершен успешно!")
                    print(f"Приложение должно быть доступно по адресу:")
                    if env == 'dev':
                        print(f"   https://dev.trailspot.app")
                    else:
                        print(f"   https://trailspot.app")
                    return True
                else:
                    print("Ошибка при обновлении зависимостей")
                    return False
            else:
                print("Виртуальное окружение не найдено, создаем...")
                setup_cmd = f"ssh {ssh_opts} -i {ssh_key_path} {server['user']}@{server['host']} \"cd {deploy_path} && chmod +x setup_venv.sh && ./setup_venv.sh\""
                
                if run_command(setup_cmd, "Настройка виртуального окружения"):
                    print("Деплой завершен успешно!")
                    print(f"Приложение должно быть доступно по адресу:")
                    if env == 'dev':
                        print(f"   https://dev.trailspot.app")
                    else:
                        print(f"   https://trailspot.app")
                    return True
                else:
                    print("Ошибка при настройке виртуального окружения")
                    return False
        else:
            print("Ошибка при исправлении прав доступа")
            return False
    else:
        print("Деплой завершен с ошибками")
        return False

if __name__ == "__main__":
    success = deploy_to_regru()
    sys.exit(0 if success else 1)
