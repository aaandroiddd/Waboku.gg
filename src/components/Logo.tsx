import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  href?: string;
}

export const Logo: React.FC<LogoProps> = ({ className, href = '/' }) => {
  const LogoContent = (
    <div className={`text-2xl font-bold cursor-pointer ${className || ''}`}>
      <span className="lowercase">waboku</span>
      <span className="text-sky-400">.gg</span>
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