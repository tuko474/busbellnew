import { TransportType, Location, TransportStop } from '../store/appStore';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// === МАРШРУТ ===

export interface RouteResult {
  id: string;
  ref: string;
  name: string;
  from: string;
  to: string;
  type: TransportType;
  stops: TransportStop[];
  path: { latitude: number; longitude: number }[];
}

// Маппинг типа транспорта на OSM route type
const OSM_ROUTE_TYPE: Record<TransportType, string[]> = {
  bus: ['bus', 'trolleybus', 'tram'],
  metro: ['subway', 'light_rail'],
  railway: ['train', 'railway'],
};

// Поиск маршрутов по номеру
export const searchRoutes = async (
  routeRef: string,
  type: TransportType,
  center: Location,
  radiusKm: number = 30
): Promise<RouteResult[]> => {
  try {
    const ref = routeRef.trim();
    if (!ref) return [];

    const latOffset = radiusKm / 111;
    const lonOffset = radiusKm / (111 * Math.cos(center.latitude * Math.PI / 180));
    const bbox = `${center.latitude - latOffset},${center.longitude - lonOffset},${center.latitude + latOffset},${center.longitude + lonOffset}`;

    // Строим запрос для всех подтипов OSM route
    const routeTypes = OSM_ROUTE_TYPE[type];
    const routeFilters = routeTypes
      .map((rt) => `relation["type"="route"]["route"="${rt}"]["ref"="${ref}"](${bbox});`)
      .join('\n');

    const query = `[out:json][timeout:30];
(
  ${routeFilters}
);
out body;
>;
out skel qt;`;

    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const data = await response.json();
    return parseRouteResponse(data, type, ref);
  } catch (error) {
    console.error(`Error searching routes:`, error);
    return [];
  }
};

// Парсинг ответа с маршрутами
const parseRouteResponse = (data: any, type: TransportType, ref: string): RouteResult[] => {
  if (!data.elements || !Array.isArray(data.elements)) return [];

  const elements = data.elements;

  // Индекс всех элементов по id
  const nodeIndex: Record<number, any> = {};
  const wayIndex: Record<number, any> = {};
  const relations: any[] = [];

  for (const el of elements) {
    if (el.type === 'node') nodeIndex[el.id] = el;
    else if (el.type === 'way') wayIndex[el.id] = el;
    else if (el.type === 'relation') relations.push(el);
  }

  const results: RouteResult[] = [];

  for (const rel of relations) {
    const tags = rel.tags || {};

    // Остановки: члены с ролью stop, platform, stop_exit_only, stop_entry_only
    const stopRoles = ['stop', 'platform', 'stop_exit_only', 'stop_entry_only'];
    const stops: TransportStop[] = [];
    const seenStopNames = new Set<string>();

    for (const member of rel.members || []) {
      if (member.type === 'node' && stopRoles.includes(member.role || '')) {
        const node = nodeIndex[member.ref];
        if (node && node.lat && node.lon) {
          const nodeTags = node.tags || {};
          const name = nodeTags.name || nodeTags['name:ru'] || member.role || 'Остановка';
          
          // Дедупликация по имени+координатам (в пределах 50м)
          const key = `${name}-${Math.round(node.lat * 1000)}-${Math.round(node.lon * 1000)}`;
          if (!seenStopNames.has(key)) {
            seenStopNames.add(key);
            stops.push({
              id: `osm-${node.id}`,
              name,
              location: { latitude: node.lat, longitude: node.lon },
              type,
              routes: [tags.ref || ref],
            });
          }
        }
      }
    }

    // Путь: собираем координаты из way-членов
    const path: { latitude: number; longitude: number }[] = [];
    for (const member of rel.members || []) {
      if (member.type === 'way') {
        const way = wayIndex[member.ref];
        if (way && way.nodes) {
          for (const nodeId of way.nodes) {
            const node = nodeIndex[nodeId];
            if (node && node.lat && node.lon) {
              // Избегаем дублирования точек на стыках way
              const last = path[path.length - 1];
              if (!last || last.latitude !== node.lat || last.longitude !== node.lon) {
                path.push({ latitude: node.lat, longitude: node.lon });
              }
            }
          }
        }
      }
    }

    // Определяем направление
    const from = tags.from || '';
    const to = tags.to || '';
    const routeName = tags.name || `Маршрут ${tags.ref || ref}`;

    results.push({
      id: `route-${rel.id}`,
      ref: tags.ref || ref,
      name: routeName,
      from,
      to,
      type,
      stops,
      path,
    });
  }

  return results;
};

// === ОСТАНОВКИ (без изменений) ===

const getOverpassQuery = (
  type: TransportType,
  bounds: { south: number; west: number; north: number; east: number }
): string => {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

  switch (type) {
    case 'bus':
      return `[out:json][timeout:25];(node["highway"="bus_stop"](${bbox});node["public_transport"="platform"]["bus"="yes"](${bbox}););out body;`;
    case 'metro':
      return `[out:json][timeout:25];(node["station"="subway"](${bbox});node["railway"="subway_entrance"](${bbox}););out body;`;
    case 'railway':
      return `[out:json][timeout:25];(node["railway"="station"](${bbox});node["railway"="halt"](${bbox}););out body;`;
    default:
      return '';
  }
};

const parseOverpassResponse = (data: any, type: TransportType): TransportStop[] => {
  if (!data.elements || !Array.isArray(data.elements)) return [];

  return data.elements
    .filter((el: any) => el.lat && el.lon)
    .map((el: any) => {
      const tags = el.tags || {};
      let name = tags.name || tags['name:ru'] || '';
      if (!name) {
        switch (type) {
          case 'bus': name = 'Автобусная остановка'; break;
          case 'metro': name = 'Станция метро'; break;
          case 'railway': name = 'Ж/Д станция'; break;
        }
      }
      const routes: string[] = [];
      if (tags.route_ref) {
        routes.push(...tags.route_ref.split(';').map((r: string) => r.trim()));
      }
      return {
        id: `osm-${el.id}`,
        name,
        location: { latitude: el.lat, longitude: el.lon },
        type,
        routes: routes.length > 0 ? routes : undefined,
      };
    });
};

export const fetchTransportStops = async (
  type: TransportType,
  center: Location,
  radiusKm: number = 2
): Promise<TransportStop[]> => {
  try {
    const latOffset = radiusKm / 111;
    const lonOffset = radiusKm / (111 * Math.cos(center.latitude * Math.PI / 180));
    const bounds = {
      south: center.latitude - latOffset,
      west: center.longitude - lonOffset,
      north: center.latitude + latOffset,
      east: center.longitude + lonOffset,
    };
    const query = getOverpassQuery(type, bounds);
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();
    return parseOverpassResponse(data, type);
  } catch (error) {
    console.error(`Error fetching ${type} stops:`, error);
    return [];
  }
};

export const searchStops = (stops: TransportStop[], query: string): TransportStop[] => {
  if (!query.trim()) return [];
  const lowerQuery = query.toLowerCase().trim();
  return stops.filter((stop) =>
    stop.name.toLowerCase().includes(lowerQuery) ||
    (stop.routes && stop.routes.some((r) => r.toLowerCase().includes(lowerQuery)))
  );
};

export const calculateDistance = (point1: Location, point2: Location): number => {
  const R = 6371e3;
  const f1 = (point1.latitude * Math.PI) / 180;
  const f2 = (point2.latitude * Math.PI) / 180;
  const df = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dl = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a = Math.sin(df / 2) * Math.sin(df / 2) +
    Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
