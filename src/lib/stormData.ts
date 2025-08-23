import { StormCone, StormTrack } from '@/types';



interface NHCStorm {
  id: string;
  binNumber: string;
  name: string;
  classification: string;
  intensity: number;
  pressure: number;
  latitude: number;
  longitude: number;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir: number;
  movementSpeed: number;
  lastUpdate: string;
  publicAdvisory: {
    url: string;
    issuance: string;
  };
  forecastAdvisory: {
    url: string;
    issuance: string;
  };
  windSpeedProbabilities: {
    url: string;
    issuance: string;
  };
  track: {
    url: string;
    issuance: string;
  };
  windWatchesWarnings: {
    url: string;
    issuance: string;
  };
  cone: {
    url: string;
    issuance: string;
  };
}

export async function fetchActiveStorms(): Promise<{ cones: StormCone[], tracks: StormTrack[], isRealData: boolean }> {
  try {
    // First, get the list of active storms
    const activeStormsResponse = await fetch('/api/nhc-storms');
    
    if (!activeStormsResponse.ok) {
      return { ...generateMockStormData(), isRealData: false };
    }
    
    const activeStorms: NHCStorm[] = await activeStormsResponse.json();
    
    if (!activeStorms || activeStorms.length === 0) {
      return { ...generateMockStormData(), isRealData: false };
    }
    
    // Process each active storm
    const cones: StormCone[] = [];
    const tracks: StormTrack[] = [];
    
    for (const storm of activeStorms) {
      try {
        // Get cone and track data
        const cone = createSimpleConeFromPoint(storm);
        cones.push(cone);

        // Try to get forecast track from KMZ
        const trackUrl = (storm as { forecastTrack?: { kmzFile?: string } }).forecastTrack?.kmzFile;
        if (trackUrl) {
          const track = await fetchTrackFromKMZ(storm, trackUrl);
          if (track) {
            tracks.push(track);
          }
        }
      } catch {
        // Storm processing failed, continue with next storm
      }
    }
    
    if (cones.length === 0 && tracks.length === 0) {
      return { ...generateMockStormData(), isRealData: false };
    }
    
    return { cones, tracks, isRealData: true };
    
  } catch {
    return { ...generateMockStormData(), isRealData: false };
  }
}

