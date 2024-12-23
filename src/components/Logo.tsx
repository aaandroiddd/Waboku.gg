import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  href?: string;
  alwaysShowFull?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className, href = '/', alwaysShowFull = false }) => {
  const LogoContent = (
    <div className={`font-bold cursor-pointer ${className || ''}`}>
      {/* Mobile Icon Version - only shown when alwaysShowFull is false */}
      {!alwaysShowFull && (
        <div className="block md:hidden text-2xl">
          <span className="lowercase text-sky-400">w</span>
        </div>
      )}
      
      {/* Full Logo Version */}
      <div className={`${alwaysShowFull ? 'block' : 'hidden md:block'} text-2xl`}>
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