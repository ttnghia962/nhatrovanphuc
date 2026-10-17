import { formatPeriod, type Period } from '@/lib/period';
import type { PeriodRowInput } from './parse-period-grid';

/** Giá trị một ô Excel sau khi đã quy về kiểu cơ bản (công thức lấy kết quả). */
export type CellValue = string | number | boolean | null;

/**
 * Cột của file mẫu nhập liệu, đúng thứ tự như lưới "Nhập liệu" trên web.
 * Hai cột "kỳ trước" chỉ để tham khảo: khi tải lên sẽ bỏ qua, chỉ số kỳ trước
 * luôn lấy từ CSDL.
 */
export const IMPORT_HEADERS = [
  'Số phòng',
  'Họ và tên',
  'Có người ở',
  'Điện kỳ trước',
  'Điện kỳ này',
  'Nước kỳ trước',
  'Nước kỳ này',
] as const;

const COL = { room: 0, name: 1, occupied: 2, electric: 4, water: 6 } as const;
const MAX_NAME_LENGTH = 100;
const TITLE_ROW = 0;
const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;

/** Ô A1 của file mẫu; dùng để chặn tải nhầm file của kỳ khác. */
export function importTitle(period: Period): string {
  return `Nhập liệu ${formatPeriod(period)}`;
}

const text = (value: CellValue) => (value === null ? '' : String(value).trim());
const columnLetter = (index: number) => String.fromCharCode(65 + index);

/** Số nguyên không âm; ô trống trả về null. Chấp nhận số lưu dạng chữ số trong Excel. */
function parseCount(value: CellValue): { ok: true; value: number | null } | { ok: false } {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? { ok: true, value } : { ok: false };
  }
  const raw = text(value);
  if (raw === '') return { ok: true, value: null };
  return /^\d+$/.test(raw) ? { ok: true, value: Number(raw) } : { ok: false };
}

export type PeriodImportResult = { ok: true; rows: PeriodRowInput[] } | { ok: false; errors: string[] };

/** Trạng thái form tải lên (dùng với useActionState). */
export type ImportState =
  | { status: 'idle' }
  | { status: 'error'; errors: string[] }
  | { status: 'success'; message: string };

/**
 * Kiểm tra toàn bộ sheet nhập liệu trước khi ghi CSDL. Có bất kỳ lỗi nào thì
 * trả về danh sách lỗi (kèm số dòng Excel) và không trả dữ liệu nào, để phía
 * gọi không thể ghi một phần file.
 *
 * Quy tắc ô trống giống lưới trên web: chỉ số để trống nghĩa là xoá chỉ số đó.
 */
export function validatePeriodImport(input: {
  sheet: CellValue[][];
  period: Period;
  /** Chỉ số kỳ trước theo CSDL, theo số phòng. */
  previous: Record<number, { electric: number | null; water: number | null }>;
}): PeriodImportResult {
  const { sheet, period, previous } = input;

  const title = text(sheet[TITLE_ROW]?.[0] ?? null);
  if (title !== importTitle(period)) {
    return {
      ok: false,
      errors: [
        `Ô A1 phải là "${importTitle(period)}" nhưng file ghi "${title || '(trống)'}". Hãy tải đúng file mẫu của ${formatPeriod(period)}.`,
      ],
    };
  }

  const header = sheet[HEADER_ROW] ?? [];
  const headerErrors: string[] = [];
  IMPORT_HEADERS.forEach((expected, i) => {
    const actual = text(header[i] ?? null);
    if (actual !== expected) {
      headerErrors.push(`Dòng 2, cột ${columnLetter(i)}: tên cột phải là "${expected}" nhưng file ghi "${actual || '(trống)'}"`);
    }
  });
  for (let i = IMPORT_HEADERS.length; i < header.length; i++) {
    if (text(header[i] ?? null) !== '') {
      headerErrors.push(`Dòng 2, cột ${columnLetter(i)}: cột "${text(header[i])}" thừa, không có trong mẫu`);
    }
  }
  if (headerErrors.length > 0) return { ok: false, errors: headerErrors };

  const errors: string[] = [];
  const rows: PeriodRowInput[] = [];
  const seen = new Map<number, number>();

  for (let r = FIRST_DATA_ROW; r < sheet.length; r++) {
    const cells = sheet[r] ?? [];
    if (cells.every((c) => text(c ?? null) === '')) continue;

    const line = r + 1;
    const rowErrors: string[] = [];
    const cell = (i: number) => cells[i] ?? null;

    for (let i = IMPORT_HEADERS.length; i < cells.length; i++) {
      if (text(cell(i)) !== '') rowErrors.push(`ô ${columnLetter(i)}${line} nằm ngoài các cột của mẫu`);
    }

    const room = parseCount(cell(COL.room));
    const roomNumber = room.ok ? room.value : null;
    if (roomNumber === null || roomNumber < 1 || roomNumber > 32) {
      rowErrors.push(`Số phòng phải là số nguyên từ 1 đến 32 (đang ghi "${text(cell(COL.room)) || '(trống)'}")`);
    } else if (seen.has(roomNumber)) {
      rowErrors.push(`Phòng ${roomNumber} đã có ở dòng ${seen.get(roomNumber)}`);
    }

    const tenantName = text(cell(COL.name));
    if (tenantName.length > MAX_NAME_LENGTH) {
      rowErrors.push(`Họ và tên dài quá ${MAX_NAME_LENGTH} ký tự`);
    }

    const occupiedText = text(cell(COL.occupied)).toLowerCase();
    const occupied = occupiedText === 'có' ? true : occupiedText === 'không' ? false : null;
    if (occupied === null) {
      rowErrors.push(`Có người ở chỉ được ghi "Có" hoặc "Không" (đang ghi "${text(cell(COL.occupied)) || '(trống)'}")`);
    }

    const readings: Record<'electric' | 'water', number | null> = { electric: null, water: null };
    for (const [key, label] of [
      ['electric', 'Điện kỳ này'],
      ['water', 'Nước kỳ này'],
    ] as const) {
      const parsed = parseCount(cell(COL[key]));
      if (!parsed.ok) {
        rowErrors.push(`${label} phải là số nguyên không âm hoặc để trống (đang ghi "${text(cell(COL[key]))}")`);
        continue;
      }
      readings[key] = parsed.value;
      const before = roomNumber !== null ? previous[roomNumber]?.[key] ?? null : null;
      if (parsed.value !== null && before !== null && parsed.value < before) {
        rowErrors.push(`${label} (${parsed.value}) không được nhỏ hơn chỉ số kỳ trước (${before})`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors.map((e) => `Dòng ${line}: ${e}`));
      continue;
    }

    seen.set(roomNumber!, line);
    rows.push({
      roomNumber: roomNumber!,
      tenantName,
      occupied: occupied!,
      electricReading: readings.electric,
      waterReading: readings.water,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  if (rows.length === 0) return { ok: false, errors: ['File không có dòng dữ liệu nào (từ dòng 3 trở đi).'] };
  return { ok: true, rows };
}
