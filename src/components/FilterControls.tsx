import React from 'react';
import { FilterMode, BalloonTrail, HurricaneIntersection } from '@/types';
import { getPastIntersections, getFutureIntersections } from '@/lib/proximityAnalysis';

interface FilterControlsProps {
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  balloonTrails: BalloonTrail[];
  hurricaneIntersections: HurricaneIntersection[];
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filterMode,
  setFilterMode,
  balloonTrails,
  hurricaneIntersections
}) => {
  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 text-sm border">
      <h3 className="font-bold mb-3 text-black">Hurricane Intersection Filter</h3>
      <div className="space-y-3">
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name="filter"
            value="all"
            checked={filterMode === 'all'}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="mr-3"
          />
          <span className="text-black">All Balloons ({balloonTrails.length})</span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name="filter"
            value="past-intersections"
            checked={filterMode === 'past-intersections'}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="mr-3"
          />
          <span className="text-black">Past Intersections ({new Set(getPastIntersections(hurricaneIntersections).map(i => i.balloonId)).size})</span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name="filter"
            value="future-intersections"
            checked={filterMode === 'future-intersections'}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="mr-3"
          />
          <span className="text-black">Future Intersections ({new Set(getFutureIntersections(hurricaneIntersections).map(i => i.balloonId)).size})</span>
        </label>
      </div>
      {filterMode === 'future-intersections' && (
        <div className="mt-3 pt-2 border-t text-xs text-black">
          Showing 5-hour trajectory for future intersection balloons
        </div>
      )}
    </div>
  );
};

export default FilterControls;
