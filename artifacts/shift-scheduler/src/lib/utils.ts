import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ROLE_ORDER: Record<string, number> = {
  admin: 0,
  sergeant: 1,
  deputy: 2,
  reserve: 3,
};

export function sortByRole<T extends { role: string; lastName: string; firstName: string }>(
  users: T[]
): T[] {
  return [...users].sort((a, b) => {
    const roleDiff = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
    if (roleDiff !== 0) return roleDiff;
    const lastDiff = a.lastName.localeCompare(b.lastName);
    if (lastDiff !== 0) return lastDiff;
    return a.firstName.localeCompare(b.firstName);
  });
}
