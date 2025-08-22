export interface BalloonDataPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: string;
  balloonId: string;
}

export interface BalloonTrail {
  balloonId: string;
  points: BalloonDataPoint[];
  color: string;
}

export interface StormCone {
  id: string;
  name: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: {
    stormName: string;
    advisoryNumber: string;
    dateTime: string;
    maxWindSpeed: number;
  };
}

export interface StormTrack {
  id: string;
  name: string;
  geometry: GeoJSON.LineString;
  properties: {
    stormName: string;
    category: string;
    maxWindSpeed: number;
  };
}

export interface ProximityAlert {
  balloonId: string;
  stormName: string;
  closestDistance: number; // in km
  timestamp: string;
  altitude: number;
  insideForcastCone: boolean;
}

export interface HurricaneIntersection {
  balloonId: string;
  stormName: string;
  intersectionType: 'past' | 'future';
  closestDistance: number;
  timestamp: string;
  altitude: number;
  insideForcastCone: boolean;
  hoursFromNow: number; // negative for past, positive for future
}

export type FilterMode = 'all' | 'past-intersections' | 'future-intersections';
