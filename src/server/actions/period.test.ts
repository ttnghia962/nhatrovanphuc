import { describe, it, expect } from 'vitest';
import { parsePeriodGrid } from '@/lib/admin/parse-period-grid';

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.append(key, value);
  return fd;
}

describe('parsePeriodGrid', () => {
  it('đọc một dòng đầy đủ', () => {
    const rows = parsePeriodGrid(
      form({
        tenantName_1: 'Huyền',
        occupied_1: 'on',
        electric_1: '18852',
        water_1: '1500',
      }),
    );

    expect(rows).toEqual([
      {
        roomNumber: 1,
        tenantName: 'Huyền',
        occupied: true,
        electricReading: 18852,
        waterReading: 1500,
      },
    ]);
  });

  it('thiếu checkbox occupied nghĩa là phòng trống', () => {
    const rows = parsePeriodGrid(form({ tenantName_26: '', electric_26: '' }));

    expect(rows).toEqual([
      {
        roomNumber: 26,
        tenantName: '',
        occupied: false,
        electricReading: null,
        waterReading: null,
      },
    ]);
  });

  it('ô chỉ số để trống trả về null chứ không phải 0', () => {
    const rows = parsePeriodGrid(form({ tenantName_3: 'Tình', occupied_3: 'on', electric_3: '' }));

    expect(rows[0].electricReading).toBeNull();
  });

  it('sắp xếp theo số phòng tăng dần', () => {
    const rows = parsePeriodGrid(
      form({ tenantName_10: 'A', tenantName_2: 'B', tenantName_1: 'C' }),
    );

    expect(rows.map((r) => r.roomNumber)).toEqual([1, 2, 10]);
  });

  it('cắt khoảng trắng thừa ở tên', () => {
    const rows = parsePeriodGrid(form({ tenantName_1: '  Huyền  ' }));
    expect(rows[0].tenantName).toBe('Huyền');
  });

  it('bỏ qua số phòng ngoài khoảng 1..32', () => {
    const rows = parsePeriodGrid(form({ tenantName_0: 'X', tenantName_33: 'Y', tenantName_5: 'Z' }));
    expect(rows.map((r) => r.roomNumber)).toEqual([5]);
  });

  it('bỏ qua phòng chỉ có chỉ số điện mà không có tên, để không xoá mất dữ liệu cũ', () => {
    const rows = parsePeriodGrid(form({ electric_7: '18852' }));
    expect(rows).toEqual([]);
  });

  it('bỏ qua phòng chỉ có ô tích occupied mà không có tên', () => {
    const rows = parsePeriodGrid(form({ occupied_7: 'on' }));
    expect(rows).toEqual([]);
  });

  it('đọc chỉ số nước của quản lý', () => {
    const rows = parsePeriodGrid(
      form({ tenantName_1: 'Huyền', occupied_1: 'on', water_1: '1500' }),
    );

    expect(rows[0].waterReading).toBe(1500);
  });

  it('ô nước để trống trả về null chứ không phải 0', () => {
    const rows = parsePeriodGrid(form({ tenantName_1: 'Huyền', water_1: '' }));
    expect(rows[0].waterReading).toBeNull();
  });

  it('chỉ số nước không phải số nguyên không âm thì coi như trống', () => {
    expect(parsePeriodGrid(form({ tenantName_1: 'A', water_1: '-5' }))[0].waterReading).toBeNull();
    expect(parsePeriodGrid(form({ tenantName_1: 'A', water_1: '1,5' }))[0].waterReading).toBeNull();
  });
});
