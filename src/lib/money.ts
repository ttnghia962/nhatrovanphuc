export function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

const vndFormatter = new Intl.NumberFormat('vi-VN');

export function formatVnd(n: number): string {
  return vndFormatter.format(n);
}
