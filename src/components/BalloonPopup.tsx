import React from 'react';

interface BalloonPopupProps {
  selectedBalloon: {
    balloonId: string;
    altitude: number;
    timestamp: string;
    coordinates: [number, number];
    pastIntersection: boolean;
    futureIntersection: boolean;
  } | null;
  onClose: () => void;
}

const BalloonPopup: React.FC<BalloonPopupProps> = ({ selectedBalloon, onClose }) => {
  if (!selectedBalloon) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10 border">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-blue-600">Balloon Details</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-black"><strong>ID:</strong> {selectedBalloon.balloonId}</p>
        <p className="text-black"><strong>Altitude:</strong> {selectedBalloon.altitude.toFixed(2)} km</p>
        <p className="text-black"><strong>Position:</strong> {selectedBalloon.coordinates[1].toFixed(2)}°N, {Math.abs(selectedBalloon.coordinates[0]).toFixed(2)}°W</p>
        <p className="text-black"><strong>Last Update:</strong> {new Date(selectedBalloon.timestamp).toLocaleString()}</p>
        {selectedBalloon.pastIntersection && (
          <p className="text-orange-600 font-medium">⚠️ Past Hurricane Intersection</p>
        )}
        {selectedBalloon.futureIntersection && (
          <p className="text-red-600 font-medium">🚨 Future Hurricane Risk</p>
        )}
      </div>
    </div>
  );
};

export default BalloonPopup;
