import React from 'react';
import { ProximityAlert } from '@/types';

interface AlertCardProps {
  alert: ProximityAlert;
  onClose: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onClose }) => (
  <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10">
    <div className="flex justify-between items-start mb-2">
      <h3 className="font-bold text-red-600">Proximity Alert</h3>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
    </div>
    <div className="space-y-1 text-sm">
      <p><strong>Balloon:</strong> {alert.balloonId}</p>
      <p><strong>Storm:</strong> {alert.stormName}</p>
      <p><strong>Closest Distance:</strong> {alert.closestDistance.toFixed(1)} km</p>
      <p><strong>Altitude:</strong> {(alert.altitude / 1000).toFixed(1)} km</p>
      <p><strong>Time:</strong> {new Date(alert.timestamp).toLocaleString()}</p>
      <p><strong>Inside Forecast Cone:</strong> {alert.insideForcastCone ? 'Yes' : 'No'}</p>
    </div>
  </div>
);

export default AlertCard;
