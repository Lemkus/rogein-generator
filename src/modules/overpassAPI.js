/**
 * Модуль для работы с Overpass API
 * Загружает данные из OpenStreetMap
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT = 25;

// Базовая функция для выполнения запросов к Overpass API
async function executeOverpassQuery(query, errorMessage) {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Ошибка Overpass API (${errorMessage}):`, response.status, response.statusText, errorText);
    throw new Error(`${errorMessage}: ${response.status} ${response.statusText}. Попробуйте уменьшить область.`);
  }
  
  const data = await response.json();
  console.log(`${errorMessage} из Overpass:`, data.elements);
  return data.elements;
}

// Загрузка закрытых зон (военные объекты, частные территории)
export async function fetchClosedAreas(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:${TIMEOUT}];
    (
      way["landuse"="military"](${bbox});
      relation["landuse"="military"](${bbox});
      way["military"](${bbox});
      relation["military"](${bbox});
      way["access"="private"](${bbox});
      relation["access"="private"](${bbox});
    );
    out geom;`;

  return executeOverpassQuery(query, 'Закрытые зоны');
}

// Загрузка водоёмов
export async function fetchWaterAreas(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:${TIMEOUT}];
    (
      way["natural"="water"](${bbox});
      relation["natural"="water"](${bbox});
      way["water"="lake"](${bbox});
      relation["water"="lake"](${bbox});
      way["landuse"="reservoir"](${bbox});
      relation["landuse"="reservoir"](${bbox});
      way["landuse"="basin"](${bbox});
      relation["landuse"="basin"](${bbox});
    );
    out geom;`;

  return executeOverpassQuery(query, 'Водоёмы');
}

// Загрузка барьеров - только ЯВНО ЗАПРЕЩЁННЫЕ
export async function fetchBarriers(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:${TIMEOUT}];
    (
      // ТОЛЬКО элементы с ЯВНЫМ запретом доступа
      way["access"="no"](${bbox});
      way["access"="private"](${bbox});
      way["foot"="no"](${bbox});
      node["access"="no"](${bbox});
      node["access"="private"](${bbox});
      node["foot"="no"](${bbox});
      relation["access"="no"](${bbox});
      relation["access"="private"](${bbox});
      relation["foot"="no"](${bbox});
      
      // Стены - обычно непроходимы по определению
      way["barrier"="wall"](${bbox});
    );
    out geom;`;

  return executeOverpassQuery(query, 'Барьеры');
}

// Загрузка пешеходных путей и дорог
export async function fetchPaths(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:${TIMEOUT}];
    (
      way["highway"="path"](${bbox});
      way["highway"="footway"](${bbox});
      way["highway"="cycleway"](${bbox});
      way["highway"="track"](${bbox});
      way["highway"="service"](${bbox});
      way["highway"="bridleway"](${bbox});
      way["highway"="unclassified"](${bbox});
      way["highway"="residential"](${bbox});
      way["highway"="living_street"](${bbox});
      way["highway"="steps"](${bbox});
      way["highway"="pedestrian"](${bbox});
      way["highway"="crossing"](${bbox});
      way["footway"="crossing"](${bbox});
    );
    out geom;`;

  return executeOverpassQuery(query, 'Тропы');
} 