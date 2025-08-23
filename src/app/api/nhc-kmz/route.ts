import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export async function GET(request: NextRequest) {
  try {
    const kmzUrl = request.nextUrl.searchParams.get('url');
    if (!kmzUrl) return NextResponse.json({ error: 'URL required' }, { status: 400 });

    const response = await fetch(kmzUrl);
    if (!response.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: response.status });

    const zipBuffer = await response.arrayBuffer();
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipBuffer);

    // Find and parse KML file
    const kmlFile = Object.keys(contents.files).find(name => name.endsWith('.kml'));
    if (!kmlFile) return NextResponse.json({ error: 'No KML found' }, { status: 422 });

    const kmlContent = await contents.files[kmlFile].async('text');
    
    const parser = new XMLParser({ ignoreAttributes: false });
    const kmlData = parser.parse(kmlContent);

    // Extract track coordinates - try different KML structures
    let placemarks = [];
    
    // Try different possible KML structures
    if (kmlData?.kml?.Document?.Placemark) {
      placemarks = Array.isArray(kmlData.kml.Document.Placemark) ? kmlData.kml.Document.Placemark : [kmlData.kml.Document.Placemark];
    } else if (kmlData?.kml?.Placemark) {
      placemarks = Array.isArray(kmlData.kml.Placemark) ? kmlData.kml.Placemark : [kmlData.kml.Placemark];
    } else if (kmlData?.kml?.Document?.Folder?.Placemark) {
      placemarks = Array.isArray(kmlData.kml.Document.Folder.Placemark) ? kmlData.kml.Document.Folder.Placemark : [kmlData.kml.Document.Folder.Placemark];
    }
    
    const tracks = [];

    for (const placemark of Array.isArray(placemarks) ? placemarks : [placemarks]) {
      if (placemark?.LineString?.coordinates) {
        const coords = placemark.LineString.coordinates
          .trim()
          .split(/\s+/)
          .map((coord: string) => {
            const [lon, lat, alt] = coord.split(',').map(Number);
            return [lon, lat];
          });
        
        tracks.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { name: placemark.name || 'Track' }
        });
      }
      
      // Extract forecast points
      if (placemark?.Point?.coordinates) {
        const [lon, lat] = placemark.Point.coordinates.split(',').map(Number);
        tracks.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: { name: placemark.name || 'Point' }
        });
      }
    }

    return NextResponse.json({
      type: 'FeatureCollection',
      features: tracks
    });

  } catch (error) {
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }
}
