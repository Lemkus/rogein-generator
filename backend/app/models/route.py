"""
Модель маршрута (распределения точек)
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, DECIMAL, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Route(Base):
    __tablename__ = "routes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Основная информация
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Географические границы области
    bounds_sw_lat = Column(DECIMAL(10, 8))
    bounds_sw_lng = Column(DECIMAL(11, 8))
    bounds_ne_lat = Column(DECIMAL(10, 8))
    bounds_ne_lng = Column(DECIMAL(11, 8))
    
    # Стартовая точка
    start_point_lat = Column(DECIMAL(10, 8))
    start_point_lng = Column(DECIMAL(11, 8))
    
    # Точки маршрута (JSON массив координат)
    points = Column(JSON, nullable=False)
    
    # Метаданные маршрута
    points_count = Column(Integer)
    difficulty_level = Column(Integer, default=1)  # 1-5
    estimated_time_minutes = Column(Integer)
    
    # Статистика
    views_count = Column(Integer, default=0)
    downloads_count = Column(Integer, default=0)
    rating = Column(DECIMAL(3, 2), default=0.0)
    
    # Флаги
    is_public = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    user = relationship("User", back_populates="routes")
    training_sessions = relationship("TrainingSession", back_populates="route", cascade="all, delete-orphan")
    ratings = relationship("RouteRating", back_populates="route", cascade="all, delete-orphan")
    shares = relationship("RouteShare", back_populates="route", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Route(id={self.id}, title='{self.title}', points={self.points_count})>"


class RouteRating(Base):
    __tablename__ = "route_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    route = relationship("Route", back_populates="ratings")
    user = relationship("User", back_populates="route_ratings")
    
    def __repr__(self):
        return f"<RouteRating(route_id={self.route_id}, rating={self.rating})>"


class RouteShare(Base):
    __tablename__ = "route_shares"
    
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    share_token = Column(String(32), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True))
    access_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    route = relationship("Route", back_populates="shares")
    creator = relationship("User")
    
    def __repr__(self):
        return f"<RouteShare(route_id={self.route_id}, token='{self.share_token}')>"
