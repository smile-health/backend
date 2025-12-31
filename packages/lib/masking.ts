export function mask(input: string): string {
  const str = String(input ?? "");
  const len = str.length;

  // Nothing to mask for very short strings
  if (len <= 2) return str;

  // n = floor(len/4), minimum 1
  let n = Math.floor(len / 4);
  if (n < 1) n = 1;

  // Avoid overlap: ensure 2n <= len
  n = Math.min(n, Math.floor(len / 2));

  const start = str.slice(0, n);
  const end = str.slice(len - n);
  const middleLen = Math.max(len - 2 * n, 0);

  return start + "*".repeat(middleLen) + end;
}
