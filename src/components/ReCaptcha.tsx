import { useEffect, useRef, useState } from 'react';

interface ReCaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: any) => void;
  size?: 'compact' | 'normal';
  theme?: 'light' | 'dark';
  disabled?: boolean;
  className?: string;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (container: string | HTMLElement, parameters: any) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
      execute: (widgetId?: number) => void;
    };
  }
}

export function ReCaptcha({
  onVerify,
  onExpire,
  onError,
  size = 'normal',
  theme = 'light',
  disabled = false,
  className = ''
}: ReCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  // Load reCAPTCHA script
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if reCAPTCHA is already loaded
    if (window.grecaptcha) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="recaptcha"]')) {
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.grecaptcha) {
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return;
    }

    // Load the reCAPTCHA script
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoaded(true);
    };
    script.onerror = (error) => {
      console.error('Failed to load reCAPTCHA script:', error);
      if (onError) {
        onError(new Error('Failed to load reCAPTCHA'));
      }
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script on unmount as other components might be using it
    };
  }, [onError]);

  // Render reCAPTCHA widget
  useEffect(() => {
    if (!isLoaded || !containerRef.current || isRendered || disabled) return;

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) {
      console.error('reCAPTCHA site key is not configured');
      if (onError) {
        onError(new Error('reCAPTCHA site key is not configured'));
      }
      return;
    }

    window.grecaptcha.ready(() => {
      try {
        if (!containerRef.current) return;

        const widgetId = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          size,
          theme,
          callback: (token: string) => {
            console.log('reCAPTCHA verified successfully');
            onVerify(token);
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
            if (onExpire) {
              onExpire();
            }
          },
          'error-callback': (error: any) => {
            console.error('reCAPTCHA error:', error);
            if (onError) {
              onError(error);
            }
          }
        });

        widgetIdRef.current = widgetId;
        setIsRendered(true);
        console.log('reCAPTCHA widget rendered successfully');
      } catch (error) {
        console.error('Error rendering reCAPTCHA widget:', error);
        if (onError) {
          onError(error);
        }
      }
    });
  }, [isLoaded, size, theme, onVerify, onExpire, onError, isRendered, disabled]);

  // Reset reCAPTCHA when disabled state changes
  useEffect(() => {
    if (disabled && widgetIdRef.current !== null) {
      try {
        window.grecaptcha?.reset(widgetIdRef.current);
      } catch (error) {
        console.error('Error resetting reCAPTCHA:', error);
      }
    }
  }, [disabled]);

  // Public methods
  const reset = () => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
        console.log('reCAPTCHA reset');
      } catch (error) {
        console.error('Error resetting reCAPTCHA:', error);
      }
    }
  };

  const getResponse = () => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      try {
        return window.grecaptcha.getResponse(widgetIdRef.current);
      } catch (error) {
        console.error('Error getting reCAPTCHA response:', error);
        return '';
      }
    }
    return '';
  };

  // Expose methods via ref
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).reset = reset;
      (containerRef.current as any).getResponse = getResponse;
    }
  }, [isRendered]);

  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        reCAPTCHA is not configured
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={disabled ? 'opacity-50 pointer-events-none' : ''}
      />
      {!isLoaded && (
        <div className="text-sm text-muted-foreground">
          Loading reCAPTCHA...
        </div>
      )}
    </div>
  );
}

// Hook for easier usage
export function useReCaptcha() {
  const [isVerified, setIsVerified] = useState(false);
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleVerify = (token: string) => {
    setToken(token);
    setIsVerified(true);
    setError(null);
  };

  const handleExpire = () => {
    setToken('');
    setIsVerified(false);
    setError('reCAPTCHA expired. Please verify again.');
  };

  const handleError = (error: any) => {
    setToken('');
    setIsVerified(false);
    setError(error?.message || 'reCAPTCHA verification failed');
  };

  const reset = () => {
    setToken('');
    setIsVerified(false);
    setError(null);
  };

  return {
    isVerified,
    token,
    error,
    handleVerify,
    handleExpire,
    handleError,
    reset
  };
}