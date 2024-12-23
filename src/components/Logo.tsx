import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface LogoProps {
  className?: string;
  href?: string;
  alwaysShowFull?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className, href = '/', alwaysShowFull = false }) => {
  const router = useRouter();
  const isDashboard = router.pathname.startsWith('/dashboard');

  const LogoContent = (
    <div className={`font-bold cursor-pointer ${className || ''}`}>
      {/* Mobile Logo Version - only shown when alwaysShowFull is false */}
      {!alwaysShowFull && (
        <div className="block md:hidden text-2xl">
          {isDashboard ? (
            <span className="lowercase text-sky-400">w</span>
          ) : (
            <>
              <span className="lowercase text-sky-400">w</span>
              <span className="lowercase">.gg</span>
            </>
          )}
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