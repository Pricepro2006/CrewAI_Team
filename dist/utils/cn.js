import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
/**
 * Utility function to merge Tailwind CSS classes with proper conflict resolution
 * Best practice in 2025: Use clsx for conditional classes and tailwind-merge for conflict resolution
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
//# sourceMappingURL=cn.js.map