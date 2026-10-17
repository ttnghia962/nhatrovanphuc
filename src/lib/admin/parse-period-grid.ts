export interface PeriodRowInput {
  roomNumber: number;
  tenantName: string;
  occupied: boolean;
  electricReading: number | null;
}

/**
 * Đọc lưới nhập liệu của quản lý. Các ô có tên dạng
 * `tenantName_<số phòng>`, `occupied_<số phòng>`, `electric_<số phòng>`.
 * Ô chỉ số để trống trả về null — không được quy về 0.
 */
export function parsePeriodGrid(formData: FormData): PeriodRowInput[] {
  const roomNumbers = new Set<number>();

  for (const key of formData.keys()) {
    const match = key.match(/^(?:tenantName|occupied|electric)_(\d+)$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 32) roomNumbers.add(n);
  }

  return [...roomNumbers]
    .sort((a, b) => a - b)
    .map((roomNumber) => {
      const rawElectric = String(formData.get(`electric_${roomNumber}`) ?? '').trim();
      const electricReading = rawElectric === '' ? null : Number(rawElectric);

      return {
        roomNumber,
        tenantName: String(formData.get(`tenantName_${roomNumber}`) ?? '').trim(),
        occupied: formData.get(`occupied_${roomNumber}`) !== null,
        electricReading:
          electricReading !== null && Number.isInteger(electricReading) && electricReading >= 0
            ? electricReading
            : null,
      };
    });
}
