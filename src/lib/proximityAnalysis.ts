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

function findClosestPointToStorm(trail: BalloonTrail, storm: StormCone): { point: any, distance: number } | null {
  let closestPoint = null;
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
  
  if (balloonTrail.points.length < 2) return intersections;
  
  // Get balloon's recent trajectory to predict future path
  const recentPoints = balloonTrail.points.slice(-3);
  const lastPoint = recentPoints[recentPoints.length - 1];
  const secondLastPoint = recentPoints[recentPoints.length - 2];
  
  if (!lastPoint || !secondLastPoint) return intersections;
  
  // Calculate balloon velocity
  const timeDiff = (new Date(lastPoint.timestamp).getTime() - new Date(secondLastPoint.timestamp).getTime()) / (1000 * 60 * 60);
  const latVelocity = (lastPoint.latitude - secondLastPoint.latitude) / timeDiff;
  const lonVelocity = (lastPoint.longitude - secondLastPoint.longitude) / timeDiff;
  
  // Find storm track for this storm
  const stormTrack = stormTracks.find(track => track.properties.stormName === storm.properties.stormName);
  
  // Project both balloon and storm forward in time
  for (let hours = 1; hours <= 48; hours++) {
    // Predicted balloon position
    const balloonLat = lastPoint.latitude + (latVelocity * hours);
    const balloonLon = lastPoint.longitude + (lonVelocity * hours);
    const balloonPoint = (turf as any).point([balloonLon, balloonLat]);
    
    // Check intersection with storm cone
    const distanceToCone = calculateDistanceToPolygon(balloonPoint, storm.geometry);
    
    // Check intersection with storm track (if available)
    let distanceToTrack = Infinity;
    if (stormTrack?.geometry?.type === 'LineString') {
      distanceToTrack = (turf as any).pointToLineDistance(balloonPoint, stormTrack.geometry, { units: 'kilometers' });
    }
    
    const minDistance = Math.min(distanceToCone, distanceToTrack);
    
    if (minDistance <= riskThreshold) {
      const futureTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
      
      intersections.push({
        balloonId: balloonTrail.balloonId,
        stormName: storm.properties.stormName,
        intersectionType: 'future',
        closestDistance: minDistance,
        timestamp: futureTime.toISOString(),
        altitude: lastPoint.altitude,
        insideForcastCone: distanceToCone <= riskThreshold,
        hoursFromNow: hours
      });
      
      break; // Only report first intersection
    }
  }
  
  return intersections;
}
