import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test connectivity to WindBorne API
    const testResponse = await fetch('https://a.windbornesystems.com/treasure/00.json', {
      method: 'HEAD', // Only get headers, not the full response
      headers: {
        'User-Agent': 'BalloonRiskMap/1.0',
      },
    });

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      windborne_api: {
        accessible: testResponse.ok,
        status: testResponse.status,
        statusText: testResponse.statusText,
      },
      backend: {
        status: 'operational',
        message: 'Next.js API routes are working correctly'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      windborne_api: {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      backend: {
        status: 'operational',
        message: 'Next.js API routes are working, but external API may be unavailable'
      }
    }, { status: 503 });
  }
}
