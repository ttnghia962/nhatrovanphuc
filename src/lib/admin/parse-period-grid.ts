export interface PeriodRowInput {
  roomNumber: number;
  tenantName: string;
  occupied: boolean;
  electricReading: number | null;
  waterReading: number | null;
}

/** Ô để trống trả về null — không được quy về 0. Giá trị không hợp lệ cũng là null. */
function parseReading(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim();
  if (raw === '') return null;

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Đọc lưới nhập liệu của quản lý. Các ô có tên dạng
 * `tenantName_<số phòng>`, `occupied_<số phòng>`, `electric_<số phòng>`,
 * `water_<số phòng>`.
 */
export function parsePeriodGrid(formData: FormData): PeriodRowInput[] {
  const roomNumbers = new Set<number>();

  for (const key of formData.keys()) {
    const match = key.match(/^tenantName_(\d+)$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 32) roomNumbers.add(n);
  }

  return [...roomNumbers]
    .sort((a, b) => a - b)
    .map((roomNumber) => ({
      roomNumber,
      tenantName: String(formData.get(`tenantName_${roomNumber}`) ?? '').trim(),
      occupied: formData.get(`occupied_${roomNumber}`) !== null,
      electricReading: parseReading(formData, `electric_${roomNumber}`),
      waterReading: parseReading(formData, `water_${roomNumber}`),
    }));
}
