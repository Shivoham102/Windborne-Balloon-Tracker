import React from 'react';
import { HurricaneIntersection, StormCone, StormTrack, BalloonTrail } from '@/types';
import { getPastIntersections, getFutureIntersections } from '@/lib/proximityAnalysis';
import { getRealHurricanes, getRealBalloons } from '@/config/app';

interface StatsPanelProps {
  balloonTrails: BalloonTrail[];
  displayTrails: BalloonTrail[];
  hurricaneIntersections: HurricaneIntersection[];
  stormData: { 
    cones: StormCone[]; 
    tracks: StormTrack[] 
  };
  usingRealStorms: boolean;
  filterMode: string;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  balloonTrails,
  displayTrails,
  hurricaneIntersections,
  stormData,
  usingRealStorms,
  filterMode
}) => {
  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 text-sm border">
      <h3 className="font-bold mb-2 text-black">Hurricane Intersection Analysis</h3>
      <div className="space-y-1">
        <p className="text-black">Total Balloons: {balloonTrails.length}</p>
        <p className="text-black">Currently Displaying: {displayTrails.length}</p>
        <p className="text-orange-600 font-medium">
          Past Intersections: {new Set(getPastIntersections(hurricaneIntersections).map(i => i.balloonId)).size}
        </p>
        <p className="text-red-600 font-medium">
          Future Risk: {new Set(getFutureIntersections(hurricaneIntersections).map(i => i.balloonId)).size}
        </p>
        <p className="text-black">
          Active Storms: {stormData.cones.length} 
          <span className={`text-xs ml-1 ${usingRealStorms ? 'text-green-600' : 'text-orange-600'}`}>
            ({usingRealStorms ? 'Live NHC Data' : 'Mock Data'})
          </span>
        </p>
        <div className="mt-2 pt-2 border-t text-xs text-gray-600">
          <p>🌪️ Hurricanes: {getRealHurricanes() ? 'Live NHC API' : 'Mock Testing'}</p>
          <p>🎈 Balloons: {getRealBalloons() ? 'WindBorne API' : 'Mock Testing'}</p>
        </div>
      </div>
      {filterMode !== 'all' && (
        <div className="mt-2 pt-2 border-t text-xs text-black">
          Filter: {filterMode === 'past-intersections' ? 'Past Intersections' : 'Future Risk (5h trajectory)'}
        </div>
      )}
    </div>
  );
};

export default StatsPanel;
