# 🚀 Создание репозитория на GitHub

## Шаг 1: Создание репозитория

1. **Перейдите на https://github.com/** и войдите в аккаунт
2. **Нажмите зеленую кнопку "New"** или "+" → "New repository"
3. **Заполните форму:**
   - **Repository name:** `rogein-generator`
   - **Description:** `Генератор точек на тропах OSM с звуковой навигацией`
   - **Visibility:** Public (публичный)
   - **НЕ ставьте галочки** на "Add a README file", "Add .gitignore", "Choose a license"
4. **Нажмите "Create repository"**

## Шаг 2: Подключение локального репозитория

После создания репозитория GitHub покажет инструкции. Выполните эти команды в PowerShell:

```bash
git remote add origin https://github.com/[ВАШЕ_ИМЯ_ПОЛЬЗОВАТЕЛЯ]/rogein-generator.git
git branch -M main
git push -u origin main
```

## Шаг 3: Настройка GitHub Pages

1. **Перейдите в Settings** репозитория (вкладка Settings)
2. **Прокрутите до "Pages"** в левом меню
3. **В разделе "Source" выберите:**
   - Source: "GitHub Actions"
4. **Нажмите "Save"**

## Шаг 4: Активация GitHub Actions

1. **Перейдите в раздел "Actions"** репозитория
2. **Нажмите "New workflow"**
3. **Выберите "Pages"** или "Deploy static content to GitHub Pages"
4. **Замените содержимое** на наш файл `.github/workflows/deploy.yml`
5. **Нажмите "Commit changes"**

## Шаг 5: Обновление README

1. **Перейдите в файл README_GITHUB.md**
2. **Нажмите карандаш (Edit)**
3. **Замените `[USERNAME]` на ваше имя пользователя GitHub**
4. **Переименуйте файл в README.md**
5. **Нажмите "Commit changes"**

## Шаг 6: Получение ссылки

После успешного деплоя (2-3 минуты):

1. **Перейдите в Settings → Pages**
2. **Скопируйте URL** (например: `https://yourusername.github.io/rogein-generator/`)

## Готово! 🎉

Теперь у вас есть:
- ✅ Репозиторий на GitHub
- ✅ Автоматический деплой на GitHub Pages
- ✅ Постоянная ссылка на приложение
- ✅ Возможность установки на телефон как PWA

**Ссылка будет работать с любого устройства!** 📱

