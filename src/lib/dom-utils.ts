/**
 * Utility functions for safely working with DOM elements
 */

/**
 * Safely observe a DOM element with MutationObserver
 * @param element Element or selector to observe
 * @param observer MutationObserver instance
 * @param options MutationObserver options
 * @returns Cleanup function to disconnect the observer
 */
export function safelyObserveElement(
  element: Element | string | null,
  observer: MutationObserver,
  options: MutationObserverInit
): () => void {
  let targetElement: Element | null = null;
  
  // If element is a string, treat it as a selector
  if (typeof element === 'string') {
    targetElement = document.querySelector(element);
  } else {
    targetElement = element;
  }
  
  // Only observe if element exists
  if (targetElement) {
    try {
      observer.observe(targetElement, options);
      console.log('[DOM Utils] Successfully observing element');
      return () => observer.disconnect();
    } catch (error) {
      console.error('[DOM Utils] Error observing element:', error);
      return () => {};
    }
  } else {
    console.warn('[DOM Utils] Cannot observe non-existent element');
    return () => {};
  }
}

/**
 * Safely add event listener to an element with automatic cleanup
 * @param element Element or selector to add listener to
 * @param eventType Event type to listen for
 * @param handler Event handler function
 * @returns Cleanup function to remove the listener
 */
export function safelyAddEventListener(
  element: Element | string | null,
  eventType: string,
  handler: EventListenerOrEventListenerObject
): () => void {
  let targetElement: Element | null = null;
  
  // If element is a string, treat it as a selector
  if (typeof element === 'string') {
    targetElement = document.querySelector(element);
  } else {
    targetElement = element;
  }
  
  // Only add listener if element exists
  if (targetElement) {
    try {
      targetElement.addEventListener(eventType, handler);
      return () => targetElement?.removeEventListener(eventType, handler);
    } catch (error) {
      console.error('[DOM Utils] Error adding event listener:', error);
      return () => {};
    }
  } else {
    console.warn('[DOM Utils] Cannot add listener to non-existent element');
    return () => {};
  }
}