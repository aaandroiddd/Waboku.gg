// Utility functions for safely working with DOM elements

/**
 * Creates a MutationObserver that safely handles null or invalid targets
 * @param target The DOM element to observe
 * @param callback The callback function to execute when mutations occur
 * @param options MutationObserver options
 * @returns A function to disconnect the observer
 */
export function createSafeMutationObserver(
  target: Node | null | undefined,
  callback: MutationCallback,
  options: MutationObserverInit = { childList: true, subtree: true }
): () => void {
  // If target is null, undefined, or not a valid Node, return a no-op function
  if (!target || !(target instanceof Node)) {
    console.warn('Invalid target provided to createSafeMutationObserver:', target);
    return () => {}; // Return a no-op function
  }

  try {
    // Create the observer
    const observer = new MutationObserver(callback);
    
    // Start observing
    observer.observe(target, options);
    
    // Return a function to disconnect the observer
    return () => {
      try {
        observer.disconnect();
      } catch (error) {
        console.error('Error disconnecting MutationObserver:', error);
      }
    };
  } catch (error) {
    console.error('Error creating MutationObserver:', error);
    return () => {}; // Return a no-op function
  }
}

/**
 * Safely queries the DOM for an element
 * @param selector The CSS selector to query
 * @param parent The parent element to query within (defaults to document)
 * @returns The found element or null
 */
export function safeQuerySelector<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): T | null {
  try {
    return parent.querySelector<T>(selector);
  } catch (error) {
    console.error(`Error querying for selector "${selector}":`, error);
    return null;
  }
}

/**
 * Safely queries the DOM for multiple elements
 * @param selector The CSS selector to query
 * @param parent The parent element to query within (defaults to document)
 * @returns An array of found elements
 */
export function safeQuerySelectorAll<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): T[] {
  try {
    return Array.from(parent.querySelectorAll<T>(selector));
  } catch (error) {
    console.error(`Error querying for all selector "${selector}":`, error);
    return [];
  }
}

/**
 * Safely adds an event listener to an element
 * @param element The element to add the listener to
 * @param eventType The type of event to listen for
 * @param handler The event handler function
 * @param options Event listener options
 * @returns A function to remove the event listener
 */
export function safeAddEventListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | Document | Window | null | undefined,
  eventType: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  if (!element) {
    return () => {}; // Return a no-op function
  }

  try {
    element.addEventListener(eventType, handler as EventListener, options);
    return () => {
      try {
        element.removeEventListener(eventType, handler as EventListener, options);
      } catch (error) {
        console.error(`Error removing ${eventType} event listener:`, error);
      }
    };
  } catch (error) {
    console.error(`Error adding ${eventType} event listener:`, error);
    return () => {}; // Return a no-op function
  }
}