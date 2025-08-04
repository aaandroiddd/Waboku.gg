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

  useEffect(() => {
    // Load reCAPTCHA script if not already loaded
    if (!window.grecaptcha) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsLoaded(true);
      };
      script.onerror = () => {
        onError('Failed to load reCAPTCHA');
      };
      document.head.appendChild(script);
    } else {
      setIsLoaded(true);
    }

    return () => {
      // Cleanup: reset reCAPTCHA if widget exists
      if (widgetId !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetId);
        } catch (error) {
          console.warn('Error resetting reCAPTCHA:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (isLoaded && recaptchaRef.current && !widgetId && !disabled) {
      try {
        const id = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          callback: (token: string) => {
            onVerify(token);
          },
          'expired-callback': () => {
            onExpire();
          },
          'error-callback': () => {
            onError('reCAPTCHA verification failed');
          },
        });
        setWidgetId(id);
      } catch (error) {
        console.error('Error rendering reCAPTCHA:', error);
        onError('Failed to initialize reCAPTCHA');
      }
    }
  }, [isLoaded, disabled, onVerify, onExpire, onError]);

  // Reset reCAPTCHA when disabled state changes
  useEffect(() => {
    if (widgetId !== null && window.grecaptcha) {
      try {
        if (disabled) {
          window.grecaptcha.reset(widgetId);
        }
      } catch (error) {
        console.warn('Error resetting reCAPTCHA on disable:', error);
      }
    }
  }, [disabled, widgetId]);

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
      {!isLoaded && (
        <div className="text-sm text-muted-foreground">
          Loading reCAPTCHA...
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