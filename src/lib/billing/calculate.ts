import { roundToThousand } from '@/lib/money';
import { computeConsumption } from './consumption';

export const LOSS_RATE = 0.1;

export interface UtilityInput {
  previous: number | null;
  current: number | null;
  unitPrice: number | null;
}

export interface RoomBillInput {
  roomNumber: number;
  tenantName: string;
  occupied: boolean;
  roomPrice: number | null;
  trashPrice: number | null;
  electric: UtilityInput;
  water: UtilityInput;
}

export interface UtilityBill {
  previous: number | null;
  current: number | null;
  usage: number | null;
  unitPrice: number | null;
  amount: number;
}

export interface RoomBill {
  roomNumber: number;
  tenantName: string;
  occupied: boolean;
  roomFee: number;
  trashFee: number;
  electric: UtilityBill;
  water: UtilityBill;
  lossFee: number;
  total: number;
  /** Cảnh báo tiếng Việt; rỗng nghĩa là dòng này tính được đầy đủ. */
  issues: string[];
}

function emptyUtility(input: UtilityInput): UtilityBill {
  return {
    previous: input.previous,
    current: input.current,
    usage: null,
    unitPrice: input.unitPrice,
    amount: 0,
  };
}

function billUtility(input: UtilityInput, label: string, issues: string[]): UtilityBill {
  const { usage, issue } = computeConsumption(input.previous, input.current, label);
  if (issue) issues.push(issue);

  if (input.unitPrice === null) {
    issues.push(`Chưa có đơn giá ${label} cho kỳ này`);
  }

  const amount = usage !== null && input.unitPrice !== null ? usage * input.unitPrice : 0;

  return {
    previous: input.previous,
    current: input.current,
    usage,
    unitPrice: input.unitPrice,
    amount,
  };
}

/**
 * Tính một dòng bảng TỔNG QUAN.
 * Công thức đối chiếu sổ tay (total1.jpg, dòng 1, tháng 8/2026):
 *   tổng = roundTo1000(tiềnPhòng + tiềnRác + tiềnĐiện + tiềnNước + round((tiềnĐiện + tiềnNước) * 0.1))
 * Phòng trống: mọi khoản = 0, không sinh cảnh báo thiếu dữ liệu.
 */
export function calculateRoomBill(input: RoomBillInput): RoomBill {
  if (!input.occupied) {
    return {
      roomNumber: input.roomNumber,
      tenantName: input.tenantName,
      occupied: false,
      roomFee: 0,
      trashFee: 0,
      electric: emptyUtility(input.electric),
      water: emptyUtility(input.water),
      lossFee: 0,
      total: 0,
      issues: [],
    };
  }

  const issues: string[] = [];

  if (input.roomPrice === null) issues.push('Chưa có đơn giá tiền phòng cho kỳ này');
  if (input.trashPrice === null) issues.push('Chưa có đơn giá tiền rác cho kỳ này');

  const roomFee = input.roomPrice ?? 0;
  const trashFee = input.trashPrice ?? 0;

  const electric = billUtility(input.electric, 'điện', issues);
  const water = billUtility(input.water, 'nước', issues);

  const lossFee = Math.round((electric.amount + water.amount) * LOSS_RATE);
  const total = roundToThousand(roomFee + trashFee + electric.amount + water.amount + lossFee);

  return {
    roomNumber: input.roomNumber,
    tenantName: input.tenantName,
    occupied: true,
    roomFee,
    trashFee,
    electric,
    water,
    lossFee,
    total,
    issues,
  };
}
