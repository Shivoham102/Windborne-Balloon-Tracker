import React from 'react';

interface HelpIconProps {
  onClick: () => void;
}

const HelpIcon: React.FC<HelpIconProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors z-10"
      title="Help & Features"
    >
      <span className="text-xl">?</span>
    </button>
  );
};

export default HelpIcon;
