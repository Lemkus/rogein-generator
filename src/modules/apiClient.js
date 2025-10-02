/**
 * API клиент для общения с бэкендом
 * Обеспечивает сохранение маршрутов и результатов тренировок
 */

// Конфигурация API
const API_CONFIG = {
    BASE_URL: 'http://localhost:8001/api',
    TIMEOUT: 30000, // 30 секунд
    RETRY_ATTEMPTS: 3
};

// Класс для работы с API
class ApiClient {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
        this.timeout = API_CONFIG.TIMEOUT;
        this.retryAttempts = API_CONFIG.RETRY_ATTEMPTS;
    }

    /**
     * Базовый метод для HTTP запросов
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        console.log(`🌐 API запрос: ${config.method || 'GET'} ${url}`);

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ API ответ получен:`, data);
            return data;

        } catch (error) {
            console.error(`❌ API ошибка:`, error);
            throw new ApiError(error.message, error);
        }
    }

    // === МАРШРУТЫ ===

    /**
     * Сохранить новый маршрут
     */
    async saveRoute(routeData) {
        const data = {
            title: routeData.title || `Маршрут ${new Date().toLocaleDateString()}`,
            description: routeData.description || '',
            bounds: {
                sw_lat: routeData.bounds.getSouthWest().lat,
                sw_lng: routeData.bounds.getSouthWest().lng,
                ne_lat: routeData.bounds.getNorthEast().lat,
                ne_lng: routeData.bounds.getNorthEast().lng
            },
            start_point: {
                lat: routeData.startPoint.lat,
                lng: routeData.startPoint.lng
            },
            points: routeData.points.map(point => ({
                lat: Array.isArray(point) ? point[0] : point.lat,
                lng: Array.isArray(point) ? point[1] : point.lng
            })),
            difficulty_level: routeData.difficulty || 1,
            estimated_time_minutes: routeData.estimatedTime,
            is_public: routeData.isPublic !== false
        };

        return await this.request('/routes', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Получить список маршрутов
     */
    async getRoutes(filters = {}) {
        const params = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, value);
            }
        });

        const endpoint = `/routes${params.toString() ? '?' + params.toString() : ''}`;
        return await this.request(endpoint);
    }

    /**
     * Получить маршрут по ID
     */
    async getRoute(routeId) {
        return await this.request(`/routes/${routeId}`);
    }

    /**
     * Получить маршрут по токену обмена
     */
    async getSharedRoute(token) {
        return await this.request(`/routes/shared/${token}`);
    }

    /**
     * Создать ссылку для обмена маршрутом
     */
    async shareRoute(routeId, expiresHours = null) {
        const data = expiresHours ? { expires_hours: expiresHours } : {};
        
        return await this.request(`/routes/${routeId}/share`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Оценить маршрут
     */
    async rateRoute(routeId, rating, comment = null) {
        const data = { rating };
        if (comment) data.comment = comment;

        return await this.request(`/routes/${routeId}/rating`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // === ТРЕНИРОВКИ ===

    /**
     * Начать новую тренировочную сессию
     */
    async startTrainingSession(routeId) {
        return await this.request('/training', {
            method: 'POST',
            body: JSON.stringify({
                route_id: routeId,
                started_at: new Date().toISOString()
            })
        });
    }

    /**
     * Завершить тренировочную сессию
     */
    async finishTrainingSession(sessionId, results) {
        const data = {
            finished_at: new Date().toISOString(),
            duration_seconds: results.duration,
            points_visited: results.pointsVisited,
            points_total: results.pointsTotal,
            success_rate: (results.pointsVisited / results.pointsTotal) * 100,
            navigation_data: results.navigationData,
            gps_track: results.gpsTrack
        };

        return await this.request(`/training/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Получить историю тренировок
     */
    async getTrainingHistory(filters = {}) {
        const params = new URLSearchParams(filters);
        const endpoint = `/training${params.toString() ? '?' + params.toString() : ''}`;
        return await this.request(endpoint);
    }

    /**
     * Получить статистику тренировок
     */
    async getTrainingStats() {
        return await this.request('/training/stats');
    }

    // === ЭКСПОРТ ===

    /**
     * Скачать маршрут в формате GPX
     */
    async downloadRouteGPX(routeId) {
        const url = `${this.baseUrl}/export/routes/${routeId}/gpx`;
        window.open(url, '_blank');
    }

    /**
     * Скачать маршрут в формате KML
     */
    async downloadRouteKML(routeId) {
        const url = `${this.baseUrl}/export/routes/${routeId}/kml`;
        window.open(url, '_blank');
    }
}

// Класс для API ошибок
class ApiError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'ApiError';
        this.originalError = originalError;
    }
}

// Глобальный экземпляр API клиента
export const apiClient = new ApiClient();

// Утилитарные функции для быстрого использования

/**
 * Сохранить текущий маршрут
 */
export async function saveCurrentRoute(bounds, startPoint, points, options = {}) {
    try {
        const routeData = {
            title: options.title,
            description: options.description,
            bounds: bounds,
            startPoint: startPoint,
            points: points,
            difficulty: options.difficulty,
            estimatedTime: options.estimatedTime,
            isPublic: options.isPublic
        };

        const result = await apiClient.saveRoute(routeData);
        console.log('✅ Маршрут сохранен:', result);
        return result;

    } catch (error) {
        console.error('❌ Ошибка сохранения маршрута:', error);
        throw error;
    }
}

/**
 * Загрузить маршрут по ID
 */
export async function loadRoute(routeId) {
    try {
        const route = await apiClient.getRoute(routeId);
        console.log('✅ Маршрут загружен:', route);
        return route;

    } catch (error) {
        console.error('❌ Ошибка загрузки маршрута:', error);
        throw error;
    }
}

/**
 * Поделиться маршрутом
 */
export async function shareCurrentRoute(routeId, expiresHours = 24) {
    try {
        const shareData = await apiClient.shareRoute(routeId, expiresHours);
        const fullUrl = `${window.location.origin}${shareData.share_url}`;
        
        console.log('✅ Ссылка для обмена создана:', fullUrl);
        
        // Копируем в буфер обмена если доступно
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(fullUrl);
            console.log('📋 Ссылка скопирована в буфер обмена');
        }
        
        return { ...shareData, full_url: fullUrl };

    } catch (error) {
        console.error('❌ Ошибка создания ссылки:', error);
        throw error;
    }
}

/**
 * Проверить доступность API
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL.replace('/api', '')}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API доступен:', data);
            return true;
        }
        return false;
    } catch (error) {
        console.log('❌ API недоступен:', error.message);
        return false;
    }
}

// Экспорт классов и констант
export { ApiClient, ApiError, API_CONFIG };
