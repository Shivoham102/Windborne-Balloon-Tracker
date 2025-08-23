import React from 'react';
import { BalloonTrail } from '@/types';

interface AnimationControlsProps {
  selectedBalloonForAnimation: BalloonTrail | null;
  isAnimating: boolean;
  animationProgress: { progress: number; altitude: number; position: [number, number] } | null;
  onSelectRandom: () => void;
  onStartAnimation: () => void;
  onStopAnimation: () => void;
  onReplayAnimation: () => void;
  onReset: () => void;
}

const AnimationControls: React.FC<AnimationControlsProps> = ({
  selectedBalloonForAnimation,
  isAnimating,
  animationProgress,
  onSelectRandom,
  onStartAnimation,
  onStopAnimation,
  onReplayAnimation,
  onReset
}) => {
  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs border" style={{ top: '200px', width: '230px' }}>
      <h3 className="font-bold mb-2 text-black text-xs">🎈 Life of a WindBorne Balloon</h3>
      <div className="space-y-1">
        {!selectedBalloonForAnimation ? (
          <button
            onClick={onSelectRandom}
            className="w-full bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors text-xs"
          >
            Select Random
          </button>
        ) : (
          <>
            <div className="text-xs text-black mb-1">
              {selectedBalloonForAnimation.balloonId}
            </div>
            {!isAnimating ? (
              <button
                onClick={onStartAnimation}
                className="w-full bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition-colors text-xs"
              >
                ▶️ Start Animation
              </button>
            ) : (
              <button
                onClick={onStopAnimation}
                className="w-full bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors text-xs"
              >
                ⏹️ Stop
              </button>
            )}
            <button
              onClick={onReplayAnimation}
              disabled={isAnimating}
              className="w-full bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 transition-colors disabled:opacity-50 text-xs"
            >
              🔄 Replay
            </button>
            <button
              onClick={onReset}
              className="w-full bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors text-xs"
            >
              🏠 Reset
            </button>
          </>
        )}
      </div>
      
      {/* Animation Progress Indicator */}
      {isAnimating && animationProgress && (
        <div className="mt-3 pt-2 border-t">
          <div className="text-xs text-black mb-1">
            <strong>Progress:</strong> {animationProgress.progress.toFixed(1)}%
          </div>
          <div className="text-xs text-black mb-1">
            <strong>Altitude:</strong> {animationProgress.altitude.toFixed(2)} km
          </div>
          <div className="text-xs text-black">
            <strong>Position:</strong> {animationProgress.position[1].toFixed(2)}°N, {Math.abs(animationProgress.position[0]).toFixed(2)}°W
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all duration-100" 
              style={{ width: `${animationProgress.progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimationControls;
