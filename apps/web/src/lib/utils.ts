import { cn as baseCn, type ClassValue } from "cn"

export type { ClassValue }

export function cn(...inputs: ClassValue[]): string {
  return baseCn(...inputs)
}

export default cn