// Mock storm data for development and testing
export function generateMockStormData(): { cones: StormCone[], tracks: StormTrack[] } {
  // Large Mock Hurricanes strategically positioned to test future intersections with balloon trajectories
  const mockCones: StormCone[] = [
    {
      id: 'hurricane-mock-1',
      name: 'Hurricane Testing Large',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          // Massive hurricane covering Atlantic region where many balloons travel
          [-85.0, 20.0], [-75.0, 20.0], [-70.0, 25.0], [-68.0, 30.0], 
          [-70.0, 35.0], [-75.0, 40.0], [-85.0, 40.0], [-90.0, 35.0], 
          [-92.0, 30.0], [-90.0, 25.0], [-85.0, 20.0]
        ]]
      },
      properties: {
        stormName: 'Hurricane Testing Large',
        advisoryNumber: '15A',
        dateTime: new Date().toISOString(),
        maxWindSpeed: 140
      }
    },
    {
      id: 'hurricane-mock-2',
      name: 'Hurricane Pacific Giant',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          // Large Pacific hurricane for global testing
          [-140.0, 10.0], [-120.0, 10.0], [-115.0, 15.0], [-112.0, 20.0],
          [-115.0, 25.0], [-120.0, 30.0], [-140.0, 30.0], [-145.0, 25.0],
          [-148.0, 20.0], [-145.0, 15.0], [-140.0, 10.0]
        ]]
      },
      properties: {
        stormName: 'Hurricane Pacific Giant',
        advisoryNumber: '08A',
        dateTime: new Date().toISOString(),
        maxWindSpeed: 110
      }
    },
    {
      id: 'hurricane-mock-3',
      name: 'Hurricane Continental Test',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          // Huge area covering central/eastern US for maximum balloon intersection testing
          [-105.0, 25.0], [-80.0, 25.0], [-78.0, 30.0], [-75.0, 35.0],
          [-78.0, 40.0], [-85.0, 45.0], [-95.0, 48.0], [-105.0, 45.0],
          [-110.0, 40.0], [-108.0, 35.0], [-106.0, 30.0], [-105.0, 25.0]
        ]]
      },
      properties: {
        stormName: 'Hurricane Continental Test',
        advisoryNumber: '22A',
        dateTime: new Date().toISOString(),
        maxWindSpeed: 160
      }
    }
  ];

  const mockTracks: StormTrack[] = [
    {
      id: 'track-mock-1',
      name: 'Hurricane Testing Large Track',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-95.0, 15.0], [-90.0, 18.0], [-85.0, 22.0], [-80.0, 26.0], 
          [-75.0, 30.0], [-70.0, 34.0], [-65.0, 38.0], [-60.0, 42.0]
        ]
      },
      properties: {
        stormName: 'Hurricane Testing Large',
        category: 'Category 4',
        maxWindSpeed: 140
      }
    },
    {
      id: 'track-mock-2',
      name: 'Hurricane Pacific Giant Track',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-155.0, 5.0], [-150.0, 8.0], [-145.0, 12.0], [-140.0, 16.0],
          [-135.0, 20.0], [-130.0, 24.0], [-125.0, 28.0], [-120.0, 32.0]
        ]
      },
      properties: {
        stormName: 'Hurricane Pacific Giant',
        category: 'Category 3',
        maxWindSpeed: 110
      }
    },
    {
      id: 'track-mock-3',
      name: 'Hurricane Continental Test Track',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-115.0, 20.0], [-110.0, 25.0], [-105.0, 30.0], [-100.0, 35.0],
          [-95.0, 40.0], [-90.0, 45.0], [-85.0, 48.0], [-80.0, 50.0]
        ]
      },
      properties: {
        stormName: 'Hurricane Continental Test',
        category: 'Category 5',
        maxWindSpeed: 160
      }
    }
  ];

  return { cones: mockCones, tracks: mockTracks };
}

async function fetchTrackFromKMZ(storm: NHCStorm, kmzUrl: string): Promise<StormTrack | null> {
  try {
    const response = await fetch(`/api/nhc-kmz?url=${encodeURIComponent(kmzUrl)}`);
    if (!response.ok) return null;

    const geoJson = await response.json();
    const trackFeature = geoJson.features?.find((f: { geometry?: { type?: string } }) => f.geometry?.type === 'LineString');
    
    if (!trackFeature) return null;

    return {
      id: `${storm.id}-track`,
      name: `${storm.name} Forecast Track`,
      geometry: trackFeature.geometry,
      properties: {
        stormName: storm.name,
        category: storm.classification,
        maxWindSpeed: storm.intensity
      }
    };
      } catch {
      return null;
    }
}

// Create a simple cone from storm center point
function createSimpleConeFromPoint(storm: NHCStorm): StormCone {
  const lat = storm.latitudeNumeric;
  const lon = storm.longitudeNumeric;
  
  // Calculate radius based on storm intensity (more realistic)
  const intensity = typeof storm.intensity === 'string' ? parseInt(storm.intensity) : storm.intensity;
  let radius = 0.5; // Base radius in degrees
  
  if (intensity >= 157) radius = 1.2; // Category 5
  else if (intensity >= 130) radius = 1.0; // Category 4
  else if (intensity >= 111) radius = 0.8; // Category 3
  else if (intensity >= 96) radius = 0.6; // Category 2
  else if (intensity >= 74) radius = 0.5; // Category 1
  else radius = 0.3; // Tropical Storm
  
  // Create a simple circular cone
  const points: number[][] = [];
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * 2 * Math.PI;
    const x = lon + radius * Math.cos(angle);
    const y = lat + radius * Math.sin(angle);
    points.push([x, y]);
  }
  
  return {
    id: storm.id,
    name: storm.name,
    geometry: {
      type: 'Polygon',
      coordinates: [points]
    },
    properties: {
      stormName: storm.name,
      advisoryNumber: 'Current',
      dateTime: storm.lastUpdate,
      maxWindSpeed: intensity
    }
  };
}
