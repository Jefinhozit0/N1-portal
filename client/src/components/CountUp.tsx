import { useCountUp } from "@/hooks/useCountUp";

/** A number that counts up to its value, printed with the same formatter used everywhere else. */
export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}
