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
    console.log(`[KMZ] KML file: ${kmlFile}, content length: ${kmlContent.length}`);
    
    const parser = new XMLParser({ ignoreAttributes: false });
    const kmlData = parser.parse(kmlContent);
    console.log(`[KMZ] Parsed KML structure:`, Object.keys(kmlData));

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
    
    console.log(`[KMZ] KML full structure:`, JSON.stringify(kmlData, null, 2).substring(0, 500));
    console.log(`[KMZ] Found ${placemarks.length} placemarks`);
    const tracks = [];

    for (const placemark of Array.isArray(placemarks) ? placemarks : [placemarks]) {
      console.log(`[KMZ] Processing placemark:`, placemark?.name || 'unnamed');
      
      if (placemark?.LineString?.coordinates) {
        console.log(`[KMZ] Found LineString coordinates`);
        const coords = placemark.LineString.coordinates
          .trim()
          .split(/\s+/)
          .map((coord: string) => {
            const [lon, lat, alt] = coord.split(',').map(Number);
            return [lon, lat];
          });
        
        console.log(`[KMZ] Parsed ${coords.length} coordinate pairs`);
        tracks.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { name: placemark.name || 'Track' }
        });
      }
      
      // Extract forecast points
      if (placemark?.Point?.coordinates) {
        console.log(`[KMZ] Found Point coordinates`);
        const [lon, lat] = placemark.Point.coordinates.split(',').map(Number);
        tracks.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: { name: placemark.name || 'Point' }
        });
      }
    }

    console.log(`[KMZ] Total tracks extracted: ${tracks.length}`);

    return NextResponse.json({
      type: 'FeatureCollection',
      features: tracks
    });

  } catch (error) {
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }
}
