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

// Import components
import Legend from './Legend';
import HelpModal from './HelpModal';
import HelpIcon from './HelpIcon';
import StatsPanel from './StatsPanel';
import FilterControls from './FilterControls';
import AnimationControls from './AnimationControls';
import BalloonPopup from './BalloonPopup';
import AlertCard from './AlertCard';

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
  const [animatedPath, setAnimatedPath] = useState<[number, number][]>([]);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Load balloon and storm data
        let balloons;
        if (useRealBalloons()) {
          balloons = await fetchBalloonData();
        } else {
          balloons = generateMockBalloonData();
        }
        
        // Hurricane data configuration
        let stormResult;
        if (useRealHurricanes()) {
          stormResult = await fetchActiveStorms();
        } else {
          stormResult = { ...generateMockStormData(), isRealData: false };
        }
        
        const storms = { cones: stormResult.cones, tracks: stormResult.tracks };
        setUsingRealStorms(stormResult.isRealData);
        
        if (balloons.length === 0 && useRealBalloons()) {
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
          setBalloonTrails(balloons);
          
          // Analyze proximity with real data
          const alerts = analyzeProximity(balloons, storms.cones);
          setProximityAlerts(alerts);
          
          // Analyze hurricane intersections (including trajectory analysis)
          const intersections = analyzeHurricaneIntersections(balloons, storms.cones, storms.tracks);
          setHurricaneIntersections(intersections);
          
          setDisplayTrails(balloons);
        }
        
        setStormData(storms);
      } catch (error) {
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

  const selectRandomBalloon = () => {
    if (balloonTrails.length === 0) return;
    const randomIndex = Math.floor(Math.random() * balloonTrails.length);
    const randomBalloon = balloonTrails[randomIndex];
    setSelectedBalloonForAnimation(randomBalloon);
  };

  const startAnimation = () => {
    if (!selectedBalloonForAnimation || !mapRef.current) return;
    
    // Store current filter state to restore later
    const currentFilterMode = filterMode;
    
    // Temporarily set filter to 'all' to show the full balloon trail during animation
    setFilterMode('all');
    
    setIsAnimating(true);
    setAnimatedPath([]);
    const map = mapRef.current.getMap();
    const points = selectedBalloonForAnimation.points;
    
    const path = points.map(point => [point.longitude, point.latitude]);
    const altitudes = points.map(point => point.altitude);
    
    const animationDuration = 30000;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      if (progress >= 1) {
        setIsAnimating(false);
        setAnimationProgress(null);
        return;
      }
      
      const pathIndex = progress * (path.length - 1);
      const index1 = Math.floor(pathIndex);
      const index2 = Math.min(index1 + 1, path.length - 1);
      const fraction = pathIndex - index1;
      
      const point1 = path[index1];
      const point2 = path[index2];
      const currentLon = point1[0] + (point2[0] - point1[0]) * fraction;
      const currentLat = point1[1] + (point2[1] - point1[1]) * fraction;
      
      const alt1 = altitudes[index1];
      const alt2 = altitudes[index2];
      const currentAlt = alt1 + (alt2 - alt1) * fraction;
      
      // Update animated path progressively
      setAnimatedPath(prev => [...prev.slice(0, index1 + 1), [currentLon, currentLat]]);
      
      setAnimationProgress({
        progress: progress * 100,
        altitude: currentAlt,
        position: [currentLon, currentLat]
      });
      
      // Keep default zoom level
      map.easeTo({
        center: [currentLon, currentLat],
        zoom: 4,
        bearing: 0,
        pitch: 0,
        duration: 200,
        easing: (t) => t
      });
      
      animationRef.current = setTimeout(animate, 200);
    };
    
    animate();
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    setAnimationProgress(null);
    setAnimatedPath([]);
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
    // Note: Filter mode will be restored by the user manually if needed
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
                 {/* Balloon Flight Paths - Hidden during animation */}
         {!isAnimating && (
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
         )}

         {/* Progressive animated path - Outside balloon trails source */}
         {isAnimating && animatedPath.length > 1 && (
           <Source id="animated-path" type="geojson" data={{
             type: 'FeatureCollection',
             features: [{
               type: 'Feature',
               properties: {},
               geometry: {
                 type: 'LineString',
                 coordinates: animatedPath
               }
             }]
           }}>
             <Layer
               id="animated-path-layer"
               type="line"
               paint={{
                 'line-color': '#9333ea',
                 'line-width': 4,
                 'line-opacity': 0.8
               }}
             />
           </Source>
         )}
         
         {/* Balloon marker (circle instead of emoji) - Outside balloon trails source */}
         {isAnimating && animationProgress && (
           <Source id="balloon-marker" type="geojson" data={{
             type: 'FeatureCollection',
             features: [{
               type: 'Feature',
               properties: {},
               geometry: {
                 type: 'Point',
                 coordinates: animationProgress.position
               }
             }]
           }}>
             <Layer
               id="balloon-marker-layer"
               type="circle"
               paint={{
                 'circle-color': '#9333ea',
                 'circle-radius': 8,
                 'circle-opacity': 1.0,
                 'circle-stroke-width': 3,
                 'circle-stroke-color': '#ffffff'
               }}
             />
           </Source>
         )}

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
      <BalloonPopup
        selectedBalloon={selectedBalloon}
        onClose={() => setSelectedBalloon(null)}
      />

      {/* Filter Controls */}
      <FilterControls
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        balloonTrails={balloonTrails}
        hurricaneIntersections={hurricaneIntersections}
      />

      {/* Animation Controls */}
      <AnimationControls
        selectedBalloonForAnimation={selectedBalloonForAnimation}
        isAnimating={isAnimating}
        animationProgress={animationProgress}
        onSelectRandom={selectRandomBalloon}
        onStartAnimation={startAnimation}
        onStopAnimation={stopAnimation}
        onReplayAnimation={replayAnimation}
        onReset={() => {
          setSelectedBalloonForAnimation(null);
          stopAnimation();
        }}
      />

      {/* Legend */}
      <Legend />

      {/* Stats Panel */}
      <StatsPanel
        balloonTrails={balloonTrails}
        displayTrails={displayTrails}
        hurricaneIntersections={hurricaneIntersections}
        stormData={stormData}
        usingRealStorms={usingRealStorms}
        filterMode={filterMode}
      />

      {/* Help Icon */}
      {!showHelpModal && <HelpIcon onClick={() => setShowHelpModal(true)} />}

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
};

export default BalloonRiskMap;
