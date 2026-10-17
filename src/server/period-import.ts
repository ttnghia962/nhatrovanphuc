import ExcelJS from 'exceljs';
import { formatPeriod, type Period } from '@/lib/period';
import { IMPORT_HEADERS, importTitle, type CellValue } from '@/lib/admin/period-import';
import { loadPeriodGrid } from './period-grid';

/** Tên sheet nhập liệu trong file mẫu; khi tải lên chỉ đọc đúng sheet này. */
export const IMPORT_SHEET = 'Nhap lieu';
const DATA_ROWS = 32;
/** Một file mẫu chuẩn chỉ có 34 dòng; chặn file lạ quá lớn trước khi duyệt từng ô. */
const MAX_ROWS = 200;

/** File mẫu của một kỳ, điền sẵn dữ liệu hiện có để quản lý chỉ việc sửa rồi tải lên. */
export async function buildPeriodTemplate(period: Period): Promise<Buffer> {
  const { rows } = await loadPeriodGrid(period);
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(IMPORT_SHEET);
  sheet.addRow([importTitle(period)]).font = { bold: true, size: 14 };
  sheet.addRow([...IMPORT_HEADERS]).font = { bold: true };

  for (const row of rows) {
    sheet.addRow([
      row.roomNumber,
      row.tenantName,
      row.occupied ? 'Có' : 'Không',
      row.electricPrevious,
      row.electricCurrent,
      row.waterPrevious,
      row.waterCurrent,
    ]);
  }

  sheet.columns = [{ width: 10 }, { width: 28 }, { width: 13 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
  sheet.views = [{ state: 'frozen', ySplit: 2 }];

  const lastRow = 2 + Math.max(rows.length, DATA_ROWS);
  for (let r = 3; r <= lastRow; r++) {
    sheet.getCell(`C${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Có,Không"'],
      showErrorMessage: true,
      errorTitle: 'Có người ở',
      error: 'Chỉ chọn "Có" hoặc "Không".',
    };
    // Cột "kỳ trước" chỉ để tham khảo, tô xám cho dễ phân biệt với cột cần nhập.
    for (const col of ['D', 'F']) {
      sheet.getCell(`${col}${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    }
  }

  const guide = workbook.addWorksheet('Huong dan');
  [
    `Cách nhập liệu ${formatPeriod(period)} bằng Excel`,
    '',
    `1. Chỉ sửa sheet "${IMPORT_SHEET}". Không đổi ô A1, không đổi tên hay thứ tự cột ở dòng 2.`,
    '2. Mỗi dòng một phòng. Số phòng từ 1 đến 32, không trùng. Có thể xoá bớt dòng của phòng không cần sửa.',
    '3. "Có người ở" chỉ ghi "Có" hoặc "Không".',
    '4. "Điện kỳ này", "Nước kỳ này" là số nguyên không âm, không nhỏ hơn chỉ số kỳ trước.',
    '5. Để trống ô chỉ số nghĩa là XOÁ chỉ số đó (giống ô trống trên web), không phải ghi 0.',
    '6. Cột "kỳ trước" (tô xám) chỉ để tham khảo, khi tải lên sẽ bỏ qua; chỉ số kỳ trước luôn lấy từ hệ thống.',
    '7. Có bất kỳ lỗi nào thì cả file không được lưu; web sẽ liệt kê từng lỗi kèm số dòng để sửa.',
  ].forEach((line) => guide.addRow([line]));
  guide.getRow(1).font = { bold: true, size: 14 };
  guide.getColumn(1).width = 110;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Quy một ô ExcelJS về kiểu cơ bản: công thức lấy kết quả, rich text nối chữ. */
function toCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value) return toCellValue((value.result ?? null) as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return String(value.text);
    if ('error' in value) return String(value.error);
  }
  return String(value);
}

export type SheetReadResult = { ok: true; sheet: CellValue[][] } | { ok: false; error: string };

/** Đọc sheet nhập liệu thành mảng 2 chiều (dòng 0 = dòng 1 của Excel, cột 0 = cột A). */
export async function readImportSheet(data: ArrayBuffer): Promise<SheetReadResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    return { ok: false, error: 'Không đọc được file. Hãy dùng file .xlsx tải từ nút "Tải file mẫu".' };
  }

  const sheet = workbook.getWorksheet(IMPORT_SHEET);
  if (!sheet) {
    return { ok: false, error: `File không có sheet "${IMPORT_SHEET}". Hãy dùng file mẫu tải từ web.` };
  }
  if (sheet.rowCount > MAX_ROWS) {
    return { ok: false, error: `Sheet "${IMPORT_SHEET}" có ${sheet.rowCount} dòng, quá nhiều so với mẫu (tối đa ${MAX_ROWS}).` };
  }

  const rows: CellValue[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: CellValue[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = toCellValue(cell.value);
    });
    rows[rowNumber - 1] = Array.from(cells, (c) => c ?? null);
  });
  return { ok: true, sheet: Array.from(rows, (r) => r ?? []) };
}
