'use client';

import React, { useEffect, useState, useRef } from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl';
import { BalloonTrail, StormCone, StormTrack, ProximityAlert, HurricaneIntersection, FilterMode } from '@/types';
import { fetchBalloonData, generateMockBalloonData } from '@/lib/balloonData';
import { fetchActiveStorms, generateMockStormData } from '@/lib/stormData';
import { useRealHurricanes, useRealBalloons, isDebugMode } from '@/config/app';
import { 
  analyzeProximity, 
  getTrailSegmentsInRisk, 
  analyzeHurricaneIntersections,
  getBalloonsByIntersectionType,
  getRecentTrajectory,
  getPastIntersections,
  getFutureIntersections
} from '@/lib/proximityAnalysis';
import 'mapbox-gl/dist/mapbox-gl.css';

// Configure Mapbox to reduce telemetry requests
if (typeof window !== 'undefined') {
  // Disable Mapbox telemetry
  try {
    // @ts-ignore
    if (window.mapboxgl) {
      // @ts-ignore
      window.mapboxgl.config.API_URL = 'https://api.mapbox.com';
    }
  } catch (error) {
    // Ignore telemetry configuration errors
  }
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface AlertCardProps {
  alert: ProximityAlert;
  onClose: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onClose }) => (
  <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10">
    <div className="flex justify-between items-start mb-2">
      <h3 className="font-bold text-red-600">Proximity Alert</h3>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
    </div>
    <div className="space-y-1 text-sm">
      <p><strong>Balloon:</strong> {alert.balloonId}</p>
      <p><strong>Storm:</strong> {alert.stormName}</p>
      <p><strong>Closest Distance:</strong> {alert.closestDistance.toFixed(1)} km</p>
      <p><strong>Altitude:</strong> {(alert.altitude / 1000).toFixed(1)} km</p>
      <p><strong>Time:</strong> {new Date(alert.timestamp).toLocaleString()}</p>
      <p><strong>Inside Forecast Cone:</strong> {alert.insideForcastCone ? 'Yes' : 'No'}</p>
    </div>
  </div>
);

