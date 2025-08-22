import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('[NHC-API] Fetching current storms from NHC...');
    
    // Fetch current storms from NHC
    const response = await fetch('https://www.nhc.noaa.gov/CurrentStorms.json', {
      method: 'GET',
      headers: {
        'User-Agent': 'BalloonRiskMap/1.0',
        'Accept': 'application/json',
      },
      // Add cache control
      next: { revalidate: 1800 }, // Cache for 30 minutes
    });

    if (!response.ok) {
      console.warn(`[NHC-API] NHC API returned ${response.status}`);
      return NextResponse.json(
        { error: `NHC API returned ${response.status}`, storms: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // The NHC API returns different formats, handle both
    let storms = [];
    
    if (data.activeStorms) {
      storms = data.activeStorms;
    } else if (Array.isArray(data)) {
      storms = data;
    } else if (data.storms) {
      storms = data.storms;
    } else {
      console.log('[NHC-API] No active storms format recognized, returning empty array');
      storms = [];
    }
    
    console.log(`[NHC-API] Found ${storms.length} active storms`);
    
    if (storms.length > 0) {
      console.log(`[NHC-API] Storm names: ${storms.map((s: any) => s.name || s.stormName || 'Unknown').join(', ')}`);
    }

    return NextResponse.json(storms, {
      headers: {
        'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('[NHC-API] Error fetching storm data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch storm data from NHC',
        details: error instanceof Error ? error.message : 'Unknown error',
        storms: []
      },
      { status: 500 }
    );
  }
}
