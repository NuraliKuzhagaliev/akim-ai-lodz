import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const number = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
