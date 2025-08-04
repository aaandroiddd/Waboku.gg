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
  const [isScriptLoading, setIsScriptLoading] = useState(false);

  useEffect(() => {
    // Check if reCAPTCHA is already loaded
    if (window.grecaptcha && window.grecaptcha.render) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already loading
    if (isScriptLoading) {
      return;
    }

    // Load reCAPTCHA script if not already loaded
    const existingScript = document.querySelector('script[src*="recaptcha"]');
    if (!existingScript) {
      setIsScriptLoading(true);
      
      // Create a unique callback name to avoid conflicts
      const callbackName = `onRecaptchaLoad_${Date.now()}`;
      
      // Add a global callback function
      (window as any)[callbackName] = () => {
        console.log('reCAPTCHA script loaded successfully');
        if (window.grecaptcha && window.grecaptcha.render) {
          setIsLoaded(true);
          setInitializationError(null);
        } else {
          console.error('reCAPTCHA API not available after loading');
          setInitializationError('reCAPTCHA API not available after loading');
        }
        setIsScriptLoading(false);
        // Clean up the callback
        delete (window as any)[callbackName];
      };
      
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
      script.async = true;
      script.defer = true;
      
      script.onerror = (error) => {
        console.error('Failed to load reCAPTCHA script:', error);
        setInitializationError('Failed to load reCAPTCHA script');
        setIsScriptLoading(false);
        // Clean up the callback
        delete (window as any)[callbackName];
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
  }, [isScriptLoading]);

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

        console.log('Rendering reCAPTCHA with site key:', siteKey.substring(0, 10) + '...');
        console.log('Current domain:', window.location.hostname);

        const id = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            console.log('reCAPTCHA verification successful');
            onVerify(token);
            setInitializationError(null);
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
            onExpire();
          },
          'error-callback': (error: any) => {
            console.error('reCAPTCHA error callback:', error);
            const currentDomain = window.location.hostname;
            let errorMessage = 'reCAPTCHA verification failed';
            
            // Provide more specific error messages
            if (currentDomain !== 'waboku.gg' && !currentDomain.includes('preview.co.dev')) {
              errorMessage = `Domain mismatch: reCAPTCHA is configured for waboku.gg but current domain is ${currentDomain}`;
            }
            
            setInitializationError(errorMessage);
          },
        });
        
        setWidgetId(id);
        setInitializationError(null);
        console.log('reCAPTCHA widget rendered with ID:', id);
      } catch (error) {
        console.error('Error rendering reCAPTCHA:', error);
        const currentDomain = window.location.hostname;
        let errorMessage = `Failed to initialize reCAPTCHA: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        // Check for domain-related errors
        if (error instanceof Error && error.message.includes('Invalid domain')) {
          errorMessage = `Invalid domain for reCAPTCHA: Current domain '${currentDomain}' is not authorized. Please add this domain to your reCAPTCHA configuration.`;
        }
        
        setInitializationError(errorMessage);
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
        reCAPTCHA not configured - missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={recaptchaRef} />
      {(isScriptLoading || (!isLoaded && !initializationError)) && (
        <div className="text-sm text-muted-foreground">
          Loading reCAPTCHA...
        </div>
      )}
      {initializationError && (
        <div className="text-sm text-red-500">
          <div className="font-medium">reCAPTCHA Error:</div>
          <div className="mt-1">{initializationError}</div>
          {initializationError.includes('domain') && (
            <div className="mt-2 text-xs">
              <strong>Solution:</strong> Add the current domain ({window.location.hostname}) to your reCAPTCHA configuration at{' '}
              <a 
                href="https://www.google.com/recaptcha/admin" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Google reCAPTCHA Admin Console
              </a>
            </div>
          )}
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