import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Map department ID to consistent color schemes
export const DEPT_COLORS: {
  [id: number]: {
    bg: string;
    border: string;
    text: string;
    badge: string;
    hex: string;
  };
} = {
  1: {
    bg: 'bg-blue-100 dark:bg-blue-950/70',
    border: 'border-blue-400 dark:border-blue-700',
    text: 'text-blue-900 dark:text-blue-200',
    badge: 'bg-blue-500 text-white',
    hex: '#3b82f6',
  },
  2: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/70',
    border: 'border-emerald-400 dark:border-emerald-700',
    text: 'text-emerald-900 dark:text-emerald-200',
    badge: 'bg-emerald-500 text-white',
    hex: '#10b981',
  },
  3: {
    bg: 'bg-amber-100 dark:bg-amber-950/70',
    border: 'border-amber-400 dark:border-amber-700',
    text: 'text-amber-900 dark:text-amber-200',
    badge: 'bg-amber-500 text-white',
    hex: '#f59e0b',
  },
  4: {
    bg: 'bg-purple-100 dark:bg-purple-950/70',
    border: 'border-purple-400 dark:border-purple-700',
    text: 'text-purple-900 dark:text-purple-200',
    badge: 'bg-purple-500 text-white',
    hex: '#a855f7',
  },
  5: {
    bg: 'bg-rose-100 dark:bg-rose-950/70',
    border: 'border-rose-400 dark:border-rose-700',
    text: 'text-rose-900 dark:text-rose-200',
    badge: 'bg-rose-500 text-white',
    hex: '#f43f5e',
  },
  6: {
    bg: 'bg-cyan-100 dark:bg-cyan-950/70',
    border: 'border-cyan-400 dark:border-cyan-700',
    text: 'text-cyan-900 dark:text-cyan-200',
    badge: 'bg-cyan-500 text-white',
    hex: '#06b6d4',
  },
};

export function getDeptColor(deptId: number | null) {
  if (!deptId) {
    return {
      bg: 'bg-gray-100 dark:bg-gray-800/40',
      border: 'border-gray-200 dark:border-gray-800',
      text: 'text-gray-400 dark:text-gray-500',
      badge: 'bg-gray-400 text-white',
      hex: '#9ca3af',
    };
  }
  const key = ((deptId - 1) % 6) + 1;
  return DEPT_COLORS[key];
}
