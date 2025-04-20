import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance);
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function formatDistance(distance: number): string {
  if (distance < 1) {
    return 'Less than a mile away';
  }
  return `${distance} ${distance === 1 ? 'mile' : 'miles'} away`;
}

// Memoize the condition color mapping
const conditionColors: Record<string, { base: string; hover: string }> = {
  'poor': {
    base: 'bg-[#e51f1f]/20 text-[#e51f1f] border border-[#e51f1f]/30',
    hover: 'hover:bg-[#e51f1f]/30'
  },
  'played': {
    base: 'bg-[#e85f2a]/20 text-[#e85f2a] border border-[#e85f2a]/30',
    hover: 'hover:bg-[#e85f2a]/30'
  },
  'light played': {
    base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
    hover: 'hover:bg-[#f2a134]/30'
  },
  'light-played': {
    base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
    hover: 'hover:bg-[#f2a134]/30'
  },
  'good': {
    base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
    hover: 'hover:bg-[#f2a134]/30'
  },
  'excellent': {
    base: 'bg-[#f7e379]/20 text-[#f7e379] border border-[#f7e379]/30',
    hover: 'hover:bg-[#f7e379]/30'
  },
  'near mint': {
    base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
    hover: 'hover:bg-[#7bce2a]/30'
  },
  'near-mint': {
    base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
    hover: 'hover:bg-[#7bce2a]/30'
  },
  'near_mint': {
    base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
    hover: 'hover:bg-[#7bce2a]/30'
  },
  'mint': {
    base: 'bg-[#44ce1b]/20 text-[#44ce1b] border border-[#44ce1b]/30',
    hover: 'hover:bg-[#44ce1b]/30'
  }
};

const defaultColor = { base: 'bg-gray-500/20 text-gray-500 border border-gray-500/30', hover: 'hover:bg-gray-500/30' };

// Get condition color function
export function getConditionColor(condition: string): { base: string; hover: string } {
  if (!condition) return defaultColor;
  return conditionColors[condition.toLowerCase()] || defaultColor;
}