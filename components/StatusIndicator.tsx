
import React from 'react';
import { ConnectionStatus } from '../types';

interface StatusIndicatorProps {
  status: ConnectionStatus;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const baseClasses = "w-3 h-3 rounded-full transition-all";
  let colorClasses = "";
  let glowElement = null;

  switch (status) {
    case ConnectionStatus.ONLINE:
      colorClasses = "bg-green-500";
      break;
    case ConnectionStatus.REFRESHING:
      colorClasses = "bg-yellow-400";
      glowElement = <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>;
      break;
    case ConnectionStatus.OFFLINE:
      colorClasses = "bg-red-600";
      break;
  }

  return (
    <div className="relative flex items-center justify-center w-3 h-3">
      {glowElement}
      <span className={`${baseClasses} ${colorClasses} relative inline-flex`}></span>
    </div>
  );
};
