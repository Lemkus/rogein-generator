"""
Модель тренировочных сессий
"""

from sqlalchemy import Column, Integer, String, DateTime, DECIMAL, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    
    # Временные рамки тренировки
    started_at = Column(DateTime(timezone=True), nullable=False)
    finished_at = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    
    # Результаты навигации
    points_visited = Column(Integer, default=0)
    points_total = Column(Integer)
    success_rate = Column(DECIMAL(5, 2))  # Процент успешности
    
    # Детальные данные тренировки (JSON)
    navigation_data = Column(JSON)
    # Структура navigation_data:
    # {
    #   "points_details": [
    #     {
    #       "point_id": 1,
    #       "reached": true,
    #       "time_to_reach": 120,  # секунды
    #       "accuracy_zone_entries": 3,
    #       "final_distance": 8.5  # метры
    #     }
    #   ],
    #   "navigation_stats": {
    #     "total_navigation_time": 1200,
    #     "average_time_per_point": 120,
    #     "accuracy_zones_total": 15,
    #     "critical_zones_total": 8
    #   }
    # }
    
    # GPS трек тренировки (массив координат с временными метками)
    gps_track = Column(JSON)
    # Структура gps_track:
    # [
    #   {"lat": 60.1234, "lng": 30.5678, "timestamp": "2023-12-01T10:30:00Z", "accuracy": 5.2},
    #   ...
    # ]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Связи
    user = relationship("User", back_populates="training_sessions")
    route = relationship("Route", back_populates="training_sessions")
    
    def __repr__(self):
        return f"<TrainingSession(id={self.id}, user_id={self.user_id}, points={self.points_visited}/{self.points_total})>"
    
    @property
    def is_completed(self):
        """Проверяет, завершена ли тренировка"""
        return self.finished_at is not None
    
    @property
    def completion_percentage(self):
        """Возвращает процент завершения"""
        if not self.points_total or self.points_total == 0:
            return 0
        return (self.points_visited / self.points_total) * 100
