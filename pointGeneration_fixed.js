export function downloadGPX() {
  const startPoint = getStartPoint();
  
  if (pointMarkers.length === 0) {
    alert('Сначала сгенерируйте точки!');
    return;
  }

  // Создаём правильный совместимый с Garmin GPX с правильными тегами
  let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailPointsGenerator" xmlns="http://www.topografix.com/GPX/1/1">
`;

  // Добавляем стартовую точку, если есть
  if (startPoint) {
    gpxContent += `  <wpt lat="${startPoint.lat.toFixed(6)}" lon="${startPoint.lng.toFixed(6)}">
    <ele>0.0</ele>
    <name>START</name>
    <type>START POINT</type>
  </wpt>
`;
  }

  // Добавляем все контрольные точки с правильными тегами для Garmin
  pointMarkers.forEach((marker, i) => {
    const latlng = marker.getLatLng();
    const pointNumber = (i + 1).toString().padStart(2, '0');
    gpxContent += `  <wpt lat="${latlng.lat.toFixed(6)}" lon="${latlng.lng.toFixed(6)}">
    <ele>0.0</ele>
    <name>CP${pointNumber}</name>
    <type>CONTROL POINT</type>
  </wpt>
`;
  });

  gpxContent += '</gpx>';

  // Создаём и скачиваем файл
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'garmin_waypoints.gpx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 