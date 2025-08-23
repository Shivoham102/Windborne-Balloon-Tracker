import * as turf from '@turf/turf';
import { BalloonTrail, StormCone, StormTrack, ProximityAlert, HurricaneIntersection } from '@/types';

const RISK_THRESHOLD_KM = 100; // Distance threshold for risk alerts

export function analyzeProximity(
  balloonTrails: BalloonTrail[],
  stormCones: StormCone[]
): ProximityAlert[] {
  const alerts: ProximityAlert[] = [];

  balloonTrails.forEach(trail => {
    stormCones.forEach(storm => {
      // Find the closest point on the trail to the storm and its distance
      const closestPointResult = findClosestPointToStorm(trail, storm);
      
      if (closestPointResult && closestPointResult.distance <= RISK_THRESHOLD_KM) {
        alerts.push({
          balloonId: trail.balloonId,
          stormName: storm.properties.stormName,
          closestDistance: closestPointResult.distance,
          timestamp: closestPointResult.point.timestamp,
          altitude: closestPointResult.point.altitude,
          insideForcastCone: isPointInsidePolygon(closestPointResult.point, storm.geometry)
        });
      }
    });
  });

  return alerts.sort((a, b) => a.closestDistance - b.closestDistance);
}

function findClosestPointToStorm(trail: BalloonTrail, storm: StormCone): { point: { longitude: number; latitude: number; altitude: number; timestamp: string; balloonId: string }, distance: number } | null {
  let closestPoint: { longitude: number; latitude: number; altitude: number; timestamp: string; balloonId: string } | null = null;
  let minDistance = Infinity;

  trail.points.forEach(point => {
    const pointGeom = turf.point([point.longitude, point.latitude]);
    
    // Calculate distance from point to polygon
    let distance: number;
    
    // Check if point is inside the polygon first
    if ((turf as any).booleanPointInPolygon(pointGeom, storm.geometry)) {
      distance = 0; // Inside the storm cone
    } else {
      // Calculate distance to the polygon boundary
      // For polygons, we need to find the closest point on the polygon boundary
      const polygonCoords = storm.geometry.type === 'Polygon' 
        ? storm.geometry.coordinates[0] 
        : storm.geometry.coordinates[0][0];
      
      const polygonLine = turf.lineString(polygonCoords);
      const nearestPointOnLine = (turf as any).nearestPointOnLine(polygonLine, pointGeom);
      distance = turf.distance(pointGeom, nearestPointOnLine, { units: 'kilometers' } as any);
    }
    
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
    }
  });

  return closestPoint ? { point: closestPoint, distance: minDistance } : null;
}

function isPointInsidePolygon(point: { longitude: number, latitude: number }, polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
  const pointGeom = turf.point([point.longitude, point.latitude]);
  return (turf as any).booleanPointInPolygon(pointGeom, polygon);
}

export function getTrailSegmentsInRisk(
  trail: BalloonTrail,
  stormCones: StormCone[],
  riskThreshold: number = RISK_THRESHOLD_KM
): number[] {
  const riskSegments: number[] = [];

  for (let i = 0; i < trail.points.length - 1; i++) {
    const startPoint = turf.point([trail.points[i].longitude, trail.points[i].latitude]);
    const endPoint = turf.point([trail.points[i + 1].longitude, trail.points[i + 1].latitude]);

    const isInRisk = stormCones.some(storm => {
      // Check if either endpoint is within risk threshold
      const startDistance = calculateDistanceToPolygon(startPoint, storm.geometry);
      const endDistance = calculateDistanceToPolygon(endPoint, storm.geometry);
      
      return startDistance <= riskThreshold || endDistance <= riskThreshold;
    });

    if (isInRisk) {
      riskSegments.push(i);
    }
  }

  return riskSegments;
}

