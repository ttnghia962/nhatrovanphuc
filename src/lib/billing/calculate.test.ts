import { describe, it, expect } from 'vitest';
import { calculateRoomBill, type RoomBillInput } from './calculate';

function baseInput(overrides: Partial<RoomBillInput> = {}): RoomBillInput {
  return {
    roomNumber: 1,
    tenantName: 'Huyền',
    occupied: true,
    roomPrice: 800000,
    trashPrice: 20000,
    electric: { previous: 18708, current: 18852, unitPrice: 3500 },
    water: { previous: 1495, current: 1500, unitPrice: 7000 },
    ...overrides,
  };
}

describe('calculateRoomBill', () => {
  it('khớp dòng 1 của sổ tay tháng 8/2026', () => {
    const bill = calculateRoomBill(baseInput());

    expect(bill.electric.usage).toBe(144);
    expect(bill.electric.amount).toBe(504000);
    expect(bill.water.usage).toBe(5);
    expect(bill.water.amount).toBe(35000);
    expect(bill.lossFee).toBe(53900);
    expect(bill.total).toBe(1413000);
    expect(bill.issues).toEqual([]);
  });

  it('phòng trống thì mọi khoản bằng 0 và không báo thiếu chỉ số', () => {
    const bill = calculateRoomBill(
      baseInput({
        occupied: false,
        tenantName: '',
        electric: { previous: null, current: null, unitPrice: 3500 },
        water: { previous: null, current: null, unitPrice: 7000 },
      }),
    );

    expect(bill.roomFee).toBe(0);
    expect(bill.trashFee).toBe(0);
    expect(bill.electric.amount).toBe(0);
    expect(bill.water.amount).toBe(0);
    expect(bill.lossFee).toBe(0);
    expect(bill.total).toBe(0);
    expect(bill.issues).toEqual([]);
  });

  it('thiếu chỉ số nước thì tiền nước bằng 0 và ghi nhận cảnh báo', () => {
    const bill = calculateRoomBill(
      baseInput({ water: { previous: 1495, current: null, unitPrice: 7000 } }),
    );

    expect(bill.water.usage).toBeNull();
    expect(bill.water.amount).toBe(0);
    expect(bill.issues).toContain('Thiếu chỉ số nước của kỳ này');
    expect(bill.lossFee).toBe(50400);
    expect(bill.total).toBe(1374000);
  });

  it('thiếu đơn giá điện thì cảnh báo và không tính tiền điện', () => {
    const bill = calculateRoomBill(
      baseInput({ electric: { previous: 18708, current: 18852, unitPrice: null } }),
    );

    expect(bill.electric.amount).toBe(0);
    expect(bill.issues).toContain('Chưa có đơn giá điện cho kỳ này');
  });

  it('thiếu đơn giá tiền phòng thì cảnh báo và tính 0', () => {
    const bill = calculateRoomBill(baseInput({ roomPrice: null }));

    expect(bill.roomFee).toBe(0);
    expect(bill.issues).toContain('Chưa có đơn giá tiền phòng cho kỳ này');
  });

  it('hao hụt làm tròn tới 1 đồng', () => {
    const bill = calculateRoomBill(
      baseInput({
        roomPrice: 0,
        trashPrice: 0,
        electric: { previous: 0, current: 1, unitPrice: 3333 },
        water: { previous: 0, current: 0, unitPrice: 7000 },
      }),
    );

    expect(bill.lossFee).toBe(333);
  });

  it('giữ nguyên số phòng và tên người thuê', () => {
    const bill = calculateRoomBill(baseInput({ roomNumber: 24, tenantName: 'Nhân' }));
    expect(bill.roomNumber).toBe(24);
    expect(bill.tenantName).toBe('Nhân');
  });
});
