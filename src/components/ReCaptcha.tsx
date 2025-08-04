import React, { useEffect, useRef, useState } from 'react';

interface ReCaptchaProps {
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ReCaptcha({ onVerify, onExpire, onError, disabled = false, className = '' }: ReCaptchaProps) {
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    // Check if reCAPTCHA is already loaded
    if (window.grecaptcha && window.grecaptcha.render) {
      setIsLoaded(true);
      return;
    }

    // Load reCAPTCHA script if not already loaded
    const existingScript = document.querySelector('script[src*="recaptcha"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait a bit for grecaptcha to be fully available
        setTimeout(() => {
          if (window.grecaptcha && window.grecaptcha.render) {
            setIsLoaded(true);
            setInitializationError(null);
          } else {
            setInitializationError('reCAPTCHA API not available after loading');
          }
        }, 100);
      };
      script.onerror = () => {
        setInitializationError('Failed to load reCAPTCHA script');
      };
      document.head.appendChild(script);
    } else {
      // Script exists, wait for it to load
      const checkLoaded = () => {
        if (window.grecaptcha && window.grecaptcha.render) {
          setIsLoaded(true);
          setInitializationError(null);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    }

    return () => {
      // Cleanup: reset reCAPTCHA if widget exists
      if (widgetId !== null && window.grecaptcha && window.grecaptcha.reset) {
        try {
          window.grecaptcha.reset(widgetId);
        } catch (error) {
          console.warn('Error resetting reCAPTCHA:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (isLoaded && recaptchaRef.current && !widgetId && !disabled && !initializationError) {
      try {
        if (!window.grecaptcha || !window.grecaptcha.render) {
          setInitializationError('reCAPTCHA API not available');
          return;
        }

        const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
        if (!siteKey) {
          setInitializationError('reCAPTCHA site key not configured');
          return;
        }

        const id = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onVerify(token);
            setInitializationError(null);
          },
          'expired-callback': () => {
            onExpire();
          },
          'error-callback': () => {
            setInitializationError('reCAPTCHA verification failed');
          },
        });
        setWidgetId(id);
        setInitializationError(null);
      } catch (error) {
        console.error('Error rendering reCAPTCHA:', error);
        setInitializationError(`Failed to initialize reCAPTCHA: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [isLoaded, disabled, onVerify, onExpire, onError, initializationError]);

  // Reset reCAPTCHA when disabled state changes
  useEffect(() => {
    if (widgetId !== null && window.grecaptcha && window.grecaptcha.reset) {
      try {
        if (disabled) {
          window.grecaptcha.reset(widgetId);
        }
      } catch (error) {
        console.warn('Error resetting reCAPTCHA on disable:', error);
      }
    }
  }, [disabled, widgetId]);

  // Report initialization errors to parent component
  useEffect(() => {
    if (initializationError) {
      onError(initializationError);
    }
  }, [initializationError, onError]);

  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        reCAPTCHA not configured
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={recaptchaRef} />
      {!isLoaded && !initializationError && (
        <div className="text-sm text-muted-foreground">
          Loading reCAPTCHA...
        </div>
      )}
      {initializationError && (
        <div className="text-sm text-red-500">
          reCAPTCHA Error: {initializationError}
        </div>
      )}
    </div>
  );
}

export function useReCaptcha() {
  const [isVerified, setIsVerified] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = (recaptchaToken: string) => {
    setToken(recaptchaToken);
    setIsVerified(true);
    setError(null);
  };

  const handleExpire = () => {
    setToken(null);
    setIsVerified(false);
    setError('reCAPTCHA expired. Please verify again.');
  };

  const handleError = (errorMessage: string) => {
    setToken(null);
    setIsVerified(false);
    setError(errorMessage);
  };

  const reset = () => {
    setToken(null);
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
    reset,
  };
}

// Extend the Window interface to include grecaptcha
declare global {
  interface Window {
    grecaptcha: {
      render: (container: HTMLElement, parameters: any) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
  }
}