import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ReCaptchaProps {
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

// Global state to track reCAPTCHA instances and prevent duplicates
let globalRecaptchaState = {
  isLoaded: false,
  isLoading: false,
  activeWidgets: new Set<number>(),
  scriptElement: null as HTMLScriptElement | null,
  pendingCallbacks: new Set<() => void>(),
  containerElements: new WeakSet<HTMLElement>(),
};

export function ReCaptcha({ onVerify, onExpire, onError, disabled = false, className = '' }: ReCaptchaProps) {
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(globalRecaptchaState.isLoaded);
  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isScriptLoading, setIsScriptLoading] = useState(globalRecaptchaState.isLoading);
  const mountedRef = useRef(true);
  const initializationAttemptedRef = useRef(false);

  // Cleanup function to properly destroy widget
  const cleanupWidget = useCallback(() => {
    if (widgetId !== null && window.grecaptcha) {
      try {
        // Remove from active widgets set
        globalRecaptchaState.activeWidgets.delete(widgetId);
        
        // Reset the widget
        if (window.grecaptcha.reset) {
          window.grecaptcha.reset(widgetId);
        }
        
        // Clear the container
        if (recaptchaRef.current) {
          recaptchaRef.current.innerHTML = '';
          globalRecaptchaState.containerElements.delete(recaptchaRef.current);
        }
        
        console.log('reCAPTCHA widget cleaned up:', widgetId);
      } catch (error) {
        console.warn('Error cleaning up reCAPTCHA widget:', error);
      }
      setWidgetId(null);
    }
    initializationAttemptedRef.current = false;
  }, [widgetId]);

  // Script loading effect
  useEffect(() => {
    mountedRef.current = true;
    
    // Check if reCAPTCHA is already loaded
    if (window.grecaptcha && window.grecaptcha.render) {
      globalRecaptchaState.isLoaded = true;
      setIsLoaded(true);
      return;
    }

    // If script is already loading, add this component to pending callbacks
    if (globalRecaptchaState.isLoading) {
      const callback = () => {
        if (mountedRef.current) {
          setIsLoaded(true);
          setIsScriptLoading(false);
        }
      };
      globalRecaptchaState.pendingCallbacks.add(callback);
      
      return () => {
        globalRecaptchaState.pendingCallbacks.delete(callback);
      };
    }

    // Load reCAPTCHA script if not already loaded
    const existingScript = document.querySelector('script[src*="recaptcha"]');
    if (!existingScript) {
      globalRecaptchaState.isLoading = true;
      setIsScriptLoading(true);
      
      // Create a unique callback name to avoid conflicts
      const callbackName = `onRecaptchaLoad_${Date.now()}`;
      
      // Add a global callback function
      (window as any)[callbackName] = () => {
        console.log('reCAPTCHA script loaded successfully');
        if (window.grecaptcha && window.grecaptcha.render) {
          globalRecaptchaState.isLoaded = true;
          globalRecaptchaState.isLoading = false;
          
          // Notify all pending callbacks
          globalRecaptchaState.pendingCallbacks.forEach(callback => {
            try {
              callback();
            } catch (error) {
              console.warn('Error in reCAPTCHA callback:', error);
            }
          });
          globalRecaptchaState.pendingCallbacks.clear();
          
          if (mountedRef.current) {
            setIsLoaded(true);
            setInitializationError(null);
            setIsScriptLoading(false);
          }
        } else {
          console.error('reCAPTCHA API not available after loading');
          globalRecaptchaState.isLoading = false;
          if (mountedRef.current) {
            setInitializationError('reCAPTCHA API not available after loading');
            setIsScriptLoading(false);
          }
        }
        // Clean up the callback
        delete (window as any)[callbackName];
      };
      
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
      script.async = true;
      script.defer = true;
      
      script.onerror = (error) => {
        console.error('Failed to load reCAPTCHA script:', error);
        globalRecaptchaState.isLoading = false;
        if (mountedRef.current) {
          setInitializationError('Failed to load reCAPTCHA script');
          setIsScriptLoading(false);
        }
        // Clean up the callback
        delete (window as any)[callbackName];
      };
      
      globalRecaptchaState.scriptElement = script;
      document.head.appendChild(script);
    } else {
      // Script exists, wait for it to load
      const checkLoaded = () => {
        if (!mountedRef.current) return;
        
        if (window.grecaptcha && window.grecaptcha.render) {
          globalRecaptchaState.isLoaded = true;
          setIsLoaded(true);
          setInitializationError(null);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    }

    return () => {
      mountedRef.current = false;
      cleanupWidget();
    };
  }, [cleanupWidget]);

  // Widget rendering effect
  useEffect(() => {
    if (!mountedRef.current) return;
    if (!isLoaded || !recaptchaRef.current || widgetId !== null || disabled || initializationError) return;
    if (initializationAttemptedRef.current) return;

    // Check if this container has already been used
    if (globalRecaptchaState.containerElements.has(recaptchaRef.current)) {
      console.warn('reCAPTCHA container already used, skipping initialization');
      return;
    }

    initializationAttemptedRef.current = true;

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

      // Ensure the container is clean
      if (recaptchaRef.current.children.length > 0) {
        console.warn('reCAPTCHA container already has content, clearing...');
        recaptchaRef.current.innerHTML = '';
      }

      console.log('Rendering reCAPTCHA with site key:', siteKey.substring(0, 10) + '...');
      console.log('Current domain:', window.location.hostname);

      const id = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          if (!mountedRef.current) return;
          console.log('reCAPTCHA verification successful');
          onVerify(token);
          setInitializationError(null);
        },
        'expired-callback': () => {
          if (!mountedRef.current) return;
          console.log('reCAPTCHA expired');
          onExpire();
        },
        'error-callback': (error: any) => {
          if (!mountedRef.current) return;
          console.error('reCAPTCHA error callback:', error);
          const currentDomain = window.location.hostname;
          let errorMessage = 'reCAPTCHA verification failed';
          
          // Provide more specific error messages
          if (currentDomain !== 'waboku.gg' && !currentDomain.includes('preview.co.dev')) {
            errorMessage = `Domain mismatch: reCAPTCHA is configured for waboku.gg but current domain is ${currentDomain}`;
          }
          
          setInitializationError(errorMessage);
          onError(errorMessage);
        },
      });
      
      // Track the widget ID globally and mark container as used
      globalRecaptchaState.activeWidgets.add(id);
      globalRecaptchaState.containerElements.add(recaptchaRef.current);
      setWidgetId(id);
      setInitializationError(null);
      console.log('reCAPTCHA widget rendered with ID:', id);
    } catch (error) {
      console.error('Error rendering reCAPTCHA:', error);
      const currentDomain = window.location.hostname;
      let errorMessage = `Failed to initialize reCAPTCHA: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Check for domain-related errors or duplicate rendering
      if (error instanceof Error) {
        if (error.message.includes('Invalid domain')) {
          errorMessage = `Invalid domain for reCAPTCHA: Current domain '${currentDomain}' is not authorized. Please add this domain to your reCAPTCHA configuration.`;
        } else if (error.message.includes('already been rendered')) {
          errorMessage = 'Failed to initialize reCAPTCHA: reCAPTCHA has already been rendered in this element';
          // Clear the container and reset attempt flag
          if (recaptchaRef.current) {
            recaptchaRef.current.innerHTML = '';
            globalRecaptchaState.containerElements.delete(recaptchaRef.current);
          }
          initializationAttemptedRef.current = false;
          
          // Try again after a short delay
          setTimeout(() => {
            if (mountedRef.current && !widgetId) {
              initializationAttemptedRef.current = false;
              setInitializationError(null);
            }
          }, 1000);
          return;
        }
      }
      
      setInitializationError(errorMessage);
      onError(errorMessage);
    }
  }, [isLoaded, disabled, onVerify, onExpire, onError, initializationError, widgetId]);

  // Reset reCAPTCHA when disabled state changes
  useEffect(() => {
    if (!mountedRef.current) return;
    
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
    if (initializationError && mountedRef.current) {
      onError(initializationError);
    }
  }, [initializationError, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanupWidget();
    };
  }, [cleanupWidget]);

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