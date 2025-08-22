# WindBorne API Integration

## Overview
This balloon risk map now fetches real balloon data from the WindBorne Systems API instead of using mock data.

## API Endpoint
The application fetches balloon position data from:
```
https://a.windbornesystems.com/treasure/{hour}.json
```

Where `{hour}` is a two-digit hour from `00` to `23` representing the last 24 hours of data.

## Data Format
The API returns an array of balloon objects with the following structure:
```json
[
  {
    "balloon_id": "string",
    "lat": number,
    "lon": number, 
    "alt": number,
    "time": "ISO_timestamp"
  }
]
```

## Features
- **24-Hour Data Collection**: Fetches data from the last 24 hours (files 00.json through 23.json)
- **Trail Generation**: Combines hourly position reports into continuous balloon trails
- **Altitude-Based Coloring**: Colors trails based on balloon altitude (blue=low, red=high)
- **Error Handling**: Falls back to mock data if API is unavailable
- **CORS Support**: Includes CORS proxy option for development
- **Data Validation**: Filters out incomplete data points and trails with insufficient points

## Fallback Behavior
If the WindBorne API is unavailable:
1. The app will log warnings for failed requests
2. If no data is retrieved, it automatically falls back to mock data
3. Users will see a warning in the console but the app continues to function

## CORS Issues
If you encounter CORS issues during development:
1. Uncomment the CORS proxy line in `src/lib/balloonData.ts`:
   ```typescript
   const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
   ```
2. Or set up your own CORS proxy server

## Console Logging
The application provides detailed console logging:
- API request status
- Number of balloons fetched
- Total data points processed
- Fallback notifications

## Performance
- Fetches data in parallel for all 24 hours
- Filters out invalid trails (less than 2 points)
- Sorts trail points by timestamp for proper visualization
- Updates colors based on average altitude per trail
