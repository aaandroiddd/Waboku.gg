/**
 * Font Loading Error Handler
 * Handles font loading errors and provides fallbacks
 */

// Track which font errors we've already handled
const handledFontErrors = new Set<string>();

/**
 * Initialize font error handling
 */
export function initializeFontErrorHandler() {
  if (typeof window === 'undefined') return;

  // Handle font loading errors
  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;
    const message = event.message || '';
    const filename = event.filename || '';
    
    // Check if this is a font loading error
    const isFontError = (
      message.includes('Failed to decode downloaded font') ||
      filename.includes('.woff') ||
      filename.includes('.woff2') ||
      filename.includes('.ttf') ||
      filename.includes('.otf') ||
      (target && target.tagName === 'LINK' && (target as HTMLLinkElement).href?.includes('font'))
    );
    
    if (isFontError) {
      const errorKey = `font-error-${filename || message}`;
      
      if (!handledFontErrors.has(errorKey)) {
        console.warn('[Font] Font loading error detected:', {
          message,
          filename,
          target: target?.tagName,
          href: (target as HTMLLinkElement)?.href
        });
        
        // Apply fallback font styles
        applyFallbackFonts();
        
        handledFontErrors.add(errorKey);
      }
      
      // Prevent the error from appearing in console
      event.preventDefault();
      return false;
    }
  }, true);

  // Monitor font loading with Font Loading API if available
  if ('fonts' in document) {
    document.fonts.addEventListener('loadingerror', (event) => {
      const fontFace = (event as any).fontface;
      const errorKey = `font-loading-error-${fontFace?.family || 'unknown'}`;
      
      if (!handledFontErrors.has(errorKey)) {
        console.warn('[Font] Font loading API error:', {
          family: fontFace?.family,
          source: fontFace?.source,
          status: fontFace?.status
        });
        
        applyFallbackFonts();
        handledFontErrors.add(errorKey);
      }
    });

    // Check if Inter font loaded successfully
    document.fonts.ready.then(() => {
      const interFont = Array.from(document.fonts).find(font => 
        font.family.includes('Inter')
      );
      
      if (!interFont || interFont.status === 'error') {
        console.warn('[Font] Inter font not loaded properly, applying fallbacks');
        applyFallbackFonts();
      } else {
        console.log('[Font] Inter font loaded successfully');
      }
    }).catch((error) => {
      console.warn('[Font] Font loading check failed:', error);
      applyFallbackFonts();
    });
  }

  console.log('[Font] Font error handler initialized');
}

/**
 * Apply fallback font styles when primary fonts fail to load
 */
function applyFallbackFonts() {
  try {
    // Create or update fallback font styles
    let fallbackStyle = document.getElementById('font-fallback-styles');
    
    if (!fallbackStyle) {
      fallbackStyle = document.createElement('style');
      fallbackStyle.id = 'font-fallback-styles';
      document.head.appendChild(fallbackStyle);
    }
    
    fallbackStyle.textContent = `
      /* Fallback font styles */
      * {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", 
                     "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", 
                     "Helvetica Neue", sans-serif !important;
      }
      
      /* Ensure text remains visible during font swap */
      @font-face {
        font-family: 'Inter-Fallback';
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
        src: local('system-ui'), local('-apple-system'), local('BlinkMacSystemFont');
      }
      
      /* Apply fallback to common text elements */
      body, h1, h2, h3, h4, h5, h6, p, span, div, button, input, textarea, select {
        font-family: 'Inter-Fallback', -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", 
                     "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", 
                     "Helvetica Neue", sans-serif !important;
      }
    `;
    
    console.log('[Font] Applied fallback font styles');
  } catch (error) {
    console.error('[Font] Error applying fallback fonts:', error);
  }
}

/**
 * Preload critical fonts with error handling
 */
export function preloadCriticalFonts() {
  if (typeof window === 'undefined') return;

  const fontUrls = [
    '/fonts/inter-var.woff2'
  ];

  fontUrls.forEach(url => {
    // Create a font preload link if it doesn't exist
    const existingLink = document.querySelector(`link[href="${url}"]`);
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      
      // Add error handling
      link.onerror = () => {
        console.warn(`[Font] Failed to preload font: ${url}`);
        applyFallbackFonts();
      };
      
      link.onload = () => {
        console.log(`[Font] Successfully preloaded font: ${url}`);
      };
      
      document.head.appendChild(link);
    }
  });
}

/**
 * Check if fonts are loading properly
 */
export function checkFontHealth() {
  if (typeof window === 'undefined') return { status: 'unknown' };

  const results = {
    status: 'healthy' as 'healthy' | 'degraded' | 'error',
    interLoaded: false,
    fallbackApplied: false,
    errors: [] as string[]
  };

  try {
    // Check if Inter font is available
    if ('fonts' in document) {
      const interFont = Array.from(document.fonts).find(font => 
        font.family.includes('Inter')
      );
      
      results.interLoaded = interFont?.status === 'loaded';
      
      if (!results.interLoaded) {
        results.status = 'degraded';
        results.errors.push('Inter font not loaded');
      }
    }
    
    // Check if fallback styles are applied
    const fallbackStyle = document.getElementById('font-fallback-styles');
    results.fallbackApplied = !!fallbackStyle;
    
    if (results.fallbackApplied && results.status === 'healthy') {
      results.status = 'degraded';
    }
    
    // Check for font-related errors in console
    if (handledFontErrors.size > 0) {
      results.status = 'degraded';
      results.errors.push(`${handledFontErrors.size} font errors handled`);
    }
    
  } catch (error) {
    results.status = 'error';
    results.errors.push(`Font health check failed: ${error}`);
  }

  return results;
}

/**
 * Clear handled font errors (useful for testing)
 */
export function clearHandledFontErrors() {
  handledFontErrors.clear();
}