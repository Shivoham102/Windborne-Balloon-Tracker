import React from 'react';

const Legend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 text-sm border">
      <h3 className="font-bold mb-2 text-black">Legend</h3>
      <div className="space-y-1">
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-blue-500 mr-2"></div>
          <span className="text-black">Normal Flight Path</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 mr-2" style={{backgroundColor: '#ff6b35'}}></div>
          <span className="text-black">Past Hurricane Intersection</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 mr-2 border-2 border-dashed border-red-500"></div>
          <span className="text-black">Future Hurricane Risk</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 border-2 border-white"></div>
          <span className="text-black">Current Position</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 mr-2 border-2 border-dashed" style={{borderColor: '#7c3aed'}}></div>
          <span className="text-black">Hurricane Track</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-2 mr-2 border-2" style={{backgroundColor: '#9333ea', borderColor: '#7c3aed', opacity: 0.3}}></div>
          <span className="text-black">Hurricane Cone</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t">
        <p className="text-xs text-gray-600">
          Each line shows 24-hour balloon flight path
        </p>
      </div>
    </div>
  );
};

export default Legend;
