export const formatPrice = (price: string | number | undefined | null): string => {
  if (price === undefined || price === null) return '$0.00';
  
  let numericPrice: number;
  
  if (typeof price === 'string') {
    numericPrice = parseFloat(price);
  } else if (typeof price === 'number') {
    numericPrice = price;
  } else {
    return '$0.00';
  }
  
  if (isNaN(numericPrice)) return '$0.00';
  return `$${numericPrice.toFixed(2)}`;
};