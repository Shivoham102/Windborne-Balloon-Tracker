import { BalloonDataPoint, BalloonTrail } from '@/types';

// No longer needed - using Next.js API route instead
// const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
// const CORS_PROXY = '';

// Generate altitude-based colors (blue for low, red for high)
const getAltitudeColor = (altitude: number): string => {
  // Assuming balloons fly between 0-30km altitude
  const normalizedAlt = Math.min(altitude / 30000, 1);
  const hue = (1 - normalizedAlt) * 240; // Blue (240) to Red (0)
  return `hsl(${hue}, 70%, 50%)`;
};



export async function fetchBalloonData(): Promise<BalloonTrail[]> {
  try {
    // Create array of fetch promises for parallel requests
    const fetchPromises = [];
    
    // Fetch last 24 hours of data (files 00.json through 23.json)
    for (let hour = 0; hour < 24; hour++) {
      const fileName = hour.toString().padStart(2, '0');
      
      // Use Next.js API route to avoid CORS issues
      const fetchPromise = fetch(`/api/balloon-data?hour=${fileName}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })
        .then(async (response) => {
                if (!response.ok) {
        return null;
      }
          const data = await response.json();
          return { hour: parseInt(fileName), data };
        })
        .catch(() => {
          return null;
        });
      
      fetchPromises.push(fetchPromise);
    }
    
    // Wait for all requests to complete
    const results = await Promise.all(fetchPromises);
    
    // Filter out failed requests and sort by hour
    const validResults = results
      .filter(result => result !== null)
      .sort((a, b) => a!.hour - b!.hour);
    
    // Track each balloon across all hours
    // Each position in the hourly array represents the same balloon index across time
    const balloonTrails: BalloonTrail[] = [];
    
    // First, determine how many balloons we have (from the first available hour)
    const firstValidResult = validResults[0];
    if (!firstValidResult || !Array.isArray(firstValidResult.data)) {
      return [];
    }
    
    const numBalloons = firstValidResult.data.length;
    
    // Initialize trails for each balloon
    for (let balloonIndex = 0; balloonIndex < numBalloons; balloonIndex++) {
      const balloonId = `balloon-${balloonIndex.toString().padStart(4, '0')}`;
      balloonTrails.push({
        balloonId,
        points: [],
        color: '#0066cc' // Will be updated based on average altitude
      });
    }
    
    // Process each hour and add points to the corresponding balloon trails
    validResults.forEach((result) => {
      if (!result || !Array.isArray(result.data)) return;
      
      const { hour, data: hourlyData } = result;
      
      hourlyData.forEach((balloonCoords: number[], balloonIndex: number) => {
        // Handle the actual API format: [latitude, longitude, altitude]
        if (Array.isArray(balloonCoords) && balloonCoords.length >= 3 && balloonIndex < numBalloons) {
          const latitude = balloonCoords[0];
          const longitude = balloonCoords[1];
          const altitude = balloonCoords[2];
          
          // Skip if essential data is missing or invalid
          if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
              isNaN(latitude) || isNaN(longitude) || 
              Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            return;
          }
          
          // Create timestamp for this hour (hours ago from now)
          const timestamp = new Date(Date.now() - (23 - hour) * 60 * 60 * 1000).toISOString();
          
          // Add data point to the corresponding balloon trail
          const trail = balloonTrails[balloonIndex];
          if (trail) {
            trail.points.push({
              latitude: latitude,
              longitude: longitude,
              altitude: altitude,
              timestamp: timestamp,
              balloonId: trail.balloonId
            });
          }
        }
      });
    });
    
    // Sort points by timestamp for each trail and calculate colors
    balloonTrails.forEach(trail => {
      trail.points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Update color based on average altitude
      if (trail.points.length > 0) {
        const avgAltitude = trail.points.reduce((sum, point) => sum + point.altitude, 0) / trail.points.length;
        trail.color = getAltitudeColor(avgAltitude);
      }
    });
    
    // Filter out trails with too few points (need at least 2 points to draw a line)
    const validTrails = balloonTrails.filter(trail => trail.points.length >= 2);
    

    
    return validTrails;
  } catch {
    return [];
  }
}

// Mock data generator for development
export function generateMockBalloonData(): BalloonTrail[] {
  const trails: BalloonTrail[] = [];
  
  // Generate 3-5 mock balloon trails
  for (let i = 0; i < 4; i++) {
    const balloonId = `balloon-${i + 1}`;
    const points: BalloonDataPoint[] = [];
    
    // Start position (somewhere in Atlantic/Pacific for hurricane context)
    let lat = 20 + Math.random() * 30; // 20-50N
    let lon = -100 + Math.random() * 40; // -100 to -60W
    let altitude = 15000 + Math.random() * 10000; // 15-25km
    
    // Generate 24 hours of drift
    for (let hour = 0; hour < 24; hour++) {
      points.push({
        latitude: lat,
        longitude: lon,
        altitude: altitude + (Math.random() - 0.5) * 2000,
        timestamp: new Date(Date.now() - (23 - hour) * 60 * 60 * 1000).toISOString(),
        balloonId
      });
      
      // Simulate drift
      lat += (Math.random() - 0.5) * 2;
      lon += (Math.random() - 0.5) * 2;
      altitude += (Math.random() - 0.5) * 1000;
    }
    
    trails.push({
      balloonId,
      points,
      color: getAltitudeColor(altitude)
    });
  }
  
  return trails;
}