const BalloonRiskMap: React.FC = () => {
  const mapRef = useRef<MapRef>(null);
  const [balloonTrails, setBalloonTrails] = useState<BalloonTrail[]>([]);
  const [stormData, setStormData] = useState<{ cones: StormCone[], tracks: StormTrack[] }>({ cones: [], tracks: [] });
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<ProximityAlert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hurricaneIntersections, setHurricaneIntersections] = useState<HurricaneIntersection[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [displayTrails, setDisplayTrails] = useState<BalloonTrail[]>([]);
  const [usingRealStorms, setUsingRealStorms] = useState<boolean>(false);
  const [selectedBalloon, setSelectedBalloon] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Load balloon and storm data
        let balloons;
        if (useRealBalloons()) {
          if (isDebugMode()) console.log('🎈 Fetching balloon data from WindBorne API...');
          balloons = await fetchBalloonData();
        } else {
          if (isDebugMode()) console.log('🧪 Using mock balloon data...');
          balloons = generateMockBalloonData();
        }
        
        // Hurricane data configuration
        let stormResult;
        if (useRealHurricanes()) {
          if (isDebugMode()) console.log('🌪️ Fetching real hurricane data from NHC...');
          stormResult = await fetchActiveStorms();
        } else {
          if (isDebugMode()) console.log('🧪 Using large mock hurricanes for testing...');
          stormResult = { ...generateMockStormData(), isRealData: false };
        }
        
        const storms = { cones: stormResult.cones, tracks: stormResult.tracks };
        setUsingRealStorms(stormResult.isRealData);
        
        if (balloons.length === 0 && useRealBalloons()) {
          if (isDebugMode()) console.warn('No balloon data received from API, falling back to mock data');
          const mockBalloons = generateMockBalloonData();
          setBalloonTrails(mockBalloons);
          
          // Analyze proximity with mock data
          const alerts = analyzeProximity(mockBalloons, storms.cones);
          setProximityAlerts(alerts);
          
          // Analyze hurricane intersections (including trajectory analysis)
          const intersections = analyzeHurricaneIntersections(mockBalloons, storms.cones, storms.tracks);
          setHurricaneIntersections(intersections);
          
          setDisplayTrails(mockBalloons);
        } else {
          console.log(`Successfully loaded ${balloons.length} balloon trails from API`);
          setBalloonTrails(balloons);
          
          // Analyze proximity with real data
          const alerts = analyzeProximity(balloons, storms.cones);
          setProximityAlerts(alerts);
          
                  // Analyze hurricane intersections (including trajectory analysis)
        const intersections = analyzeHurricaneIntersections(balloons, storms.cones, storms.tracks);
        setHurricaneIntersections(intersections);
          
          console.log(`🌪️ Found ${getPastIntersections(intersections).length} past intersections`);
          console.log(`⚠️ Found ${getFutureIntersections(intersections).length} future intersections`);
          
          setDisplayTrails(balloons);
        }
        
        if (isDebugMode()) {
          console.log(`📊 Storm data loaded: ${storms.cones.length} cones, ${storms.tracks.length} tracks`);
          if (storms.tracks.length > 0) {
            console.log('🌪️ Storm tracks:', storms.tracks.map(t => t.name));
          }
        }
        
        setStormData(storms);
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to mock data if API fails
        const mockBalloons = generateMockBalloonData();
        const storms = generateMockStormData();
        
        setBalloonTrails(mockBalloons);
        setStormData(storms);
        
        const alerts = analyzeProximity(mockBalloons, storms.cones);
        setProximityAlerts(alerts);
      }
      
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Handle filter mode changes
  useEffect(() => {
    if (balloonTrails.length === 0) return;

    let filteredTrails: BalloonTrail[] = [];

    switch (filterMode) {
      case 'all':
        filteredTrails = balloonTrails;
        break;
      case 'past-intersections':
        filteredTrails = getBalloonsByIntersectionType(balloonTrails, hurricaneIntersections, 'past');
        break;
      case 'future-intersections':
        // For future intersections, show only recent 5-hour trajectory
        const futureBalloons = getBalloonsByIntersectionType(balloonTrails, hurricaneIntersections, 'future');
        filteredTrails = futureBalloons.map(trail => getRecentTrajectory(trail, 5));
        break;
    }

    setDisplayTrails(filteredTrails);
  }, [filterMode, balloonTrails, hurricaneIntersections]);

  // Create GeoJSON for balloon trails and points
  const balloonFeatures: any[] = [];
  
  displayTrails.forEach(trail => {
    // Determine the risk and intersection status
    const isRisk = proximityAlerts.some(alert => alert.balloonId === trail.balloonId);
    const pastIntersection = hurricaneIntersections.find(
      intersection => intersection.balloonId === trail.balloonId && intersection.intersectionType === 'past'
    );
    const futureIntersection = hurricaneIntersections.find(
      intersection => intersection.balloonId === trail.balloonId && intersection.intersectionType === 'future'
    );
    
    if (trail.points.length >= 2) {
      // Determine color and styling based on intersection type
      let trailColor = trail.color;
      let trailType = 'trail';
      
      if (pastIntersection) {
        trailColor = '#ff6b35'; // Orange for past intersections
        trailType = 'past-intersection';
      } else if (futureIntersection) {
        trailColor = '#ff0000'; // Red for future intersections
        trailType = 'future-intersection';
      }
      
      // Create line for the balloon flight path
      balloonFeatures.push({
        type: 'Feature',
        properties: {
          balloonId: trail.balloonId,
          color: trailColor,
          isRisk,
          altitude: trail.points[0]?.altitude || 0,
          type: trailType,
          pastIntersection: !!pastIntersection,
          futureIntersection: !!futureIntersection
        },
        geometry: {
          type: 'LineString',
          coordinates: trail.points.map(point => [point.longitude, point.latitude])
        }
      });
      
      // Add current position (last point) as a circle
      const currentPosition = trail.points[trail.points.length - 1];
      if (currentPosition) {
        balloonFeatures.push({
          type: 'Feature',
          properties: {
            balloonId: trail.balloonId,
            color: trailColor,
            isRisk,
            altitude: currentPosition.altitude,
            timestamp: currentPosition.timestamp,
            type: 'current-position',
            pastIntersection: !!pastIntersection,
            futureIntersection: !!futureIntersection
          },
          geometry: {
            type: 'Point',
            coordinates: [currentPosition.longitude, currentPosition.latitude]
          }
        });
      }
    }
  });

  const balloonTrailsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: balloonFeatures
  };

  // Create GeoJSON for storm cones
  const stormConesGeoJSON = {
    type: 'FeatureCollection' as const,
    features: stormData.cones.map(cone => ({
      type: 'Feature' as const,
      properties: {
        stormName: cone.properties.stormName,
        maxWindSpeed: cone.properties.maxWindSpeed
      },
      geometry: cone.geometry
    }))
  };

  // Create GeoJSON for storm tracks
  const stormTracksGeoJSON = {
    type: 'FeatureCollection' as const,
    features: stormData.tracks.map(track => ({
      type: 'Feature' as const,
      properties: {
        stormName: track.properties.stormName,
        category: track.properties.category
      },
      geometry: track.geometry
    }))
  };

  const handleMapClick = (event: any) => {
    const features = mapRef.current?.queryRenderedFeatures(event.point);
    
    if (features && features.length > 0) {
      // Check for balloon current position clicks first
      const balloonPositionFeature = features.find(f => f.source === 'balloon-trails' && f.properties?.type === 'current-position');
      
      if (balloonPositionFeature && balloonPositionFeature.properties) {
        const coords = (balloonPositionFeature.geometry as any)?.coordinates;
        setSelectedBalloon({
          balloonId: balloonPositionFeature.properties.balloonId,
          altitude: balloonPositionFeature.properties.altitude,
          timestamp: balloonPositionFeature.properties.timestamp,
          coordinates: coords,
          pastIntersection: balloonPositionFeature.properties.pastIntersection,
          futureIntersection: balloonPositionFeature.properties.futureIntersection
        });
        return;
      }
      
      // Fallback to existing alert functionality for trail clicks
      const balloonFeature = features.find(f => f.source === 'balloon-trails');
      
      if (balloonFeature) {
        const balloonId = balloonFeature.properties?.balloonId;
        const alert = proximityAlerts.find(a => a.balloonId === balloonId);
        
        if (alert) {
          setSelectedAlert(alert);
        }
      }
    }
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Mapbox Token Required</h2>
          <p>Please add your Mapbox access token to .env.local</p>
          <p className="text-sm text-gray-600 mt-2">
            NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-2">Loading WindBorne Balloon Data...</div>
          <div className="text-sm text-gray-400">Fetching balloon positions from the last 24 hours</div>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -75,
          latitude: 30,
          zoom: 4
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onClick={handleMapClick}
      >
        {/* Balloon Flight Paths */}
        <Source id="balloon-trails" type="geojson" data={balloonTrailsGeoJSON}>
          {/* Normal flight path trails */}
          <Layer
            id="balloon-trails-normal"
            type="line"
            filter={['==', ['get', 'type'], 'trail']}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 2,
              'line-opacity': 0.6
            }}
          />
          {/* Past intersection trails */}
          <Layer
            id="balloon-trails-past"
            type="line"
            filter={['==', ['get', 'type'], 'past-intersection']}
            paint={{
              'line-color': '#ff6b35', // Orange for past intersections
              'line-width': 3,
              'line-opacity': 0.8
            }}
          />
          {/* Future intersection trails */}
          <Layer
            id="balloon-trails-future"
            type="line"
            filter={['==', ['get', 'type'], 'future-intersection']}
            paint={{
              'line-color': '#ff0000', // Red for future intersections
              'line-width': 4,
              'line-opacity': 0.9,
              'line-dasharray': [2, 1] // Dashed for future
            }}
          />
          {/* Current balloon positions */}
          <Layer
            id="balloon-current-positions"
            type="circle"
            filter={['==', ['get', 'type'], 'current-position']}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': [
                'case',
                ['get', 'futureIntersection'], 10, // Largest for future intersections
                ['get', 'pastIntersection'], 8,   // Medium for past intersections
                6  // Normal size for regular balloons
              ],
              'circle-opacity': 0.9,
              'circle-stroke-width': [
                'case',
                ['get', 'futureIntersection'], 3,
                ['get', 'pastIntersection'], 2,
                1
              ],
              'circle-stroke-color': '#ffffff'
            }}

          />
        </Source>

        {/* Storm Cones */}
        <Source id="storm-cones" type="geojson" data={stormConesGeoJSON}>
          <Layer
            id="storm-cones-fill"
            type="fill"
            paint={{
              'fill-color': '#9333ea',
              'fill-opacity': 0.3
            }}
          />
          <Layer
            id="storm-cones-outline"
            type="line"
            paint={{
              'line-color': '#7c3aed',
              'line-width': 2,
              'line-opacity': 0.8
            }}
          />
        </Source>

        {/* Storm Tracks */}
        <Source id="storm-tracks" type="geojson" data={stormTracksGeoJSON}>
          <Layer
            id="storm-tracks-layer"
            type="line"
            paint={{
              'line-color': '#7c3aed',
              'line-width': 3,
              'line-dasharray': [2, 2]
            }}
          />
        </Source>
      </Map>

      {/* Alert Card */}
      {selectedAlert && (
        <AlertCard
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}

      {/* Balloon Popup */}
      {selectedBalloon && (
        <div className="absolute top-56 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10 border">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-blue-600">Balloon Details</h3>
            <button onClick={() => setSelectedBalloon(null)} className="text-gray-500 hover:text-gray-700">×</button>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-black"><strong>ID:</strong> {selectedBalloon.balloonId}</p>
            <p className="text-black"><strong>Altitude:</strong> {selectedBalloon.altitude.toFixed(2)} km</p>
            <p className="text-black"><strong>Position:</strong> {selectedBalloon.coordinates[1].toFixed(2)}°N, {Math.abs(selectedBalloon.coordinates[0]).toFixed(2)}°W</p>
            <p className="text-black"><strong>Last Update:</strong> {new Date(selectedBalloon.timestamp).toLocaleString()}</p>
            {selectedBalloon.pastIntersection && (
              <p className="text-orange-600 font-medium">⚠️ Past Hurricane Intersection</p>
            )}
            {selectedBalloon.futureIntersection && (
              <p className="text-red-600 font-medium">🚨 Future Hurricane Risk</p>
            )}
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 text-sm border">
        <h3 className="font-bold mb-3 text-black">Hurricane Intersection Filter</h3>
        <div className="space-y-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="filter"
              value="all"
              checked={filterMode === 'all'}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className="mr-3"
            />
            <span className="text-black">All Balloons ({balloonTrails.length})</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="filter"
              value="past-intersections"
              checked={filterMode === 'past-intersections'}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className="mr-3"
            />
            <span className="text-black">Past Intersections ({getPastIntersections(hurricaneIntersections).length})</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="filter"
              value="future-intersections"
              checked={filterMode === 'future-intersections'}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className="mr-3"
            />
            <span className="text-black">Future Intersections ({getFutureIntersections(hurricaneIntersections).length})</span>
          </label>
        </div>
        {filterMode === 'future-intersections' && (
          <div className="mt-3 pt-2 border-t text-xs text-black">
            Showing 5-hour trajectory for future intersection balloons
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 text-sm border">
        <h3 className="font-bold mb-2 text-black">Legend</h3>
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-4 h-0.5 bg-blue-500 mr-2"></div>
            <span className="text-black">Normal Flight Path</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-0.5 mr-2" style={{backgroundColor: '#ff6b35'}}></div>
            <span className="text-black">Past Hurricane Intersection</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-0.5 bg-red-500 mr-2 border-dashed"></div>
            <span className="text-black">Future Hurricane Risk</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 border-2 border-white"></div>
            <span className="text-black">Current Position</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-0.5 bg-red-500 border-dashed mr-2"></div>
            <span className="text-black">Storm Track</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-2 bg-red-300 border border-red-500 mr-2"></div>
            <span className="text-black">Hurricane Cone</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs text-gray-600">
            Each line shows 24-hour balloon flight path
          </p>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 text-sm border">
        <h3 className="font-bold mb-2 text-black">Hurricane Intersection Analysis</h3>
        <div className="space-y-1">
          <p className="text-black">Total Balloons: {balloonTrails.length}</p>
          <p className="text-black">Currently Displaying: {displayTrails.length}</p>
          <p className="text-orange-600 font-medium">
            Past Intersections: {getPastIntersections(hurricaneIntersections).length}
          </p>
          <p className="text-red-600 font-medium">
            Future Risk: {getFutureIntersections(hurricaneIntersections).length}
          </p>
          <p className="text-black">
            Active Storms: {stormData.cones.length} 
            <span className={`text-xs ml-1 ${usingRealStorms ? 'text-green-600' : 'text-orange-600'}`}>
              ({usingRealStorms ? 'Real NHC Data' : 'Mock Data'})
            </span>
          </p>
          <div className="mt-2 pt-2 border-t text-xs text-gray-600">
            <p>🌪️ Hurricanes: {useRealHurricanes() ? 'Real NHC API' : 'Mock Testing'}</p>
            <p>🎈 Balloons: {useRealBalloons() ? 'WindBorne API' : 'Mock Testing'}</p>
          </div>
        </div>
        {filterMode !== 'all' && (
          <div className="mt-2 pt-2 border-t text-xs text-black">
            Filter: {filterMode === 'past-intersections' ? 'Past Intersections' : 'Future Risk (5h trajectory)'}
          </div>
        )}
      </div>
    </div>
  );
};

export default BalloonRiskMap;
