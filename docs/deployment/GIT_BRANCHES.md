# Структура веток Git для Dev/Prod

## Рекомендуемая структура веток

### Основные ветки

```
main (или master)
  └── production-ready код
  └── деплой в PROD: python deploy_regru.py --env prod

dev
  └── код для разработки
  └── деплой в DEV: python deploy_regru.py --env dev

feature/*
  └── ветки для новых фич
  └── мержаются в dev, затем в main
```

## Стратегия работы

### Вариант 1: Простая (рекомендуется для небольших проектов)

**Принцип**: Один код, разные деплои

```
main ──┐
       ├──> PROD (deploy --env prod)
       │
dev ───┴──> DEV (deploy --env dev)
```

**Как работать:**
1. Разработка в ветке `dev`
2. Тестирование: `python deploy_regru.py --env dev`
3. После проверки: мерж `dev` → `main`
4. Деплой в PROD: `python deploy_regru.py --env prod`

**Плюсы:**
- Простота
- Один код для обоих окружений
- Автоматическое определение окружения

**Минусы:**
- Нужно быть аккуратным с мержами

### Вариант 2: Feature branches (для команд)

```
main ──┐
       ├──> PROD
       │
dev ───┼──> DEV
       │
feature/new-feature ──┐
                     ├──> мерж в dev (тест)
                     └──> мерж в main (релиз)
```

**Как работать:**
1. Создайте feature-ветку: `git checkout -b feature/new-feature`
2. Разработка в feature-ветке
3. Тест в DEV: `git checkout dev && git merge feature/new-feature && python deploy_regru.py --env dev`
4. После проверки: `git checkout main && git merge feature/new-feature`
5. Деплой в PROD: `python deploy_regru.py --env prod`

## Практические примеры

### Пример 1: Новая фича

```bash
# 1. Создаем feature-ветку
git checkout -b feature/new-navigation

# 2. Разработка
# ... вносим изменения ...

# 3. Коммит
git add .
git commit -m "Добавлена новая навигация"
git push origin feature/new-navigation

# 4. Тест в DEV
git checkout dev
git merge feature/new-navigation
python deploy_regru.py --env dev

# 5. Проверка на dev.trailspot.app
# ... тестируем ...

# 6. Релиз в PROD
git checkout main
git merge feature/new-navigation
python deploy_regru.py --env prod
```

### Пример 2: Быстрое исправление бага

```bash
# 1. Исправление в dev
git checkout dev
# ... исправляем баг ...
git commit -m "Исправлен баг X"
git push

# 2. Тест в DEV
python deploy_regru.py --env dev
# ... проверяем ...

# 3. Релиз в PROD
git checkout main
git merge dev
python deploy_regru.py --env prod
```

### Пример 3: Горячее исправление в PROD

```bash
# 1. Создаем hotfix-ветку от main
git checkout main
git checkout -b hotfix/critical-bug

# 2. Исправление
# ... исправляем критический баг ...
git commit -m "Критическое исправление"
git push

# 3. Деплой в PROD (срочно)
python deploy_regru.py --env prod

# 4. Мерж обратно в dev
git checkout dev
git merge hotfix/critical-bug
python deploy_regru.py --env dev
```

## Настройка Git hooks (опционально)

### Pre-push hook для проверки окружения

Создайте `.git/hooks/pre-push`:

```bash
#!/bin/bash
# Проверка, что не деплоится dev код в prod случайно

protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

if [ $protected_branch = $current_branch ]; then
    read -p "Вы уверены, что хотите запушить в main? (yes/no): " -n 3 -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Push отменен"
        exit 1
    fi
fi

exit 0
```

## Рекомендации

### ✅ Делайте так:

1. **Всегда тестируйте в DEV перед PROD**
   ```bash
   git checkout dev
   python deploy_regru.py --env dev
   # Проверка на dev.trailspot.app
   ```

2. **Используйте осмысленные коммиты**
   ```bash
   git commit -m "Добавлена функция X"
   # Не: git commit -m "fix"
   ```

3. **Мержите dev → main только после проверки**
   ```bash
   # После успешного теста в DEV
   git checkout main
   git merge dev
   python deploy_regru.py --env prod
   ```

4. **Используйте feature-ветки для больших изменений**
   ```bash
   git checkout -b feature/major-refactoring
   ```

### ❌ Не делайте так:

1. **Не деплойте в PROD без теста в DEV**
   ```bash
   # ❌ Плохо
   git checkout main
   python deploy_regru.py --env prod
   
   # ✅ Хорошо
   git checkout dev
   python deploy_regru.py --env dev
   # ... проверка ...
   git checkout main
   git merge dev
   python deploy_regru.py --env prod
   ```

2. **Не коммитьте напрямую в main**
   ```bash
   # ❌ Плохо
   git checkout main
   git commit -m "changes"
   
   # ✅ Хорошо
   git checkout dev
   git commit -m "changes"
   git checkout main
   git merge dev
   ```

3. **Не забывайте пушить изменения**
   ```bash
   # Всегда пушите после коммита
   git push origin dev
   ```

## Чеклист перед деплоем в PROD

- [ ] Код протестирован в DEV окружении
- [ ] Все изменения закоммичены и запушены
- [ ] Ветка `dev` в актуальном состоянии
- [ ] Выполнен мерж `dev` → `main`
- [ ] Проверены логи в DEV
- [ ] Нет критических ошибок
- [ ] Backup сделан (опционально)

## Автоматизация (опционально)

### Скрипт для безопасного деплоя

Создайте `deploy_safe.sh`:

```bash
#!/bin/bash
# Безопасный деплой с проверками

ENV=$1

if [ -z "$ENV" ]; then
    echo "Использование: ./deploy_safe.sh [dev|prod]"
    exit 1
fi

if [ "$ENV" = "prod" ]; then
    # Проверка, что мы в main
    BRANCH=$(git branch --show-current)
    if [ "$BRANCH" != "main" ]; then
        echo "ОШИБКА: Деплой в PROD только из ветки main!"
        echo "Текущая ветка: $BRANCH"
        exit 1
    fi
    
    # Подтверждение
    read -p "Вы уверены, что хотите деплоить в PROD? (yes/no): " -n 3 -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Деплой отменен"
        exit 1
    fi
fi

# Деплой
python deploy_regru.py --env $ENV
```

Использование:
```bash
chmod +x deploy_safe.sh
./deploy_safe.sh dev   # Деплой в DEV
./deploy_safe.sh prod  # Деплой в PROD (с проверками)
```

