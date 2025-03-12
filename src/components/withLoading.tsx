import { ComponentType, useEffect, useState } from 'react';
import { GlobalLoading } from './GlobalLoading';

interface WithLoadingProps {
  isLoading?: boolean;
  loadingMessage?: string;
  [key: string]: any;
}

export function withLoading<P extends object>(
  Component: ComponentType<P>,
  defaultMessage = "Loading content..."
) {
  return function WithLoadingComponent({
    isLoading = false,
    loadingMessage = defaultMessage,
    ...props
  }: WithLoadingProps & P) {
    const [loading, setLoading] = useState(isLoading);
    
    useEffect(() => {
      setLoading(isLoading);
    }, [isLoading]);

    if (loading) {
      return <GlobalLoading message={loadingMessage} />;
    }

    return <Component {...props as P} />;
  };
}