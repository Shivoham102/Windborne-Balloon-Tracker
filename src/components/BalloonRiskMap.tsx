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
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [currentAnimation, setCurrentAnimation] = useState<any>(null);
  const [selectedBalloonForAnimation, setSelectedBalloonForAnimation] = useState<BalloonTrail | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const [animationProgress, setAnimationProgress] = useState<{ progress: number; altitude: number; position: [number, number] } | null>(null);

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
          
          const pastIntersections = getPastIntersections(intersections);
          const futureIntersections = getFutureIntersections(intersections);
          const uniquePastBalloons = new Set(pastIntersections.map(i => i.balloonId));
          const uniqueFutureBalloons = new Set(futureIntersections.map(i => i.balloonId));
          
          console.log(`🌪️ Found ${pastIntersections.length} past intersection points from ${uniquePastBalloons.size} balloons`);
          console.log(`⚠️ Found ${futureIntersections.length} future intersection points from ${uniqueFutureBalloons.size} balloons`);
          
          if (isDebugMode() && pastIntersections.length > 0) {
            console.log('Past intersection details:', pastIntersections.map(i => `${i.balloonId} at ${i.timestamp}`));
          }
          
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
             // Determine color and styling based on intersection type and animation state
       let trailColor = trail.color;
       let trailType = 'trail';
       
               // Highlight the balloon being animated
        if (isAnimating && selectedBalloonForAnimation && trail.balloonId === selectedBalloonForAnimation.balloonId) {
          trailColor = '#9333ea'; // Purple for animated balloon
          trailType = 'animated';
        } else if (pastIntersection) {
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
                 type: isAnimating && selectedBalloonForAnimation && trail.balloonId === selectedBalloonForAnimation.balloonId ? 'animated' : 'current-position',
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

  const selectRandomBalloon = () => {
    if (balloonTrails.length === 0) return;
    const randomIndex = Math.floor(Math.random() * balloonTrails.length);
    const randomBalloon = balloonTrails[randomIndex];
    setSelectedBalloonForAnimation(randomBalloon);
  };

  const startAnimation = () => {
    if (!selectedBalloonForAnimation || !mapRef.current) return;
    
    setIsAnimating(true);
    const map = mapRef.current.getMap();
    const points = selectedBalloonForAnimation.points;
    
    // Create a smooth path along the trajectory
    const path = points.map(point => [point.longitude, point.latitude]);
    const altitudes = points.map(point => point.altitude);
    
    const animationDuration = 30000; // 30 seconds total
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      if (progress >= 1) {
        // Animation complete
        setIsAnimating(false);
        setAnimationProgress(null);
        return;
      }
      
      // Find current position along the path
      const pathIndex = progress * (path.length - 1);
      const index1 = Math.floor(pathIndex);
      const index2 = Math.min(index1 + 1, path.length - 1);
      const fraction = pathIndex - index1;
      
      // Interpolate between points
      const point1 = path[index1];
      const point2 = path[index2];
      const currentLon = point1[0] + (point2[0] - point1[0]) * fraction;
      const currentLat = point1[1] + (point2[1] - point1[1]) * fraction;
      
      // Interpolate altitude
      const alt1 = altitudes[index1];
      const alt2 = altitudes[index2];
      const currentAlt = alt1 + (alt2 - alt1) * fraction;
      
      // Calculate bearing to show the flight direction
      const bearing = Math.atan2(point2[1] - point1[1], point2[0] - point1[0]) * 180 / Math.PI;
      
      // Update animation progress for UI display
      setAnimationProgress({
        progress: progress * 100,
        altitude: currentAlt,
        position: [currentLon, currentLat]
      });
      
      // Use easeTo for smoother camera movement
      map.easeTo({
        center: [currentLon, currentLat],
        zoom: 8,
        bearing: bearing, // Follow the flight direction
        pitch: 75, // Steeper pitch for better side view
        duration: 200, // Slightly longer duration for smoother movement
        easing: (t) => t // Linear easing for consistent speed
      });
      
      // Continue animation with longer interval for smoother movement
      animationRef.current = setTimeout(animate, 200);
    };
    
    animate();
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    setAnimationProgress(null);
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      map.flyTo({
        center: [-75, 30],
        zoom: 4,
        bearing: 0,
        pitch: 0,
        duration: 2000
      });
    }
  };

  const replayAnimation = () => {
    if (selectedBalloonForAnimation) {
      startAnimation();
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
           zoom: 4,
           pitch: 0,
           bearing: 0
         }}
         style={{ width: '100%', height: '100%' }}
         mapStyle="mapbox://styles/mapbox/streets-v12"
         projection={{ name: "globe" }}
         onClick={handleMapClick}
         onLoad={() => {
           // Add atmosphere/fog effect and ensure 3D globe
           if (mapRef.current) {
             const map = mapRef.current.getMap();
             
             // Set fog for atmosphere effect
             map.setFog({
               'color': 'rgb(186, 210, 235)', // Atmospheric color
               'high-color': 'rgb(36, 92, 223)', // High atmosphere color
               'horizon-blend': 0.02, // Horizon fade
               'space-color': 'rgb(11, 11, 25)', // Space color
               'star-intensity': 0.6 // Star visibility
             });
             
             // Ensure globe projection is active
             map.setProjection('globe');
           }
         }}
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
                       {/* Animated balloon trail */}
            <Layer
              id="balloon-trails-animated"
              type="line"
              filter={['==', ['get', 'type'], 'animated']}
              paint={{
                'line-color': '#9333ea', // Purple for animated balloon
                'line-width': 6,
                'line-opacity': 1.0,
                'line-dasharray': [4, 2] // Dashed for animated
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
                 ['all', ['get', 'futureIntersection'], ['!=', ['get', 'type'], 'animated']], 10, // Largest for future intersections
                 ['all', ['get', 'pastIntersection'], ['!=', ['get', 'type'], 'animated']], 8,   // Medium for past intersections
                 ['==', ['get', 'type'], 'animated'], 12, // Largest for animated balloon
                 6  // Normal size for regular balloons
               ],
              'circle-opacity': 0.9,
                             'circle-stroke-width': [
                 'case',
                 ['all', ['get', 'futureIntersection'], ['!=', ['get', 'type'], 'animated']], 3,
                 ['all', ['get', 'pastIntersection'], ['!=', ['get', 'type'], 'animated']], 2,
                 ['==', ['get', 'type'], 'animated'], 4, // Thicker stroke for animated balloon
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

             {/* Animation Controls */}
       <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs border" style={{ top: '200px', width: '200px' }}>
         <h3 className="font-bold mb-2 text-black text-xs">🎈 Balloon Animation</h3>
         <div className="space-y-1">
           {!selectedBalloonForAnimation ? (
             <button
               onClick={selectRandomBalloon}
               className="w-full bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors text-xs"
             >
               Select Random
             </button>
           ) : (
             <>
               <div className="text-xs text-black mb-1">
                 {selectedBalloonForAnimation.balloonId}
               </div>
                               {!isAnimating ? (
                  <button
                    onClick={startAnimation}
                    className="w-full bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition-colors text-xs"
                  >
                    ▶️ Start Animation
                  </button>
                ) : (
                  <button
                    onClick={stopAnimation}
                    className="w-full bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors text-xs"
                  >
                    ⏹️ Stop
                  </button>
                )}
                               <button
                  onClick={replayAnimation}
                  disabled={isAnimating}
                  className="w-full bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 transition-colors disabled:opacity-50 text-xs"
                >
                  🔄 Replay
                </button>
               <button
                 onClick={() => {
                   setSelectedBalloonForAnimation(null);
                   stopAnimation();
                 }}
                 className="w-full bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors text-xs"
               >
                 🏠 Reset
               </button>
             </>
           )}
         </div>
         
         {/* Animation Progress Indicator */}
         {isAnimating && animationProgress && (
           <div className="mt-3 pt-2 border-t">
             <div className="text-xs text-black mb-1">
               <strong>Progress:</strong> {animationProgress.progress.toFixed(1)}%
             </div>
             <div className="text-xs text-black mb-1">
               <strong>Altitude:</strong> {animationProgress.altitude.toFixed(2)} km
             </div>
             <div className="text-xs text-black">
               <strong>Position:</strong> {animationProgress.position[1].toFixed(2)}°N, {Math.abs(animationProgress.position[0]).toFixed(2)}°W
             </div>
             <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
               <div 
                 className="bg-blue-500 h-1 rounded-full transition-all duration-100" 
                 style={{ width: `${animationProgress.progress}%` }}
               ></div>
             </div>
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
            <div className="w-4 h-0.5 mr-2 border-2 border-dashed border-red-500"></div>
            <span className="text-black">Future Hurricane Risk</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 border-2 border-white"></div>
            <span className="text-black">Current Position</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-0.5 mr-2 border-2 border-dashed" style={{borderColor: '#7c3aed'}}></div>
            <span className="text-black">Storm Track</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-2 mr-2 border-2" style={{backgroundColor: '#9333ea', borderColor: '#7c3aed', opacity: 0.3}}></div>
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
            Past Intersections: {new Set(getPastIntersections(hurricaneIntersections).map(i => i.balloonId)).size}
          </p>
          <p className="text-red-600 font-medium">
            Future Risk: {new Set(getFutureIntersections(hurricaneIntersections).map(i => i.balloonId)).size}
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
