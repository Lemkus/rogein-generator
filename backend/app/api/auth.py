"""
API endpoints для аутентификации
TODO: Реализовать JWT аутентификацию
"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/register")
async def register():
    """Регистрация пользователя"""
    return {"message": "Регистрация - TODO"}


@router.post("/login")
async def login():
    """Авторизация пользователя"""
    return {"message": "Авторизация - TODO"}


@router.post("/logout")
async def logout():
    """Выход из системы"""
    return {"message": "Выход - TODO"}


@router.get("/me")
async def get_current_user():
    """Получить информацию о текущем пользователе"""
    return {"message": "Текущий пользователь - TODO"}
