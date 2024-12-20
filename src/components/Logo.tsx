import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <div className={`text-2xl font-bold ${className || ''}`}>
      <span className="lowercase">waboku</span>
      <span className="text-sky-400">.gg</span>
    </div>
  );
};