import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Welcome to WindBorne Balloon Risk Map</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">🌪️ Hurricane Intersection Analysis</h3>
              <p className="text-sm leading-relaxed">
                This interactive map displays balloon trajectories from WindBorne Systems and analyzes their intersections with active hurricanes. <br />
                Track 1000+ balloons across the globe and identify potential risks from tropical storms.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">🎮 How to Use</h3>
              <ul className="text-sm space-y-2 list-disc list-inside">
                <li><strong>Filter Panel (Top Right):</strong> Switch between viewing all balloons, past intersections, or future risks</li>
                <li><strong>Animation Panel:</strong> Select a random balloon and watch its 24-hour journey with the &ldquo;Life of a Balloon&rdquo; feature</li>
                <li><strong>Click Balloons:</strong> Click any balloon point to see detailed information in the popup</li>
                <li><strong>Legend (Bottom Left):</strong> Understand the color coding for different balloon states and storm elements</li>
                <li><strong>Stats Panel (Top Left):</strong> View real-time statistics about balloon counts and intersection analysis</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">🔧 Data Sources</h3>
              <ul className="text-sm space-y-2 list-disc list-inside">
                <li><strong>Balloon Data:</strong> Real-time positions from WindBorne Systems API (1000+ balloons)</li>
                <li><strong>Hurricane Data:</strong> Live storm information from National Hurricane Center (NHC)</li>
              </ul>
            </div>
            
            <p><b>P.S.</b> The at risk balloons are not accurate since there is limited data.</p>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">💡 Pro Tip</h3>
              <p className="text-sm text-blue-700">
                Use the &ldquo;Future Intersections&rdquo; filter to focus on balloons at risk, or try the animation feature to see how individual balloons travel through storm systems over time.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
