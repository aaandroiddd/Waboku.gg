// Cache for formatted prices
const priceCache = new Map<string | number, string>();

export const formatPrice = (price: string | number | undefined | null): string => {
  if (price === undefined || price === null) return '$0.00';
  
  // Check cache first
  const cached = priceCache.get(price);
  if (cached) return cached;
  
  let numericPrice: number;
  
  if (typeof price === 'string') {
    numericPrice = parseFloat(price);
  } else if (typeof price === 'number') {
    numericPrice = price;
  } else {
    return '$0.00';
  }
  
  if (isNaN(numericPrice)) return '$0.00';
  
  const formatted = `$${numericPrice.toFixed(2)}`;
  // Cache the result
  priceCache.set(price, formatted);
  
  return formatted;
};