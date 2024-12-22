import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  href?: string;
}

export const Logo: React.FC<LogoProps> = ({ className, href = '/' }) => {
  const LogoContent = (
    <div className={`font-bold cursor-pointer ${className || ''}`}>
      {/* Mobile Icon Version */}
      <div className="block md:hidden text-2xl">
        <span className="lowercase text-sky-400">w</span>
      </div>
      
      {/* Desktop Full Logo Version */}
      <div className="hidden md:block text-2xl">
        <span className="lowercase">waboku</span>
        <span className="text-sky-400">.gg</span>
      </div>
    </div>
  );

  return href ? (
    <Link href={href}>
      {LogoContent}
    </Link>
  ) : (
    LogoContent
  );
};