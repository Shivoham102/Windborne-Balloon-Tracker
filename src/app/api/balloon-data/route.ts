import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hour = searchParams.get('hour');
    
    if (!hour) {
      return NextResponse.json(
        { error: 'Hour parameter is required' },
        { status: 400 }
      );
    }

    // Validate hour parameter (00-23)
    const hourNum = parseInt(hour);
    if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
      return NextResponse.json(
        { error: 'Hour must be between 00 and 23' },
        { status: 400 }
      );
    }

    const fileName = hour.padStart(2, '0');
    const windborneUrl = `https://a.windbornesystems.com/treasure/${fileName}.json`;
    
    console.log(`[API] Fetching WindBorne data for hour ${fileName}`);

    // Fetch data from WindBorne API
    const response = await fetch(windborneUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BalloonRiskMap/1.0',
      },
      // Add cache control for better performance
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.warn(`[API] WindBorne API returned ${response.status} for hour ${fileName}`);
      return NextResponse.json(
        { 
          error: `WindBorne API returned ${response.status}`,
          hour: fileName,
          status: response.status 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Log successful response
    const dataLength = Array.isArray(data) ? data.length : 0;
    console.log(`[API] Successfully fetched ${dataLength} balloon records for hour ${fileName}`);

    // Return the data with proper headers
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('[API] Error fetching balloon data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch balloon data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
