export const formatPrice = (price: string | number | undefined): string => {
  if (price === undefined || price === null) return '$0.00';
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  return `$${numericPrice.toFixed(2)}`;
};