export function analyzeHurricaneIntersections(
  balloonTrails: BalloonTrail[],
  stormCones: StormCone[],
  stormTracks: StormTrack[] = [],
  riskThreshold: number = RISK_THRESHOLD_KM
): HurricaneIntersection[] {
  const intersections: HurricaneIntersection[] = [];
  const now = new Date();

  balloonTrails.forEach(trail => {
    stormCones.forEach(storm => {
      // Analyze each point in the balloon's trail
      trail.points.forEach(point => {
        const pointGeom = (turf as any).point([point.longitude, point.latitude]);
        const distance = calculateDistanceToPolygon(pointGeom, storm.geometry);
        
        if (distance <= riskThreshold) {
          const pointTime = new Date(point.timestamp);
          const hoursFromNow = (pointTime.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          // Determine if this is a past or future intersection
          const intersectionType: 'past' | 'future' = hoursFromNow <= 0 ? 'past' : 'future';
          
          intersections.push({
            balloonId: trail.balloonId,
            stormName: storm.properties.stormName,
            intersectionType,
            closestDistance: distance,
            timestamp: point.timestamp,
            altitude: point.altitude,
            insideForcastCone: (turf as any).booleanPointInPolygon(pointGeom, storm.geometry),
            hoursFromNow
          });
        }
      });

      // Check future trajectory intersections with hurricane track
      const futureIntersections = analyzeFutureTrajectoryIntersections(trail, storm, stormTracks, riskThreshold);
      intersections.push(...futureIntersections);
    });
  });

  return intersections.sort((a, b) => a.hoursFromNow - b.hoursFromNow);
}

export function getPastIntersections(intersections: HurricaneIntersection[]): HurricaneIntersection[] {
  return intersections.filter(intersection => intersection.intersectionType === 'past');
}

export function getFutureIntersections(intersections: HurricaneIntersection[]): HurricaneIntersection[] {
  return intersections.filter(intersection => intersection.intersectionType === 'future');
}

export function getBalloonsByIntersectionType(
  balloonTrails: BalloonTrail[],
  intersections: HurricaneIntersection[],
  type: 'past' | 'future'
): BalloonTrail[] {
  const balloonIds = new Set(
    intersections
      .filter(intersection => intersection.intersectionType === type)
      .map(intersection => intersection.balloonId)
  );
  
  return balloonTrails.filter(trail => balloonIds.has(trail.balloonId));
}

export function getRecentTrajectory(trail: BalloonTrail, hours: number = 5): BalloonTrail {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
  
  const recentPoints = trail.points.filter(point => 
    new Date(point.timestamp) >= cutoffTime
  );
  
  return {
    ...trail,
    points: recentPoints
  };
}

function calculateDistanceToPolygon(point: GeoJSON.Feature<GeoJSON.Point>, polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  // Check if point is inside the polygon first
  if ((turf as any).booleanPointInPolygon(point, polygon)) {
    return 0; // Inside the storm cone
  }
  
  // Calculate distance to the polygon boundary
  const polygonCoords = polygon.type === 'Polygon' 
    ? polygon.coordinates[0] 
    : polygon.coordinates[0][0];
  
  const polygonLine = turf.lineString(polygonCoords);
  const nearestPointOnLine = (turf as any).nearestPointOnLine(polygonLine, point);
  return turf.distance(point, nearestPointOnLine, { units: 'kilometers' } as any);
}

function analyzeFutureTrajectoryIntersections(
  balloonTrail: BalloonTrail,
  storm: StormCone,
  stormTracks: StormTrack[],
  riskThreshold: number
): HurricaneIntersection[] {
  const intersections: HurricaneIntersection[] = [];
  const now = new Date();
  
  if (balloonTrail.points.length < 3) return intersections;
  
  // Get balloon's recent trajectory for better velocity estimation
  const recentPoints = balloonTrail.points.slice(-5); // Use more points for better accuracy
  const lastPoint = recentPoints[recentPoints.length - 1];
  
  if (!lastPoint) return intersections;
  
  // Calculate average velocity over recent points (each point is 1 hour apart)
  let totalLatVelocity = 0;
  let totalLonVelocity = 0;
  
  for (let i = 1; i < recentPoints.length; i++) {
    const current = recentPoints[i];
    const previous = recentPoints[i - 1];
    
    // Simple difference since points are exactly 1 hour apart
    totalLatVelocity += current.latitude - previous.latitude;
    totalLonVelocity += current.longitude - previous.longitude;
  }
  
  const velocityCount = recentPoints.length - 1;
  if (velocityCount === 0) return intersections;
  
  const avgLatVelocity = totalLatVelocity / velocityCount;  // degrees per hour
  const avgLonVelocity = totalLonVelocity / velocityCount;  // degrees per hour
  
  // Find storm track for this storm
  const stormTrack = stormTracks.find(track => track.properties.stormName === storm.properties.stormName);
  
  // If we have a storm track, find closest approach between balloon and hurricane trajectories
  if (stormTrack?.geometry?.type === 'LineString') {
    const closestApproach = findClosestApproachBetweenTrajectories(
      { ...lastPoint, balloonId: balloonTrail.balloonId },
      avgLatVelocity,
      avgLonVelocity,
      stormTrack.geometry.coordinates,
      riskThreshold
    );
    
    if (closestApproach) {
      const futureTime = new Date(now.getTime() + closestApproach.hours * 60 * 60 * 1000);
      
      intersections.push({
        balloonId: balloonTrail.balloonId,
        stormName: storm.properties.stormName,
        intersectionType: 'future',
        closestDistance: closestApproach.distance,
        timestamp: futureTime.toISOString(),
        altitude: lastPoint.altitude,
        insideForcastCone: false,
        hoursFromNow: closestApproach.hours
      });
    }
  } else {
    // Fallback to simple cone intersection if no track available
    for (let hours = 1; hours <= 48; hours++) {
      const balloonLat = lastPoint.latitude + (avgLatVelocity * hours);
      const balloonLon = lastPoint.longitude + (avgLonVelocity * hours);
      const balloonPoint = (turf as any).point([balloonLon, balloonLat]);
      
      const distanceToCone = calculateDistanceToPolygon(balloonPoint, storm.geometry);
      
      if (distanceToCone <= riskThreshold) {
        const futureTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
        
        intersections.push({
          balloonId: balloonTrail.balloonId,
          stormName: storm.properties.stormName,
          intersectionType: 'future',
          closestDistance: distanceToCone,
          timestamp: futureTime.toISOString(),
          altitude: lastPoint.altitude,
          insideForcastCone: true,
          hoursFromNow: hours
        });
        
        break;
      }
    }
  }
  
  return intersections;
}

// Find closest approach between balloon trajectory and hurricane track with vector analysis
function findClosestApproachBetweenTrajectories(
  balloonPosition: { longitude: number; latitude: number; balloonId?: string },
  balloonLatVel: number,
  balloonLonVel: number,
  stormTrackCoords: number[][],
  riskThreshold: number
): { distance: number; hours: number } | null {
  let minDistance = Infinity;
  let bestTime = 0;
  let isConverging = false;
  
  // Calculate current distance to storm track for reference
  const currentBalloonPoint = (turf as any).point([balloonPosition.longitude, balloonPosition.latitude]);
  const stormLine = (turf as any).lineString(stormTrackCoords);
  const currentDistance = (turf as any).pointToLineDistance(currentBalloonPoint, stormLine, { units: 'kilometers' });
  
  // Sample time points over next 48 hours
  for (let hours = 1; hours <= 48; hours += 0.5) {
    // Predicted balloon position
    const balloonLat = balloonPosition.latitude + (balloonLatVel * hours);
    const balloonLon = balloonPosition.longitude + (balloonLonVel * hours);
    const balloonPoint = (turf as any).point([balloonLon, balloonLat]);
    
    // Find distance to storm track
    const distance = (turf as any).pointToLineDistance(balloonPoint, stormLine, { units: 'kilometers' });
    
    if (distance < minDistance) {
      minDistance = distance;
      bestTime = hours;
      
      // Check if balloon and storm are converging (getting closer over time)
      isConverging = distance < currentDistance;
    }
  }
  
  // Additional vector analysis: check if balloon is heading toward storm track
  const vectorConvergence = calculateVectorConvergence(
    balloonPosition,
    balloonLatVel,
    balloonLonVel,
    stormTrackCoords
  );
  
  // Debug logging (use balloonTrail.balloonId since balloonPosition might not have it)
  // const balloonId = balloonPosition.balloonId || 'unknown';
  
  // Stricter conditions - balloon must be actively heading toward storm
  const willIntersect = minDistance <= riskThreshold && 
                       vectorConvergence > 0.9 && // Much stricter: balloon must be clearly heading toward storm
                       isConverging &&            // AND getting closer over time
                       minDistance < currentDistance * 0.8; // Must get significantly closer (20% improvement)
  
  return willIntersect ? { distance: minDistance, hours: bestTime } : null;
}

// Calculate if balloon vector is pointing toward storm track
function calculateVectorConvergence(
  balloonPosition: { longitude: number; latitude: number },
  balloonLatVel: number,
  balloonLonVel: number,
  stormTrackCoords: number[][]
): number {
  // Find nearest point on storm track to current balloon position
  const balloonPoint = (turf as any).point([balloonPosition.longitude, balloonPosition.latitude]);
  const stormLine = (turf as any).lineString(stormTrackCoords);
  const nearestPoint = (turf as any).nearestPointOnLine(stormLine, balloonPoint);
  
  // Vector from balloon to nearest storm point
  const toStormLat = nearestPoint.geometry.coordinates[1] - balloonPosition.latitude;
  const toStormLon = nearestPoint.geometry.coordinates[0] - balloonPosition.longitude;
  
  // Normalize vectors
  const balloonSpeed = Math.sqrt(balloonLatVel * balloonLatVel + balloonLonVel * balloonLonVel);
  const toStormDistance = Math.sqrt(toStormLat * toStormLat + toStormLon * toStormLon);
  
  if (balloonSpeed === 0 || toStormDistance === 0) return 0;
  
  const balloonDirLat = balloonLatVel / balloonSpeed;
  const balloonDirLon = balloonLonVel / balloonSpeed;
  const toStormDirLat = toStormLat / toStormDistance;
  const toStormDirLon = toStormLon / toStormDistance;
  
  // Dot product gives cosine of angle between vectors
  // > 0 means balloon is heading toward storm
  // < 0 means balloon is heading away from storm
  const dotProduct = (balloonDirLat * toStormDirLat) + (balloonDirLon * toStormDirLon);
  
  return dotProduct;
}
