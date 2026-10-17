import { describe, it, expect } from 'vitest';
import { IMPORT_HEADERS, importTitle, validatePeriodImport, type CellValue } from './period-import';

const period = { year: 2026, month: 10 };
const noPrevious = {};

/** Dựng sheet đúng mẫu: dòng 1 tiêu đề kỳ, dòng 2 tên cột, từ dòng 3 là dữ liệu. */
function sheet(...rows: CellValue[][]): CellValue[][] {
  return [[importTitle(period)], [...IMPORT_HEADERS], ...rows];
}

function errorsOf(result: ReturnType<typeof validatePeriodImport>): string[] {
  return result.ok ? [] : result.errors;
}

describe('validatePeriodImport', () => {
  it('đọc đúng một file hợp lệ', () => {
    const result = validatePeriodImport({
      sheet: sheet([1, 'Huyền', 'Có', 100, 150, 10, 12], [2, '', 'Không', null, null, null, null]),
      period,
      previous: noPrevious,
    });

    expect(result).toEqual({
      ok: true,
      rows: [
        { roomNumber: 1, tenantName: 'Huyền', occupied: true, electricReading: 150, waterReading: 12 },
        { roomNumber: 2, tenantName: '', occupied: false, electricReading: null, waterReading: null },
      ],
    });
  });

  it('nhận chỉ số dạng chữ số (Excel lưu số thành text) và bỏ khoảng trắng', () => {
    const result = validatePeriodImport({
      sheet: sheet([' 3 ', '  An  ', ' có ', null, '200', null, ' 7 ']),
      period,
      previous: noPrevious,
    });

    expect(result.ok && result.rows[0]).toEqual({
      roomNumber: 3,
      tenantName: 'An',
      occupied: true,
      electricReading: 200,
      waterReading: 7,
    });
  });

  it('bỏ qua dòng trống hoàn toàn', () => {
    const result = validatePeriodImport({
      sheet: sheet([1, 'A', 'Có', null, 5, null, 5], [null, null, null, null, null, null, null], [2, 'B', 'Có', null, 6, null, 6]),
      period,
      previous: noPrevious,
    });

    expect(result.ok && result.rows.map((r) => r.roomNumber)).toEqual([1, 2]);
  });

  it('từ chối file của kỳ khác', () => {
    const wrong: CellValue[][] = [[importTitle({ year: 2026, month: 9 })], [...IMPORT_HEADERS], [1, 'A', 'Có', null, 5, null, 5]];
    expect(errorsOf(validatePeriodImport({ sheet: wrong, period, previous: noPrevious }))[0]).toMatch(/Tháng 9\/2026/);
  });

  it('từ chối khi tên hoặc thứ tự cột không đúng mẫu', () => {
    const swapped = [...IMPORT_HEADERS];
    [swapped[4], swapped[6]] = [swapped[6], swapped[4]];
    const result = validatePeriodImport({
      sheet: [[importTitle(period)], swapped, [1, 'A', 'Có', null, 5, null, 5]],
      period,
      previous: noPrevious,
    });
    expect(errorsOf(result).join('\n')).toMatch(/cột E.*"Điện kỳ này"/);
  });

  it('từ chối cột thừa ngoài mẫu', () => {
    const result = validatePeriodImport({
      sheet: [[importTitle(period)], [...IMPORT_HEADERS, 'Ghi chú'], [1, 'A', 'Có', null, 5, null, 5]],
      period,
      previous: noPrevious,
    });
    expect(errorsOf(result).join('\n')).toMatch(/cột H.*thừa/);
  });

  it('từ chối file không có dòng dữ liệu nào', () => {
    expect(errorsOf(validatePeriodImport({ sheet: sheet(), period, previous: noPrevious }))).toHaveLength(1);
  });

  it('báo lỗi số phòng sai, trùng, và kèm số dòng Excel', () => {
    const errors = errorsOf(
      validatePeriodImport({
        sheet: sheet(
          [0, 'A', 'Có', null, 1, null, 1],
          [33, 'B', 'Có', null, 1, null, 1],
          ['abc', 'C', 'Có', null, 1, null, 1],
          [5, 'D', 'Có', null, 1, null, 1],
          [5, 'E', 'Có', null, 1, null, 1],
        ),
        period,
        previous: noPrevious,
      }),
    );

    expect(errors).toEqual([
      expect.stringMatching(/^Dòng 3: .*Số phòng/),
      expect.stringMatching(/^Dòng 4: .*Số phòng/),
      expect.stringMatching(/^Dòng 5: .*Số phòng/),
      expect.stringMatching(/^Dòng 7: .*Phòng 5.*dòng 6/),
    ]);
  });

  it('"Có người ở" chỉ nhận Có / Không', () => {
    const errors = errorsOf(
      validatePeriodImport({
        sheet: sheet([1, 'A', 'x', null, 1, null, 1], [2, 'B', null, null, 1, null, 1], [3, 'C', 1, null, 1, null, 1]),
        period,
        previous: noPrevious,
      }),
    );
    expect(errors).toHaveLength(3);
    expect(errors.every((e) => e.includes('Có người ở'))).toBe(true);
  });

  it('chỉ số phải là số nguyên không âm', () => {
    const errors = errorsOf(
      validatePeriodImport({
        sheet: sheet([1, 'A', 'Có', null, -1, null, 1], [2, 'B', 'Có', null, 1.5, null, 1], [3, 'C', 'Có', null, 'mười', null, 1]),
        period,
        previous: noPrevious,
      }),
    );
    expect(errors).toHaveLength(3);
    expect(errors.every((e) => e.includes('Điện kỳ này'))).toBe(true);
  });

  it('chỉ số kỳ này không được nhỏ hơn kỳ trước (lấy theo CSDL, không theo file)', () => {
    const errors = errorsOf(
      validatePeriodImport({
        // Cột "kỳ trước" trong file ghi 0 nhưng CSDL là 100: phải so với 100.
        sheet: sheet([1, 'A', 'Có', 0, 90, 0, 5]),
        period,
        previous: { 1: { electric: 100, water: 5 } },
      }),
    );
    expect(errors).toEqual([expect.stringMatching(/Dòng 3: .*Điện kỳ này \(90\).*kỳ trước \(100\)/)]);
  });

  it('tên quá dài bị từ chối', () => {
    const errors = errorsOf(
      validatePeriodImport({ sheet: sheet([1, 'x'.repeat(101), 'Có', null, 1, null, 1]), period, previous: noPrevious }),
    );
    expect(errors).toEqual([expect.stringMatching(/Họ và tên/)]);
  });
});
