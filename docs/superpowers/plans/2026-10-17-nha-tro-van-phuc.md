# Nhà trọ Vạn Phúc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Website quản lý tiền phòng cho 32 phòng, thay thế sổ tay viết tay, với 2 vai trò admin và khách thuê.

**Architecture:** Next.js App Router một repo duy nhất. Toàn bộ logic tính tiền nằm trong các hàm thuần ở `src/lib/billing/` — không chạm DB, test bằng Vitest, nên kiểm chứng được trực tiếp với số liệu sổ tay. Tầng `src/server/` dùng Prisma gom dữ liệu rồi đưa vào các hàm thuần đó. UI gọi Server Actions. Tiền lưu bằng số nguyên VND.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Prisma + SQLite, Tailwind CSS, Zod, ExcelJS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-nha-tro-van-phuc.md`

## Global Constraints

- Node.js >= 20. Package manager: `npm`.
- Mọi số tiền là **số nguyên VND**. Không dùng số thực cho tiền. Prisma dùng `Int`.
- Kỳ tính tiền là cặp số nguyên `year` (4 chữ số) và `month` (1..12). Không dùng `Date` để biểu diễn kỳ.
- Số phòng là số nguyên `1..32`, là khoá chính của bảng `Room`.
- Hao hụt: `Math.round((tiềnĐiện + tiềnNước) * 0.10)` — làm tròn tới 1đ.
- Tổng: làm tròn tới **1.000đ** gần nhất — `Math.round(x / 1000) * 1000`.
- Toàn bộ chữ hiển thị trên UI bằng **tiếng Việt có dấu**.
- Mã PIN quản lý: **đúng 6 chữ số**, lưu ở `Setting` khoá `ADMIN_PIN`, mặc định `000000`. Lưu dạng chữ thường (không băm) để chủ trọ đọc lại được từ DB khi quên — vì vậy **không bao giờ commit file DB**.
- Định dạng tiền hiển thị: `new Intl.NumberFormat('vi-VN').format(n)` (ví dụ `1.413.000`), không kèm ký hiệu `₫` trong ô bảng.
- Không được âm thầm thay dữ liệu thiếu bằng 0 — luôn trả `null` kèm thông báo trong mảng `issues`.
- Mỗi task kết thúc bằng một commit, tiền tố `feat:` / `test:` / `chore:`.

## File Structure

| File | Trách nhiệm |
|---|---|
| `prisma/schema.prisma` | 4 model: Room, Rate, MeterReading, MonthlyRecord |
| `prisma/seed.ts` | Tạo 32 phòng và bộ đơn giá khởi điểm |
| `src/lib/money.ts` | Làm tròn và định dạng tiền |
| `src/lib/period.ts` | Kiểu `Period`, so sánh, lùi tháng |
| `src/lib/billing/rates.ts` | Hàm thuần chọn đơn giá theo mốc thời gian (FR-2) |
| `src/lib/billing/consumption.ts` | Hàm thuần tính số tiêu thụ từ 2 chỉ số (FR-3) |
| `src/lib/billing/calculate.ts` | Hàm thuần tính một dòng TỔNG QUAN (FR-4) |
| `src/server/db.ts` | Prisma client singleton |
| `src/server/billing.ts` | Gom dữ liệu kỳ, gọi `calculate.ts`, dựng bảng tổng quan và pivot |
| `src/server/session.ts` | Cookie phiên ký HMAC, phân vai admin/tenant |
| `src/server/actions/*.ts` | Server Actions ghi dữ liệu |
| `src/server/excel.ts` | Dựng workbook xuất Excel (FR-8) |
| `src/components/*.tsx` | Bảng, ô tiền, thanh chọn kỳ |
| `src/app/login/page.tsx` | Chọn phòng hoặc nhập PIN admin |
| `src/app/phong/[roomNumber]/page.tsx` | Dashboard khách thuê |
| `src/app/admin/ky/[year]/[month]/page.tsx` | Lưới nhập liệu theo tháng |
| `src/app/admin/don-gia/page.tsx` | Quản lý đơn giá |
| `src/app/admin/page.tsx` | Dashboard tổng quát |
| `src/app/api/export/route.ts` | Tải file Excel |

---

### Task 1: Khởi tạo dự án, schema và tiện ích nền

**Files:**
- Create: `package.json`, `vitest.config.ts`, `.env`
- Create: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: `src/lib/period.ts`, `src/lib/money.ts`
- Test: `src/lib/period.test.ts`, `src/lib/money.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces:
  - `type Period = { year: number; month: number }`
  - `function previousPeriod(p: Period): Period`
  - `function comparePeriods(a: Period, b: Period): number`
  - `function formatPeriod(p: Period): string`
  - `const MONTHS: readonly number[]`
  - `function roundToThousand(n: number): number`
  - `function formatVnd(n: number): string`
  - Prisma models `Room`, `Rate`, `MeterReading`, `MonthlyRecord`, `Setting`; enums `FeeType`, `MeterType`, `EnteredBy`
  - Bản ghi `Setting` khoá `ADMIN_PIN`, giá trị mặc định `'000000'`

- [ ] **Step 1: Tạo dự án và cài phụ thuộc**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --use-npm
npm install prisma @prisma/client zod exceljs
npm install -D vitest vite-tsconfig-paths tsx
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 2: Cấu hình Vitest và script npm**

Tạo `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Thêm vào `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 3: Viết test thất bại cho period và money**

Tạo `src/lib/period.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { previousPeriod, comparePeriods, formatPeriod } from './period';

describe('previousPeriod', () => {
  it('lùi 1 tháng trong cùng năm', () => {
    expect(previousPeriod({ year: 2026, month: 8 })).toEqual({ year: 2026, month: 7 });
  });

  it('lùi từ tháng 1 sang tháng 12 năm trước', () => {
    expect(previousPeriod({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
  });
});

describe('comparePeriods', () => {
  it('trả số âm khi a trước b', () => {
    expect(comparePeriods({ year: 2026, month: 1 }, { year: 2026, month: 2 })).toBeLessThan(0);
  });

  it('trả 0 khi hai kỳ bằng nhau', () => {
    expect(comparePeriods({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(0);
  });

  it('so sánh năm trước, tháng sau', () => {
    expect(comparePeriods({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
  });
});

describe('formatPeriod', () => {
  it('hiển thị dạng Tháng M/YYYY', () => {
    expect(formatPeriod({ year: 2026, month: 8 })).toBe('Tháng 8/2026');
  });
});
```

Tạo `src/lib/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { roundToThousand, formatVnd } from './money';

describe('roundToThousand', () => {
  it('làm tròn lên khi phần dư >= 500', () => {
    expect(roundToThousand(1412900)).toBe(1413000);
  });

  it('làm tròn xuống khi phần dư < 500', () => {
    expect(roundToThousand(1412400)).toBe(1412000);
  });

  it('giữ nguyên số đã tròn nghìn', () => {
    expect(roundToThousand(800000)).toBe(800000);
  });

  it('trả 0 cho 0', () => {
    expect(roundToThousand(0)).toBe(0);
  });
});

describe('formatVnd', () => {
  it('dùng dấu chấm phân tách hàng nghìn', () => {
    expect(formatVnd(1413000)).toBe('1.413.000');
  });
});
```

- [ ] **Step 4: Chạy test để xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./period"` và `"./money"`.

- [ ] **Step 5: Viết implementation tối thiểu**

Tạo `src/lib/period.ts`:

```ts
export type Period = { year: number; month: number };

export const MONTHS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function previousPeriod(p: Period): Period {
  if (p.month === 1) return { year: p.year - 1, month: 12 };
  return { year: p.year, month: p.month - 1 };
}

export function comparePeriods(a: Period, b: Period): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function formatPeriod(p: Period): string {
  return `Tháng ${p.month}/${p.year}`;
}
```

Tạo `src/lib/money.ts`:

```ts
export function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

const vndFormatter = new Intl.NumberFormat('vi-VN');

export function formatVnd(n: number): string {
  return vndFormatter.format(n);
}
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npm test`
Expected: PASS — 9 test.

- [ ] **Step 7: Viết schema Prisma**

Ghi đè `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum FeeType {
  ROOM
  TRASH
  ELECTRIC
  WATER
}

enum MeterType {
  ELECTRIC
  WATER
}

enum EnteredBy {
  ADMIN
  TENANT
}

model Room {
  number            Int             @id
  defaultTenantName String          @default("")
  rates             Rate[]
  readings          MeterReading[]
  records           MonthlyRecord[]
}

/// Đơn giá có hiệu lực từ một mốc thời gian. roomNumber = null nghĩa là áp dụng chung mọi phòng.
model Rate {
  id             Int     @id @default(autoincrement())
  feeType        FeeType
  roomNumber     Int?
  room           Room?   @relation(fields: [roomNumber], references: [number])
  effectiveYear  Int
  effectiveMonth Int
  unitPrice      Int
  note           String  @default("")

  @@unique([feeType, roomNumber, effectiveYear, effectiveMonth])
  @@index([feeType, effectiveYear, effectiveMonth])
}

/// Chỉ số đồng hồ ghi tại kỳ (year, month). Số tiêu thụ = chỉ số kỳ này trừ chỉ số kỳ trước.
model MeterReading {
  id         Int       @id @default(autoincrement())
  roomNumber Int
  room       Room      @relation(fields: [roomNumber], references: [number])
  meterType  MeterType
  year       Int
  month      Int
  value      Int
  enteredBy  EnteredBy
  recordedAt DateTime  @default(now())

  @@unique([roomNumber, meterType, year, month])
  @@index([year, month])
}

/// Cấu hình dạng khoá-giá trị. Hiện dùng cho khoá 'ADMIN_PIN'.
model Setting {
  key   String @id
  value String
}

/// Trạng thái một phòng trong một kỳ. snapshotJson chỉ ghi khi locked = true.
model MonthlyRecord {
  id           Int     @id @default(autoincrement())
  roomNumber   Int
  room         Room    @relation(fields: [roomNumber], references: [number])
  year         Int
  month        Int
  tenantName   String  @default("")
  occupied     Boolean @default(true)
  locked       Boolean @default(false)
  snapshotJson String?

  @@unique([roomNumber, year, month])
  @@index([year, month])
}
```

- [ ] **Step 8: Viết seed và đẩy schema**

Tạo `prisma/seed.ts`:

```ts
import { PrismaClient, FeeType } from '@prisma/client';

const prisma = new PrismaClient();

/** Đơn giá khởi điểm, lấy theo sổ tay tháng 8/2026. */
const BASE_RATES: { feeType: FeeType; unitPrice: number; note: string }[] = [
  { feeType: FeeType.ROOM, unitPrice: 800000, note: 'Tiền phòng mặc định' },
  { feeType: FeeType.TRASH, unitPrice: 20000, note: 'Tiền rác' },
  { feeType: FeeType.ELECTRIC, unitPrice: 3500, note: 'Đơn giá điện mỗi kWh' },
  { feeType: FeeType.WATER, unitPrice: 7000, note: 'Đơn giá nước mỗi khối' },
];

async function main() {
  for (let number = 1; number <= 32; number++) {
    await prisma.room.upsert({
      where: { number },
      update: {},
      create: { number, defaultTenantName: '' },
    });
  }

  for (const rate of BASE_RATES) {
    const existing = await prisma.rate.findFirst({
      where: {
        feeType: rate.feeType,
        roomNumber: null,
        effectiveYear: 2026,
        effectiveMonth: 1,
      },
    });

    if (existing) {
      await prisma.rate.update({
        where: { id: existing.id },
        data: { unitPrice: rate.unitPrice, note: rate.note },
      });
    } else {
      await prisma.rate.create({
        data: {
          feeType: rate.feeType,
          roomNumber: null,
          effectiveYear: 2026,
          effectiveMonth: 1,
          unitPrice: rate.unitPrice,
          note: rate.note,
        },
      });
    }
  }

  // PIN quản lý mặc định. Không ghi đè nếu admin đã đổi.
  await prisma.setting.upsert({
    where: { key: 'ADMIN_PIN' },
    update: {},
    create: { key: 'ADMIN_PIN', value: '000000' },
  });

  console.log('Seed xong: 32 phong, 4 don gia chung, PIN mac dinh 000000.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Đặt `.env`:

```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="doi-chuoi-nay-truoc-khi-deploy"
```

Thêm vào `.gitignore` (không bao giờ commit DB vì chứa PIN dạng chữ thường):

```
prisma/dev.db
prisma/dev.db-journal
.env
```

Run:

```bash
npm run db:push
npm run db:seed
```

Expected: in ra `Seed xong: 32 phong, 4 don gia chung, PIN mac dinh 000000.`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: khởi tạo dự án Next.js, schema Prisma và tiện ích kỳ/tiền"
```

---

### Task 2: Tra cứu đơn giá theo mốc thời gian

**Files:**
- Create: `src/lib/billing/rates.ts`
- Test: `src/lib/billing/rates.test.ts`

**Interfaces:**
- Consumes: `Period`, `comparePeriods` từ `src/lib/period.ts` (Task 1)
- Produces:
  - `type FeeTypeName = 'ROOM' | 'TRASH' | 'ELECTRIC' | 'WATER'`
  - `interface RateRow { feeType: FeeTypeName; roomNumber: number | null; effectiveYear: number; effectiveMonth: number; unitPrice: number }`
  - `function pickRate(rates: RateRow[], feeType: FeeTypeName, roomNumber: number, period: Period): number | null`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/billing/rates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickRate, type RateRow } from './rates';

const rates: RateRow[] = [
  { feeType: 'ROOM', roomNumber: null, effectiveYear: 2025, effectiveMonth: 1, unitPrice: 700000 },
  { feeType: 'ROOM', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 800000 },
  { feeType: 'ROOM', roomNumber: 24, effectiveYear: 2025, effectiveMonth: 6, unitPrice: 300000 },
  { feeType: 'ELECTRIC', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 3500 },
];

describe('pickRate', () => {
  it('lấy đơn giá chung có hiệu lực mới nhất không vượt quá kỳ', () => {
    expect(pickRate(rates, 'ROOM', 1, { year: 2026, month: 8 })).toBe(800000);
  });

  it('lấy đơn giá cũ khi kỳ nằm trước mốc đơn giá mới', () => {
    expect(pickRate(rates, 'ROOM', 1, { year: 2025, month: 12 })).toBe(700000);
  });

  it('đơn giá riêng của phòng thắng đơn giá chung dù mốc cũ hơn', () => {
    expect(pickRate(rates, 'ROOM', 24, { year: 2026, month: 8 })).toBe(300000);
  });

  it('rơi về đơn giá chung nếu đơn giá riêng chưa có hiệu lực', () => {
    expect(pickRate(rates, 'ROOM', 24, { year: 2025, month: 3 })).toBe(700000);
  });

  it('trả null khi không có đơn giá nào có hiệu lực', () => {
    expect(pickRate(rates, 'ELECTRIC', 1, { year: 2024, month: 1 })).toBeNull();
  });

  it('trả null khi không có loại phí đó', () => {
    expect(pickRate(rates, 'WATER', 1, { year: 2026, month: 8 })).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- rates`
Expected: FAIL — `Failed to resolve import "./rates"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/billing/rates.ts`:

```ts
import { comparePeriods, type Period } from '@/lib/period';

export type FeeTypeName = 'ROOM' | 'TRASH' | 'ELECTRIC' | 'WATER';

export interface RateRow {
  feeType: FeeTypeName;
  /** null = áp dụng cho mọi phòng */
  roomNumber: number | null;
  effectiveYear: number;
  effectiveMonth: number;
  unitPrice: number;
}

function latestEffective(rows: RateRow[], period: Period): RateRow | null {
  let best: RateRow | null = null;
  for (const row of rows) {
    const effective: Period = { year: row.effectiveYear, month: row.effectiveMonth };
    if (comparePeriods(effective, period) > 0) continue;
    if (
      best === null ||
      comparePeriods(effective, { year: best.effectiveYear, month: best.effectiveMonth }) > 0
    ) {
      best = row;
    }
  }
  return best;
}

/**
 * Chọn đơn giá áp dụng cho một phòng tại một kỳ.
 * Ưu tiên đơn giá riêng của phòng; chỉ rơi về đơn giá chung khi phòng chưa có
 * đơn giá riêng nào có hiệu lực tại kỳ đó. Trả null nếu không tìm được.
 */
export function pickRate(
  rates: RateRow[],
  feeType: FeeTypeName,
  roomNumber: number,
  period: Period,
): number | null {
  const sameType = rates.filter((r) => r.feeType === feeType);

  const roomSpecific = latestEffective(
    sameType.filter((r) => r.roomNumber === roomNumber),
    period,
  );
  if (roomSpecific) return roomSpecific.unitPrice;

  const shared = latestEffective(
    sameType.filter((r) => r.roomNumber === null),
    period,
  );
  return shared ? shared.unitPrice : null;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- rates`
Expected: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/rates.ts src/lib/billing/rates.test.ts
git commit -m "feat: tra cứu đơn giá theo mốc thời gian, có override theo phòng"
```

---

### Task 3: Tính số tiêu thụ từ chỉ số đồng hồ

**Files:**
- Create: `src/lib/billing/consumption.ts`
- Test: `src/lib/billing/consumption.test.ts`

**Interfaces:**
- Consumes: không có
- Produces:
  - `interface ConsumptionResult { usage: number | null; issue: string | null }`
  - `function computeConsumption(previous: number | null, current: number | null, label: string): ConsumptionResult`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/billing/consumption.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeConsumption } from './consumption';

describe('computeConsumption', () => {
  it('trả hiệu của chỉ số mới và chỉ số cũ', () => {
    expect(computeConsumption(18708, 18852, 'điện')).toEqual({ usage: 144, issue: null });
  });

  it('chấp nhận số tiêu thụ bằng 0', () => {
    expect(computeConsumption(1495, 1495, 'nước')).toEqual({ usage: 0, issue: null });
  });

  it('báo thiếu chỉ số kỳ trước', () => {
    expect(computeConsumption(null, 18852, 'điện')).toEqual({
      usage: null,
      issue: 'Thiếu chỉ số điện của kỳ trước',
    });
  });

  it('báo thiếu chỉ số kỳ này', () => {
    expect(computeConsumption(18708, null, 'nước')).toEqual({
      usage: null,
      issue: 'Thiếu chỉ số nước của kỳ này',
    });
  });

  it('báo lỗi khi chỉ số mới nhỏ hơn chỉ số cũ', () => {
    expect(computeConsumption(18852, 18708, 'điện')).toEqual({
      usage: null,
      issue: 'Chỉ số điện kỳ này (18708) nhỏ hơn kỳ trước (18852)',
    });
  });

  it('ưu tiên báo thiếu kỳ trước khi cả hai đều thiếu', () => {
    expect(computeConsumption(null, null, 'điện')).toEqual({
      usage: null,
      issue: 'Thiếu chỉ số điện của kỳ trước',
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- consumption`
Expected: FAIL — `Failed to resolve import "./consumption"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/billing/consumption.ts`:

```ts
export interface ConsumptionResult {
  /** Số tiêu thụ, hoặc null khi không tính được. */
  usage: number | null;
  /** Mô tả vấn đề bằng tiếng Việt, hoặc null khi bình thường. */
  issue: string | null;
}

/**
 * Tính số tiêu thụ = chỉ số kỳ này trừ chỉ số kỳ trước.
 * Không bao giờ đoán hay thay bằng 0: thiếu dữ liệu thì trả usage = null kèm issue.
 * @param label nhãn tiếng Việt của loại đồng hồ, ví dụ 'điện' hoặc 'nước'
 */
export function computeConsumption(
  previous: number | null,
  current: number | null,
  label: string,
): ConsumptionResult {
  if (previous === null) {
    return { usage: null, issue: `Thiếu chỉ số ${label} của kỳ trước` };
  }
  if (current === null) {
    return { usage: null, issue: `Thiếu chỉ số ${label} của kỳ này` };
  }
  if (current < previous) {
    return {
      usage: null,
      issue: `Chỉ số ${label} kỳ này (${current}) nhỏ hơn kỳ trước (${previous})`,
    };
  }
  return { usage: current - previous, issue: null };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- consumption`
Expected: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/consumption.ts src/lib/billing/consumption.test.ts
git commit -m "feat: tính số tiêu thụ điện nước từ chỉ số đồng hồ"
```

---

### Task 4: Tính một dòng bảng TỔNG QUAN

Đây là trái tim của hệ thống. Test phải khớp đúng dòng 1 của `total1.jpg`.

**Files:**
- Create: `src/lib/billing/calculate.ts`
- Test: `src/lib/billing/calculate.test.ts`

**Interfaces:**
- Consumes: `computeConsumption` (Task 3), `roundToThousand` (Task 1)
- Produces:
  - `const LOSS_RATE = 0.1`
  - `interface UtilityInput { previous: number | null; current: number | null; unitPrice: number | null }`
  - `interface RoomBillInput { roomNumber: number; tenantName: string; occupied: boolean; roomPrice: number | null; trashPrice: number | null; electric: UtilityInput; water: UtilityInput }`
  - `interface UtilityBill { previous: number | null; current: number | null; usage: number | null; unitPrice: number | null; amount: number }`
  - `interface RoomBill { roomNumber: number; tenantName: string; occupied: boolean; roomFee: number; trashFee: number; electric: UtilityBill; water: UtilityBill; lossFee: number; total: number; issues: string[] }`
  - `function calculateRoomBill(input: RoomBillInput): RoomBill`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/billing/calculate.test.ts`:

```ts
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
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- calculate`
Expected: FAIL — `Failed to resolve import "./calculate"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/billing/calculate.ts`:

```ts
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
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test`
Expected: PASS — toàn bộ test của Task 1 đến Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/calculate.ts src/lib/billing/calculate.test.ts
git commit -m "feat: tính dòng tổng quan tiền phòng, khớp số liệu sổ tay"
```

---

### Task 5: Tầng server — dựng bảng TỔNG QUAN của một kỳ

**Files:**
- Create: `src/server/db.ts`
- Create: `src/server/billing.ts`
- Test: `src/server/billing.test.ts`

**Interfaces:**
- Consumes: `pickRate`, `RateRow` (Task 2); `calculateRoomBill`, `RoomBill`, `RoomBillInput` (Task 4); `previousPeriod`, `Period` (Task 1)
- Produces:
  - `const prisma: PrismaClient` (từ `src/server/db.ts`)
  - `interface PeriodSummary { period: Period; rows: RoomBill[]; totals: { roomFee: number; trashFee: number; electricFee: number; waterFee: number; lossFee: number; total: number } }`
  - `function buildPeriodSummary(data: PeriodData): PeriodSummary` — hàm thuần, nhận dữ liệu đã nạp sẵn
  - `interface PeriodData { period: Period; rooms: { number: number; defaultTenantName: string }[]; records: { roomNumber: number; tenantName: string; occupied: boolean; locked: boolean; snapshotJson: string | null }[]; readings: { roomNumber: number; meterType: 'ELECTRIC' | 'WATER'; year: number; month: number; value: number }[]; rates: RateRow[] }`
  - `async function loadPeriodSummary(period: Period): Promise<PeriodSummary>` — nạp từ DB rồi gọi `buildPeriodSummary`

Ghi chú thiết kế: tách đôi `buildPeriodSummary` (thuần, test được) và `loadPeriodSummary` (chạm DB). Test chỉ nhắm vào hàm thuần.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/billing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPeriodSummary, type PeriodData } from './billing';
import type { RateRow } from '@/lib/billing/rates';

const rates: RateRow[] = [
  { feeType: 'ROOM', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 800000 },
  { feeType: 'TRASH', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 20000 },
  { feeType: 'ELECTRIC', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 3500 },
  { feeType: 'WATER', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 7000 },
];

function data(overrides: Partial<PeriodData> = {}): PeriodData {
  return {
    period: { year: 2026, month: 8 },
    rooms: [
      { number: 1, defaultTenantName: 'Huyền' },
      { number: 26, defaultTenantName: '' },
    ],
    records: [
      { roomNumber: 1, tenantName: 'Huyền', occupied: true, locked: false, snapshotJson: null },
      { roomNumber: 26, tenantName: '', occupied: false, locked: false, snapshotJson: null },
    ],
    readings: [
      { roomNumber: 1, meterType: 'ELECTRIC', year: 2026, month: 7, value: 18708 },
      { roomNumber: 1, meterType: 'ELECTRIC', year: 2026, month: 8, value: 18852 },
      { roomNumber: 1, meterType: 'WATER', year: 2026, month: 7, value: 1495 },
      { roomNumber: 1, meterType: 'WATER', year: 2026, month: 8, value: 1500 },
    ],
    rates,
    ...overrides,
  };
}

describe('buildPeriodSummary', () => {
  it('ghép chỉ số kỳ trước làm chỉ số cũ và tính đúng dòng phòng 1', () => {
    const summary = buildPeriodSummary(data());
    const room1 = summary.rows.find((r) => r.roomNumber === 1)!;

    expect(room1.electric.previous).toBe(18708);
    expect(room1.electric.current).toBe(18852);
    expect(room1.total).toBe(1413000);
  });

  it('phòng trống ra 0 đồng', () => {
    const summary = buildPeriodSummary(data());
    const room26 = summary.rows.find((r) => r.roomNumber === 26)!;

    expect(room26.occupied).toBe(false);
    expect(room26.total).toBe(0);
  });

  it('sắp xếp các dòng theo số phòng tăng dần', () => {
    const summary = buildPeriodSummary(data());
    expect(summary.rows.map((r) => r.roomNumber)).toEqual([1, 26]);
  });

  it('cộng dòng tổng cuối bảng', () => {
    const summary = buildPeriodSummary(data());

    expect(summary.totals.roomFee).toBe(800000);
    expect(summary.totals.electricFee).toBe(504000);
    expect(summary.totals.waterFee).toBe(35000);
    expect(summary.totals.lossFee).toBe(53900);
    expect(summary.totals.total).toBe(1413000);
  });

  it('phòng chưa có MonthlyRecord thì mặc định là có người ở và lấy tên mặc định', () => {
    const summary = buildPeriodSummary(data({ records: [] }));
    const room1 = summary.rows.find((r) => r.roomNumber === 1)!;

    expect(room1.occupied).toBe(true);
    expect(room1.tenantName).toBe('Huyền');
  });

  it('kỳ đã khoá thì dùng số liệu trong snapshot thay vì tính lại', () => {
    const frozen = {
      roomNumber: 1,
      tenantName: 'Huyền',
      occupied: true,
      roomFee: 700000,
      trashFee: 20000,
      electric: { previous: 18708, current: 18852, usage: 144, unitPrice: 3000, amount: 432000 },
      water: { previous: 1495, current: 1500, usage: 5, unitPrice: 7000, amount: 35000 },
      lossFee: 46700,
      total: 1202000,
      issues: [],
    };

    const summary = buildPeriodSummary(
      data({
        records: [
          {
            roomNumber: 1,
            tenantName: 'Huyền',
            occupied: true,
            locked: true,
            snapshotJson: JSON.stringify(frozen),
          },
          { roomNumber: 26, tenantName: '', occupied: false, locked: false, snapshotJson: null },
        ],
      }),
    );

    expect(summary.rows.find((r) => r.roomNumber === 1)!.total).toBe(1202000);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- billing`
Expected: FAIL — `Failed to resolve import "./billing"`.

- [ ] **Step 3: Viết Prisma client singleton**

Tạo `src/server/db.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Viết implementation của billing**

Tạo `src/server/billing.ts`:

```ts
import { previousPeriod, type Period } from '@/lib/period';
import { pickRate, type RateRow } from '@/lib/billing/rates';
import { calculateRoomBill, type RoomBill } from '@/lib/billing/calculate';
import { prisma } from './db';

export interface PeriodData {
  period: Period;
  rooms: { number: number; defaultTenantName: string }[];
  records: {
    roomNumber: number;
    tenantName: string;
    occupied: boolean;
    locked: boolean;
    snapshotJson: string | null;
  }[];
  readings: {
    roomNumber: number;
    meterType: 'ELECTRIC' | 'WATER';
    year: number;
    month: number;
    value: number;
  }[];
  rates: RateRow[];
}

export interface PeriodTotals {
  roomFee: number;
  trashFee: number;
  electricFee: number;
  waterFee: number;
  lossFee: number;
  total: number;
}

export interface PeriodSummary {
  period: Period;
  rows: RoomBill[];
  totals: PeriodTotals;
}

function readingValue(
  readings: PeriodData['readings'],
  roomNumber: number,
  meterType: 'ELECTRIC' | 'WATER',
  period: Period,
): number | null {
  const hit = readings.find(
    (r) =>
      r.roomNumber === roomNumber &&
      r.meterType === meterType &&
      r.year === period.year &&
      r.month === period.month,
  );
  return hit ? hit.value : null;
}

/** Hàm thuần: nhận dữ liệu đã nạp sẵn, trả bảng TỔNG QUAN của kỳ. */
export function buildPeriodSummary(data: PeriodData): PeriodSummary {
  const prev = previousPeriod(data.period);

  const rows: RoomBill[] = data.rooms
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((room) => {
      const record = data.records.find((r) => r.roomNumber === room.number);

      if (record?.locked && record.snapshotJson) {
        return JSON.parse(record.snapshotJson) as RoomBill;
      }

      return calculateRoomBill({
        roomNumber: room.number,
        tenantName: record?.tenantName || room.defaultTenantName,
        occupied: record ? record.occupied : true,
        roomPrice: pickRate(data.rates, 'ROOM', room.number, data.period),
        trashPrice: pickRate(data.rates, 'TRASH', room.number, data.period),
        electric: {
          previous: readingValue(data.readings, room.number, 'ELECTRIC', prev),
          current: readingValue(data.readings, room.number, 'ELECTRIC', data.period),
          unitPrice: pickRate(data.rates, 'ELECTRIC', room.number, data.period),
        },
        water: {
          previous: readingValue(data.readings, room.number, 'WATER', prev),
          current: readingValue(data.readings, room.number, 'WATER', data.period),
          unitPrice: pickRate(data.rates, 'WATER', room.number, data.period),
        },
      });
    });

  const totals = rows.reduce<PeriodTotals>(
    (acc, row) => ({
      roomFee: acc.roomFee + row.roomFee,
      trashFee: acc.trashFee + row.trashFee,
      electricFee: acc.electricFee + row.electric.amount,
      waterFee: acc.waterFee + row.water.amount,
      lossFee: acc.lossFee + row.lossFee,
      total: acc.total + row.total,
    }),
    { roomFee: 0, trashFee: 0, electricFee: 0, waterFee: 0, lossFee: 0, total: 0 },
  );

  return { period: data.period, rows, totals };
}

/** Nạp dữ liệu từ DB cho một kỳ rồi dựng bảng TỔNG QUAN. */
export async function loadPeriodSummary(period: Period): Promise<PeriodSummary> {
  const prev = previousPeriod(period);

  const [rooms, records, readings, rates] = await Promise.all([
    prisma.room.findMany({ select: { number: true, defaultTenantName: true } }),
    prisma.monthlyRecord.findMany({
      where: { year: period.year, month: period.month },
      select: {
        roomNumber: true,
        tenantName: true,
        occupied: true,
        locked: true,
        snapshotJson: true,
      },
    }),
    prisma.meterReading.findMany({
      where: {
        OR: [
          { year: period.year, month: period.month },
          { year: prev.year, month: prev.month },
        ],
      },
      select: { roomNumber: true, meterType: true, year: true, month: true, value: true },
    }),
    prisma.rate.findMany({
      select: {
        feeType: true,
        roomNumber: true,
        effectiveYear: true,
        effectiveMonth: true,
        unitPrice: true,
      },
    }),
  ]);

  return buildPeriodSummary({
    period,
    rooms,
    records,
    readings: readings as PeriodData['readings'],
    rates: rates as RateRow[],
  });
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npm test -- billing`
Expected: PASS — 6 test.

- [ ] **Step 6: Commit**

```bash
git add src/server/db.ts src/server/billing.ts src/server/billing.test.ts
git commit -m "feat: dựng bảng tổng quan của một kỳ từ dữ liệu DB"
```

---

### Task 6: Bảng phụ pivot 12 tháng theo phòng

**Files:**
- Create: `src/server/breakdown.ts`
- Test: `src/server/breakdown.test.ts`

**Interfaces:**
- Consumes: `buildPeriodSummary`, `PeriodData` (Task 5); `MONTHS`, `Period` (Task 1); `RateRow` (Task 2)
- Produces:
  - `interface MonthlyLine { months: (number | null)[]; total: number }` — `months` có đúng 12 phần tử, chỉ số 0 là tháng 1; `null` nghĩa là chưa có dữ liệu
  - `interface RoomYearBreakdown { roomNumber: number; year: number; room: MonthlyLine; trash: MonthlyLine; electric: MonthlyLine; electricUnitPrice: MonthlyLine; water: MonthlyLine; waterUnitPrice: MonthlyLine; grandTotal: MonthlyLine }`
  - `function buildRoomYearBreakdown(roomNumber: number, year: number, summaries: PeriodSummary[]): RoomYearBreakdown`
  - `async function loadRoomYearBreakdown(roomNumber: number, year: number): Promise<RoomYearBreakdown>`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/breakdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRoomYearBreakdown } from './breakdown';
import type { PeriodSummary } from './billing';
import type { RoomBill } from '@/lib/billing/calculate';

function bill(overrides: Partial<RoomBill> = {}): RoomBill {
  return {
    roomNumber: 1,
    tenantName: 'Huyền',
    occupied: true,
    roomFee: 800000,
    trashFee: 20000,
    electric: { previous: 18708, current: 18852, usage: 144, unitPrice: 3500, amount: 504000 },
    water: { previous: 1495, current: 1500, usage: 5, unitPrice: 7000, amount: 35000 },
    lossFee: 53900,
    total: 1413000,
    issues: [],
    ...overrides,
  };
}

function summary(month: number, row: RoomBill): PeriodSummary {
  return {
    period: { year: 2026, month },
    rows: [row],
    totals: {
      roomFee: row.roomFee,
      trashFee: row.trashFee,
      electricFee: row.electric.amount,
      waterFee: row.water.amount,
      lossFee: row.lossFee,
      total: row.total,
    },
  };
}

describe('buildRoomYearBreakdown', () => {
  it('đặt số liệu đúng vị trí tháng và để null cho tháng thiếu', () => {
    const result = buildRoomYearBreakdown(1, 2026, [summary(8, bill())]);

    expect(result.room.months[7]).toBe(800000);
    expect(result.room.months[0]).toBeNull();
    expect(result.room.months).toHaveLength(12);
  });

  it('cộng tổng năm bỏ qua tháng thiếu', () => {
    const result = buildRoomYearBreakdown(1, 2026, [summary(7, bill()), summary(8, bill())]);

    expect(result.room.total).toBe(1600000);
    expect(result.electric.total).toBe(1008000);
    expect(result.grandTotal.total).toBe(2826000);
  });

  it('ghi lại đơn giá điện và nước của từng tháng', () => {
    const result = buildRoomYearBreakdown(1, 2026, [summary(8, bill())]);

    expect(result.electricUnitPrice.months[7]).toBe(3500);
    expect(result.waterUnitPrice.months[7]).toBe(7000);
  });

  it('bỏ qua các dòng của phòng khác', () => {
    const other = summary(8, bill({ roomNumber: 2 }));
    const result = buildRoomYearBreakdown(1, 2026, [other]);

    expect(result.room.months[7]).toBeNull();
    expect(result.room.total).toBe(0);
  });

  it('tháng phòng trống ghi 0 chứ không phải null', () => {
    const vacant = bill({
      occupied: false,
      roomFee: 0,
      trashFee: 0,
      electric: { previous: null, current: null, usage: null, unitPrice: null, amount: 0 },
      water: { previous: null, current: null, usage: null, unitPrice: null, amount: 0 },
      lossFee: 0,
      total: 0,
    });
    const result = buildRoomYearBreakdown(1, 2026, [summary(8, vacant)]);

    expect(result.room.months[7]).toBe(0);
    expect(result.grandTotal.months[7]).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- breakdown`
Expected: FAIL — `Failed to resolve import "./breakdown"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/server/breakdown.ts`:

```ts
import { MONTHS } from '@/lib/period';
import { loadPeriodSummary, type PeriodSummary } from './billing';

export interface MonthlyLine {
  /** 12 phần tử, chỉ số 0 là tháng 1. null = chưa có dữ liệu tháng đó. */
  months: (number | null)[];
  total: number;
}

export interface RoomYearBreakdown {
  roomNumber: number;
  year: number;
  room: MonthlyLine;
  trash: MonthlyLine;
  electric: MonthlyLine;
  electricUnitPrice: MonthlyLine;
  water: MonthlyLine;
  waterUnitPrice: MonthlyLine;
  grandTotal: MonthlyLine;
}

function emptyLine(): MonthlyLine {
  return { months: Array.from({ length: 12 }, () => null), total: 0 };
}

function put(line: MonthlyLine, month: number, value: number | null, countInTotal: boolean) {
  line.months[month - 1] = value;
  if (countInTotal && value !== null) line.total += value;
}

export function buildRoomYearBreakdown(
  roomNumber: number,
  year: number,
  summaries: PeriodSummary[],
): RoomYearBreakdown {
  const result: RoomYearBreakdown = {
    roomNumber,
    year,
    room: emptyLine(),
    trash: emptyLine(),
    electric: emptyLine(),
    electricUnitPrice: emptyLine(),
    water: emptyLine(),
    waterUnitPrice: emptyLine(),
    grandTotal: emptyLine(),
  };

  for (const month of MONTHS) {
    const summary = summaries.find(
      (s) => s.period.year === year && s.period.month === month,
    );
    if (!summary) continue;

    const row = summary.rows.find((r) => r.roomNumber === roomNumber);
    if (!row) continue;

    put(result.room, month, row.roomFee, true);
    put(result.trash, month, row.trashFee, true);
    put(result.electric, month, row.electric.amount, true);
    put(result.water, month, row.water.amount, true);
    put(result.grandTotal, month, row.total, true);
    // Đơn giá không phải tiền tích luỹ nên không cộng vào tổng năm.
    put(result.electricUnitPrice, month, row.electric.unitPrice, false);
    put(result.waterUnitPrice, month, row.water.unitPrice, false);
  }

  return result;
}

export async function loadRoomYearBreakdown(
  roomNumber: number,
  year: number,
): Promise<RoomYearBreakdown> {
  const summaries = await Promise.all(
    MONTHS.map((month) => loadPeriodSummary({ year, month })),
  );
  return buildRoomYearBreakdown(roomNumber, year, summaries);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- breakdown`
Expected: PASS — 5 test.

- [ ] **Step 5: Commit**

```bash
git add src/server/breakdown.ts src/server/breakdown.test.ts
git commit -m "feat: bảng phụ pivot 12 tháng cho từng phòng"
```

---

### Task 7: Phiên đăng nhập không mật khẩu

**Files:**
- Create: `src/server/session.ts`
- Create: `src/server/admin-pin.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/server/actions/auth.ts`
- Test: `src/server/session.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 5)
- Produces:
  - `type Session = { role: 'tenant'; roomNumber: number } | { role: 'admin' }`
  - `function encodeSession(session: Session, secret: string): string`
  - `function decodeSession(token: string, secret: string): Session | null`
  - `async function getSession(): Promise<Session | null>` — đọc cookie `phuc_session`
  - `async function requireAdmin(): Promise<void>` — `redirect('/login')` nếu không phải admin
  - `async function requireRoom(roomNumber: number): Promise<void>` — admin đi qua được mọi phòng; khách thuê chỉ vào phòng của mình
  - `const ADMIN_PIN_KEY = 'ADMIN_PIN'`, `const DEFAULT_ADMIN_PIN = '000000'`
  - `async function readAdminPin(): Promise<string>`
  - `async function writeAdminPin(pin: string): Promise<void>`
  - Server Actions: `loginAsTenant(formData: FormData)`, `loginAsAdmin(formData: FormData)`, `logout()`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeSession, decodeSession, type Session } from './session';

const SECRET = 'test-secret';

describe('encodeSession / decodeSession', () => {
  it('đi vòng tròn giữ nguyên phiên khách thuê', () => {
    const session: Session = { role: 'tenant', roomNumber: 7 };
    expect(decodeSession(encodeSession(session, SECRET), SECRET)).toEqual(session);
  });

  it('đi vòng tròn giữ nguyên phiên admin', () => {
    const session: Session = { role: 'admin' };
    expect(decodeSession(encodeSession(session, SECRET), SECRET)).toEqual(session);
  });

  it('từ chối token bị sửa nội dung', () => {
    const token = encodeSession({ role: 'tenant', roomNumber: 7 }, SECRET);
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ role: 'admin' })).toString('base64url')}.${signature}`;

    expect(decodeSession(forged, SECRET)).toBeNull();
  });

  it('từ chối token ký bằng secret khác', () => {
    const token = encodeSession({ role: 'admin' }, 'secret-khac');
    expect(decodeSession(token, SECRET)).toBeNull();
  });

  it('từ chối chuỗi rác', () => {
    expect(decodeSession('khong-phai-token', SECRET)).toBeNull();
    expect(decodeSession('', SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- session`
Expected: FAIL — `Failed to resolve import "./session"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/server/session.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'phuc_session';

export type Session = { role: 'tenant'; roomNumber: number } | { role: 'admin' };

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function encodeSession(session: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(token: string, secret: string): Session | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    if (parsed.role === 'admin') return { role: 'admin' };
    if (parsed.role === 'tenant' && Number.isInteger(parsed.roomNumber)) {
      return { role: 'tenant', roomNumber: parsed.roomNumber };
    }
    return null;
  } catch {
    return null;
  }
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('Thiếu biến môi trường SESSION_SECRET');
  return value;
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? decodeSession(token, secret()) : null;
}

export async function setSession(session: Session): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, encodeSession(session, secret()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (session?.role !== 'admin') redirect('/login');
}

export async function requireRoom(roomNumber: number): Promise<void> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'admin') return;
  if (session.roomNumber !== roomNumber) redirect(`/phong/${session.roomNumber}`);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- session`
Expected: PASS — 5 test.

- [ ] **Step 5: Viết module đọc PIN quản lý**

Tạo `src/server/admin-pin.ts`:

```ts
import { prisma } from './db';

export const ADMIN_PIN_KEY = 'ADMIN_PIN';
export const DEFAULT_ADMIN_PIN = '000000';

/**
 * Đọc PIN quản lý từ DB. Nếu chưa có bản ghi (DB chưa seed) thì tạo bản ghi
 * mặc định 000000 để chủ trọ luôn vào được trang quản lý.
 */
export async function readAdminPin(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: ADMIN_PIN_KEY } });
  if (setting) return setting.value;

  await prisma.setting.create({ data: { key: ADMIN_PIN_KEY, value: DEFAULT_ADMIN_PIN } });
  return DEFAULT_ADMIN_PIN;
}

export async function writeAdminPin(pin: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: ADMIN_PIN_KEY },
    update: { value: pin },
    create: { key: ADMIN_PIN_KEY, value: pin },
  });
}
```

- [ ] **Step 6: Viết Server Actions đăng nhập**

Tạo `src/server/actions/auth.ts`:

```ts
'use server';

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { readAdminPin } from '../admin-pin';
import { clearSession, setSession } from '../session';

const roomSchema = z.coerce.number().int().min(1).max(32);

export async function loginAsTenant(formData: FormData) {
  const parsed = roomSchema.safeParse(formData.get('roomNumber'));
  if (!parsed.success) redirect('/login?loi=phong-khong-hop-le');

  await setSession({ role: 'tenant', roomNumber: parsed.data });
  redirect(`/phong/${parsed.data}`);
}

export async function loginAsAdmin(formData: FormData) {
  const pin = String(formData.get('pin') ?? '');
  const stored = await readAdminPin();

  // So sánh theo thời gian hằng định để không lộ thông tin qua thời gian phản hồi.
  const a = Buffer.from(pin);
  const b = Buffer.from(stored);
  const match = a.length === b.length && timingSafeEqual(a, b);

  if (!match) redirect('/login?loi=sai-pin');

  await setSession({ role: 'admin' });
  redirect('/admin');
}

export async function logout() {
  await clearSession();
  redirect('/login');
}
```

- [ ] **Step 7: Viết trang đăng nhập**

Tạo `src/app/login/page.tsx`:

```tsx
import { loginAsAdmin, loginAsTenant } from '@/server/actions/auth';

const ROOMS = Array.from({ length: 32 }, (_, i) => i + 1);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { loi } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 p-6">
      <h1 className="text-center text-2xl font-bold">Nhà trọ Vạn Phúc</h1>

      {loi === 'sai-pin' && (
        <p className="rounded bg-red-100 p-3 text-red-800">Mã PIN không đúng.</p>
      )}
      {loi === 'phong-khong-hop-le' && (
        <p className="rounded bg-red-100 p-3 text-red-800">Số phòng không hợp lệ.</p>
      )}

      <form action={loginAsTenant} className="flex flex-col gap-3">
        <label htmlFor="roomNumber" className="font-medium">
          Chọn số phòng của bạn
        </label>
        <select id="roomNumber" name="roomNumber" className="rounded border p-3 text-lg">
          {ROOMS.map((n) => (
            <option key={n} value={n}>
              Phòng {n}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-blue-600 p-3 font-medium text-white">
          Xem tiền phòng
        </button>
      </form>

      <form action={loginAsAdmin} className="flex flex-col gap-3 border-t pt-6">
        <label htmlFor="pin" className="font-medium">
          Quản lý — nhập mã PIN 6 số
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="off"
          className="rounded border p-3 tracking-widest"
        />
        <button type="submit" className="rounded bg-slate-800 p-3 font-medium text-white">
          Vào trang quản lý
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 8: Kiểm thử thủ công**

Run: `npm run dev`
Mở `http://localhost:3000/login`. Chọn phòng 7 rồi bấm "Xem tiền phòng" — URL phải chuyển sang `/phong/7` (trang 404 ở bước này là bình thường, Task 8 mới tạo trang đó). Nhập PIN mặc định `000000` — phải vào được `/admin` (trang 404 ở bước này là bình thường, Task 12 mới tạo trang đó). Nhập sai PIN — phải thấy chữ "Mã PIN không đúng."

- [ ] **Step 9: Commit**

```bash
git add src/server/session.ts src/server/session.test.ts src/server/admin-pin.ts src/server/actions/auth.ts src/app/login/page.tsx
git commit -m "feat: đăng nhập không mật khẩu theo số phòng và PIN quản lý lưu trong DB"
```

---

### Task 8: Dashboard khách thuê

**Files:**
- Create: `src/components/money-cell.tsx`
- Create: `src/components/room-summary-table.tsx`
- Create: `src/components/year-breakdown-table.tsx`
- Create: `src/app/phong/[roomNumber]/page.tsx`

**Interfaces:**
- Consumes: `loadPeriodSummary` (Task 5), `loadRoomYearBreakdown`, `MonthlyLine`, `RoomYearBreakdown` (Task 6), `requireRoom` (Task 7), `formatVnd` (Task 1), `RoomBill` (Task 4)
- Produces:
  - `function MoneyCell({ value }: { value: number | null }): JSX.Element`
  - `function RoomSummaryTable({ bill }: { bill: RoomBill }): JSX.Element`
  - `function YearBreakdownTable({ title, lines }: { title: string; lines: { label: string; line: MonthlyLine }[] }): JSX.Element`

- [ ] **Step 1: Viết component hiển thị tiền**

Tạo `src/components/money-cell.tsx`:

```tsx
import { formatVnd } from '@/lib/money';

export function MoneyCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return <span className="tabular-nums">{formatVnd(value)}</span>;
}
```

- [ ] **Step 2: Viết bảng TỔNG QUAN của một phòng**

Tạo `src/components/room-summary-table.tsx`:

```tsx
import type { RoomBill } from '@/lib/billing/calculate';
import { MoneyCell } from './money-cell';

export function RoomSummaryTable({ bill }: { bill: RoomBill }) {
  if (!bill.occupied) {
    return <p className="rounded bg-slate-100 p-4">Phòng này tháng đó không có người ở.</p>;
  }

  const lines: { label: string; value: number; hint?: string }[] = [
    { label: 'Tiền phòng', value: bill.roomFee },
    { label: 'Tiền rác', value: bill.trashFee },
    {
      label: 'Tiền điện',
      value: bill.electric.amount,
      hint:
        bill.electric.usage === null
          ? undefined
          : `${bill.electric.previous} → ${bill.electric.current} = ${bill.electric.usage} x ${bill.electric.unitPrice}`,
    },
    {
      label: 'Tiền nước',
      value: bill.water.amount,
      hint:
        bill.water.usage === null
          ? undefined
          : `${bill.water.previous} → ${bill.water.current} = ${bill.water.usage} x ${bill.water.unitPrice}`,
    },
    { label: 'Hao hụt 10%', value: bill.lossFee, hint: 'Tính trên tiền điện + tiền nước' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {bill.issues.length > 0 && (
        <ul className="rounded bg-amber-100 p-3 text-amber-900">
          {bill.issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}

      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line) => (
            <tr key={line.label} className="border-b">
              <th scope="row" className="p-3 text-left font-normal">
                {line.label}
                {line.hint && <span className="block text-xs text-slate-500">{line.hint}</span>}
              </th>
              <td className="p-3 text-right">
                <MoneyCell value={line.value} />
              </td>
            </tr>
          ))}
          <tr className="bg-slate-100 text-lg font-bold">
            <th scope="row" className="p-3 text-left">
              Tổng cộng
            </th>
            <td className="p-3 text-right">
              <MoneyCell value={bill.total} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Viết bảng phụ 12 tháng**

Tạo `src/components/year-breakdown-table.tsx`:

```tsx
import { MONTHS } from '@/lib/period';
import type { MonthlyLine } from '@/server/breakdown';
import { MoneyCell } from './money-cell';

export function YearBreakdownTable({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; line: MonthlyLine }[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-2 text-left">Khoản</th>
              {MONTHS.map((m) => (
                <th key={m} className="p-2 text-right">
                  T{m}
                </th>
              ))}
              <th className="p-2 text-right">Cả năm</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ label, line }) => (
              <tr key={label} className="border-b">
                <th scope="row" className="p-2 text-left font-normal">
                  {label}
                </th>
                {line.months.map((value, index) => (
                  <td key={index} className="p-2 text-right">
                    <MoneyCell value={value} />
                  </td>
                ))}
                <td className="p-2 text-right font-semibold">
                  <MoneyCell value={line.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Viết trang dashboard khách thuê**

Tạo `src/app/phong/[roomNumber]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPeriod } from '@/lib/period';
import { loadPeriodSummary } from '@/server/billing';
import { loadRoomYearBreakdown } from '@/server/breakdown';
import { requireRoom } from '@/server/session';
import { RoomSummaryTable } from '@/components/room-summary-table';
import { YearBreakdownTable } from '@/components/year-breakdown-table';

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomNumber: string }>;
  searchParams: Promise<{ nam?: string; thang?: string }>;
}) {
  const { roomNumber: raw } = await params;
  const roomNumber = Number(raw);
  if (!Number.isInteger(roomNumber) || roomNumber < 1 || roomNumber > 32) notFound();

  await requireRoom(roomNumber);

  const { nam, thang } = await searchParams;
  const now = new Date();
  const year = Number(nam) || now.getFullYear();
  const month = Number(thang) || now.getMonth() + 1;

  const [summary, breakdown] = await Promise.all([
    loadPeriodSummary({ year, month }),
    loadRoomYearBreakdown(roomNumber, year),
  ]);

  const bill = summary.rows.find((r) => r.roomNumber === roomNumber);
  if (!bill) notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">
          Phòng {roomNumber} — {formatPeriod({ year, month })}
        </h1>
        <Link href={`/phong/${roomNumber}/nuoc`} className="text-blue-600 underline">
          Nhập chỉ số nước
        </Link>
      </header>

      <RoomSummaryTable bill={bill} />

      <h2 className="text-xl font-bold">Chi tiết cả năm {year}</h2>

      <YearBreakdownTable title="Tiền phòng" lines={[{ label: 'Thành tiền', line: breakdown.room }]} />
      <YearBreakdownTable title="Tiền rác" lines={[{ label: 'Thành tiền', line: breakdown.trash }]} />
      <YearBreakdownTable
        title="Tiền điện"
        lines={[
          { label: 'Thành tiền', line: breakdown.electric },
          { label: 'Đơn giá', line: breakdown.electricUnitPrice },
        ]}
      />
      <YearBreakdownTable
        title="Tiền nước"
        lines={[
          { label: 'Thành tiền', line: breakdown.water },
          { label: 'Đơn giá', line: breakdown.waterUnitPrice },
        ]}
      />
      <YearBreakdownTable
        title="Tổng cộng"
        lines={[{ label: 'Tổng', line: breakdown.grandTotal }]}
      />
    </main>
  );
}
```

- [ ] **Step 5: Kiểm thử thủ công**

Run: `npm run dev`
Đăng nhập phòng 1, mở `http://localhost:3000/phong/1?nam=2026&thang=8`.
Expected: thấy bảng tổng quan (lúc này chưa có chỉ số nên hiện cảnh báo "Thiếu chỉ số điện của kỳ trước") và 5 bảng phụ 12 tháng.
Thử vào `/phong/2` khi đang là phòng 1 — phải bị đẩy về `/phong/1`.

- [ ] **Step 6: Commit**

```bash
git add src/components src/app/phong
git commit -m "feat: dashboard tổng quan và bảng phụ cho khách thuê"
```

---

### Task 9: Khách thuê nhập chỉ số nước

**Files:**
- Create: `src/server/actions/readings.ts`
- Create: `src/lib/billing/validate-reading.ts`
- Create: `src/lib/billing/water-deadline.ts`
- Create: `src/app/phong/[roomNumber]/nuoc/page.tsx`
- Test: `src/lib/billing/validate-reading.test.ts`, `src/lib/billing/water-deadline.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 5), `getSession` (Task 7), `Period`, `previousPeriod`, `formatPeriod` (Task 1)
- Produces:
  - `interface ReadingCheck { ok: boolean; error: string | null }`
  - `function validateReading(previous: number | null, value: number, locked: boolean): ReadingCheck` — hàm thuần, đồng bộ
  - `function waterLockDate(period: Period): Date` — 00:00 ngày 10 của tháng kế tiếp
  - `function isWaterEntryOpen(period: Period, now: Date): boolean`
  - `function formatWaterDeadline(period: Period): string`
  - `async function submitWaterReading(formData: FormData): Promise<void>` — Server Action

> **Vì sao tách file:** một module có `'use server'` bắt buộc mọi export phải là hàm `async`. Để `validateReading` giữ được dạng đồng bộ và test dễ, nó nằm ở `src/lib/billing/validate-reading.ts`, còn Server Action import vào.

- [ ] **Step 1: Viết test thất bại cho hàm kiểm tra**

Tạo `src/lib/billing/validate-reading.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateReading } from './validate-reading';

describe('validateReading', () => {
  it('chấp nhận chỉ số lớn hơn kỳ trước', () => {
    expect(validateReading(1495, 1500, false)).toEqual({ ok: true, error: null });
  });

  it('chấp nhận chỉ số bằng kỳ trước', () => {
    expect(validateReading(1495, 1495, false)).toEqual({ ok: true, error: null });
  });

  it('chấp nhận khi chưa có chỉ số kỳ trước', () => {
    expect(validateReading(null, 1500, false)).toEqual({ ok: true, error: null });
  });

  it('từ chối chỉ số nhỏ hơn kỳ trước', () => {
    expect(validateReading(1495, 1400, false)).toEqual({
      ok: false,
      error: 'Chỉ số mới (1400) không được nhỏ hơn chỉ số kỳ trước (1495)',
    });
  });

  it('từ chối số âm', () => {
    expect(validateReading(null, -1, false)).toEqual({
      ok: false,
      error: 'Chỉ số phải là số nguyên không âm',
    });
  });

  it('từ chối khi kỳ đã khoá sổ', () => {
    expect(validateReading(1495, 1500, true)).toEqual({
      ok: false,
      error: 'Kỳ này đã khoá sổ, vui lòng báo quản lý',
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- validate-reading`
Expected: FAIL — `Failed to resolve import "./validate-reading"`.

- [ ] **Step 3: Viết hàm kiểm tra thuần**

Tạo `src/lib/billing/validate-reading.ts`:

```ts
export interface ReadingCheck {
  ok: boolean;
  error: string | null;
}

/** Kiểm tra một chỉ số đồng hồ trước khi ghi vào DB. */
export function validateReading(
  previous: number | null,
  value: number,
  locked: boolean,
): ReadingCheck {
  if (locked) {
    return { ok: false, error: 'Kỳ này đã khoá sổ, vui lòng báo quản lý' };
  }
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, error: 'Chỉ số phải là số nguyên không âm' };
  }
  if (previous !== null && value < previous) {
    return {
      ok: false,
      error: `Chỉ số mới (${value}) không được nhỏ hơn chỉ số kỳ trước (${previous})`,
    };
  }
  return { ok: true, error: null };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- validate-reading`
Expected: PASS — 6 test.

- [ ] **Step 5: Viết test thất bại cho hạn nhập nước**

Tạo `src/lib/billing/water-deadline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { waterLockDate, isWaterEntryOpen, formatWaterDeadline } from './water-deadline';

describe('waterLockDate', () => {
  it('kỳ 9/2026 khóa lúc 00:00 ngày 10/10/2026', () => {
    expect(waterLockDate({ year: 2026, month: 9 })).toEqual(new Date(2026, 9, 10, 0, 0, 0, 0));
  });

  it('kỳ tháng 12 khóa vào tháng 1 năm sau', () => {
    expect(waterLockDate({ year: 2026, month: 12 })).toEqual(new Date(2027, 0, 10, 0, 0, 0, 0));
  });

  it('kỳ tháng 1 khóa ngày 10/2 cùng năm', () => {
    expect(waterLockDate({ year: 2026, month: 1 })).toEqual(new Date(2026, 1, 10, 0, 0, 0, 0));
  });
});

describe('isWaterEntryOpen', () => {
  it('còn mở trong chính tháng của kỳ', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 8, 25, 12, 0))).toBe(true);
  });

  it('còn mở hết ngày 9 của tháng kế tiếp', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 9, 9, 23, 59, 59))).toBe(true);
  });

  it('đã đóng đúng lúc 00:00 ngày 10 tháng kế tiếp', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 9, 10, 0, 0, 0))).toBe(false);
  });

  it('đã đóng sau ngày 10', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 9, 15, 8, 0))).toBe(false);
  });

  it('xử lý đúng ranh giới cuối năm', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 12 }, new Date(2027, 0, 9, 20, 0))).toBe(true);
    expect(isWaterEntryOpen({ year: 2026, month: 12 }, new Date(2027, 0, 10, 0, 0))).toBe(false);
  });
});

describe('formatWaterDeadline', () => {
  it('hiển thị hạn chót theo ngày người dùng hiểu được', () => {
    expect(formatWaterDeadline({ year: 2026, month: 9 })).toBe('hết ngày 09/10/2026');
  });

  it('hiển thị đúng khi hạn rơi sang năm sau', () => {
    expect(formatWaterDeadline({ year: 2026, month: 12 })).toBe('hết ngày 09/01/2027');
  });
});
```

- [ ] **Step 6: Chạy test để xác nhận thất bại**

Run: `npm test -- water-deadline`
Expected: FAIL — `Failed to resolve import "./water-deadline"`.

- [ ] **Step 7: Viết implementation hạn nhập nước**

Tạo `src/lib/billing/water-deadline.ts`:

```ts
import type { Period } from '@/lib/period';

/** Ngày 10 của tháng kế tiếp được coi là hạn khóa. */
export const WATER_LOCK_DAY = 10;

/**
 * Thời điểm khóa chỉ số nước của một kỳ: 00:00 ngày 10 của tháng kế tiếp.
 * Tháng trong Date đếm từ 0, nên chỉ số `period.month` chính là tháng kế tiếp,
 * và JS tự chuyển sang năm sau khi period.month = 12.
 */
export function waterLockDate(period: Period): Date {
  return new Date(period.year, period.month, WATER_LOCK_DAY, 0, 0, 0, 0);
}

/** Đúng thời điểm 00:00 ngày 10 đã tính là đóng. */
export function isWaterEntryOpen(period: Period, now: Date): boolean {
  return now.getTime() < waterLockDate(period).getTime();
}

/** Câu chữ hiển thị cho khách thuê: hạn chót là hết ngày 9 tháng kế tiếp. */
export function formatWaterDeadline(period: Period): string {
  const lock = waterLockDate(period);
  const lastDay = new Date(lock.getTime() - 24 * 60 * 60 * 1000);

  const dd = String(lastDay.getDate()).padStart(2, '0');
  const mm = String(lastDay.getMonth() + 1).padStart(2, '0');

  return `hết ngày ${dd}/${mm}/${lastDay.getFullYear()}`;
}
```

- [ ] **Step 8: Chạy test để xác nhận pass**

Run: `npm test -- water-deadline`
Expected: PASS — 10 test.

- [ ] **Step 9: Viết Server Action ghi chỉ số nước**

Tạo `src/server/actions/readings.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { previousPeriod, formatPeriod } from '@/lib/period';
import { validateReading } from '@/lib/billing/validate-reading';
import { isWaterEntryOpen } from '@/lib/billing/water-deadline';
import { prisma } from '../db';
import { getSession } from '../session';

const schema = z.object({
  roomNumber: z.coerce.number().int().min(1).max(32),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  value: z.coerce.number().int().min(0),
});

export async function submitWaterReading(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/login');

  const { roomNumber, year, month, value } = parsed.data;

  // Khách thuê chỉ được ghi cho phòng của chính mình.
  if (session.role === 'tenant' && session.roomNumber !== roomNumber) {
    redirect(`/phong/${session.roomNumber}`);
  }

  // Hạn nhập nước: khóa lúc 00:00 ngày 10 của tháng kế tiếp.
  // Admin vẫn sửa được sau hạn để còn chỉnh sai sót.
  if (session.role === 'tenant' && !isWaterEntryOpen({ year, month }, new Date())) {
    const message = `Đã quá hạn nhập chỉ số nước ${formatPeriod({ year, month })}. Vui lòng báo quản lý.`;
    redirect(`/phong/${roomNumber}/nuoc?loi=${encodeURIComponent(message)}`);
  }

  const prev = previousPeriod({ year, month });

  const [previousReading, record] = await Promise.all([
    prisma.meterReading.findUnique({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber,
          meterType: 'WATER',
          year: prev.year,
          month: prev.month,
        },
      },
    }),
    prisma.monthlyRecord.findUnique({
      where: { roomNumber_year_month: { roomNumber, year, month } },
    }),
  ]);

  const check = validateReading(previousReading?.value ?? null, value, record?.locked ?? false);

  if (!check.ok) {
    redirect(`/phong/${roomNumber}/nuoc?loi=${encodeURIComponent(check.error!)}`);
  }

  await prisma.meterReading.upsert({
    where: {
      roomNumber_meterType_year_month: { roomNumber, meterType: 'WATER', year, month },
    },
    update: { value, enteredBy: session.role === 'admin' ? 'ADMIN' : 'TENANT' },
    create: {
      roomNumber,
      meterType: 'WATER',
      year,
      month,
      value,
      enteredBy: session.role === 'admin' ? 'ADMIN' : 'TENANT',
    },
  });

  revalidatePath(`/phong/${roomNumber}`);
  redirect(`/phong/${roomNumber}?nam=${year}&thang=${month}`);
}
```

- [ ] **Step 10: Viết trang nhập chỉ số nước**

Tạo `src/app/phong/[roomNumber]/nuoc/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { previousPeriod, formatPeriod } from '@/lib/period';
import { formatWaterDeadline, isWaterEntryOpen } from '@/lib/billing/water-deadline';
import { prisma } from '@/server/db';
import { getSession, requireRoom } from '@/server/session';
import { submitWaterReading } from '@/server/actions/readings';

export default async function WaterPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomNumber: string }>;
  searchParams: Promise<{ loi?: string }>;
}) {
  const { roomNumber: raw } = await params;
  const roomNumber = Number(raw);
  if (!Number.isInteger(roomNumber) || roomNumber < 1 || roomNumber > 32) notFound();

  await requireRoom(roomNumber);
  const { loi } = await searchParams;
  const session = await getSession();

  const now = new Date();
  const period = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const prev = previousPeriod(period);

  const open = isWaterEntryOpen(period, now);
  // Admin vẫn sửa được sau hạn; chỉ khách thuê bị chặn.
  const canSubmit = open || session?.role === 'admin';

  const [previousReading, currentReading] = await Promise.all([
    prisma.meterReading.findUnique({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber,
          meterType: 'WATER',
          year: prev.year,
          month: prev.month,
        },
      },
    }),
    prisma.meterReading.findUnique({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber,
          meterType: 'WATER',
          year: period.year,
          month: period.month,
        },
      },
    }),
  ]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">
        Phòng {roomNumber} — chỉ số nước {formatPeriod(period)}
      </h1>

      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      <p className="rounded bg-slate-100 p-3">
        Chỉ số {formatPeriod(prev)}:{' '}
        <strong>{previousReading ? previousReading.value : 'chưa có'}</strong>
      </p>

      {open ? (
        <p className="rounded bg-blue-50 p-3 text-sm text-blue-900">
          Hạn nhập chỉ số nước {formatPeriod(period)}: <strong>{formatWaterDeadline(period)}</strong>.
          Quá hạn sẽ tự động khóa.
        </p>
      ) : (
        <p className="rounded bg-amber-100 p-3 text-sm text-amber-900">
          Đã quá hạn nhập chỉ số nước {formatPeriod(period)} ({formatWaterDeadline(period)}).
          {session?.role === 'admin'
            ? ' Bạn đang đăng nhập bằng quyền quản lý nên vẫn sửa được.'
            : ' Vui lòng báo quản lý nếu cần chỉnh sửa.'}
        </p>
      )}

      <form action={submitWaterReading} className="flex flex-col gap-3">
        <input type="hidden" name="roomNumber" value={roomNumber} />
        <input type="hidden" name="year" value={period.year} />
        <input type="hidden" name="month" value={period.month} />

        <label htmlFor="value" className="font-medium">
          Chỉ số đồng hồ nước hiện tại
        </label>
        <input
          id="value"
          name="value"
          type="number"
          min={0}
          step={1}
          required
          disabled={!canSubmit}
          defaultValue={currentReading?.value ?? ''}
          className="rounded border p-3 text-lg disabled:bg-slate-100 disabled:text-slate-400"
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-blue-600 p-3 font-medium text-white disabled:bg-slate-400"
        >
          {canSubmit ? 'Lưu chỉ số' : 'Đã khóa'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 11: Kiểm thử thủ công**

Run: `npm run dev`
Đăng nhập phòng 1, mở `/phong/1/nuoc`, nhập `1500`, bấm Lưu — phải quay về dashboard phòng 1.
Vào lại `/phong/1/nuoc` nhập số nhỏ hơn chỉ số kỳ trước — phải hiện thông báo đỏ.
Trang phải hiện dòng xanh "Hạn nhập chỉ số nước ... hết ngày DD/MM/YYYY".

Kiểm tra hạn khóa bằng cách giả lập ngày hệ thống (không cần đổi giờ máy):

```bash
# Kỳ hiện tại trên máy là tháng M; đặt ngày máy ảo sang ngày 10 tháng M+1 bằng biến môi trường
# của Node không khả dụng, nên kiểm tra bằng unit test đã viết ở Step 5 là đủ.
npm test -- water-deadline
```

Để kiểm tra giao diện khóa, tạm sửa `const now = new Date();` trong `nuoc/page.tsx` thành
`const now = new Date(2026, 9, 10);` và đặt kỳ cứng `{ year: 2026, month: 9 }`:
form phải bị vô hiệu hoá, nút hiện chữ "Đã khóa", có khung vàng báo quá hạn.
**Nhớ hoàn tác hai dòng tạm này trước khi commit.**

- [ ] **Step 12: Commit**

```bash
git add src/lib/billing/validate-reading.ts src/lib/billing/validate-reading.test.ts src/lib/billing/water-deadline.ts src/lib/billing/water-deadline.test.ts src/server/actions/readings.ts "src/app/phong/[roomNumber]/nuoc"
git commit -m "feat: khách thuê tự nhập chỉ số nước, kiểm tra hợp lệ và hạn khóa ngày 10"
```

---

### Task 10: Lưới nhập liệu theo tháng của quản lý

**Files:**
- Create: `src/server/actions/period.ts`
- Create: `src/lib/admin/parse-period-grid.ts`
- Create: `src/app/admin/ky/[year]/[month]/page.tsx`
- Create: `src/app/admin/layout.tsx`
- Test: `src/server/actions/period.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 5), `loadPeriodSummary` (Task 5), `requireAdmin` (Task 7), `formatPeriod` (Task 1)
- Produces:
  - `interface PeriodRowInput { roomNumber: number; tenantName: string; occupied: boolean; electricReading: number | null }`
  - `function parsePeriodGrid(formData: FormData): PeriodRowInput[]` — hàm thuần, đọc các field dạng `tenantName_<n>`, `occupied_<n>`, `electric_<n>`
  - `async function savePeriodGrid(formData: FormData): Promise<void>` — Server Action

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/actions/period.test.ts`:

```ts
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
      form({ tenantName_1: 'Huyền', occupied_1: 'on', electric_1: '18852' }),
    );

    expect(rows).toEqual([
      { roomNumber: 1, tenantName: 'Huyền', occupied: true, electricReading: 18852 },
    ]);
  });

  it('thiếu checkbox occupied nghĩa là phòng trống', () => {
    const rows = parsePeriodGrid(form({ tenantName_26: '', electric_26: '' }));

    expect(rows).toEqual([
      { roomNumber: 26, tenantName: '', occupied: false, electricReading: null },
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
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- period`
Expected: FAIL — `Failed to resolve import "@/lib/admin/parse-period-grid"`.

- [ ] **Step 3: Viết hàm thuần đọc form**

Tạo `src/lib/admin/parse-period-grid.ts`:

```ts
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
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- period`
Expected: PASS — 6 test.

- [ ] **Step 5: Viết Server Action lưu lưới**

Tạo `src/server/actions/period.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { parsePeriodGrid } from '@/lib/admin/parse-period-grid';
import { prisma } from '../db';
import { requireAdmin } from '../session';

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function savePeriodGrid(formData: FormData) {
  await requireAdmin();

  const parsed = periodSchema.safeParse({
    year: formData.get('year'),
    month: formData.get('month'),
  });
  if (!parsed.success) redirect('/admin');

  const { year, month } = parsed.data;
  const rows = parsePeriodGrid(formData);

  for (const row of rows) {
    await prisma.monthlyRecord.upsert({
      where: { roomNumber_year_month: { roomNumber: row.roomNumber, year, month } },
      update: { tenantName: row.tenantName, occupied: row.occupied },
      create: {
        roomNumber: row.roomNumber,
        year,
        month,
        tenantName: row.tenantName,
        occupied: row.occupied,
      },
    });

    if (row.electricReading === null) {
      await prisma.meterReading.deleteMany({
        where: { roomNumber: row.roomNumber, meterType: 'ELECTRIC', year, month },
      });
      continue;
    }

    await prisma.meterReading.upsert({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber: row.roomNumber,
          meterType: 'ELECTRIC',
          year,
          month,
        },
      },
      update: { value: row.electricReading, enteredBy: 'ADMIN' },
      create: {
        roomNumber: row.roomNumber,
        meterType: 'ELECTRIC',
        year,
        month,
        value: row.electricReading,
        enteredBy: 'ADMIN',
      },
    });
  }

  revalidatePath(`/admin/ky/${year}/${month}`);
  redirect(`/admin/ky/${year}/${month}?luu=xong`);
}
```

- [ ] **Step 6: Viết layout quản lý**

Tạo `src/app/admin/layout.tsx`:

```tsx
import Link from 'next/link';
import { requireAdmin } from '@/server/session';
import { logout } from '@/server/actions/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen">
      <nav className="flex flex-wrap items-center gap-4 border-b bg-slate-800 p-4 text-white">
        <Link href="/admin" className="font-bold">
          Quản lý
        </Link>
        <Link href="/admin/don-gia">Đơn giá</Link>
        <form action={logout} className="ml-auto">
          <button type="submit" className="underline">
            Thoát
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Viết trang lưới nhập liệu**

Tạo `src/app/admin/ky/[year]/[month]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { formatPeriod, previousPeriod } from '@/lib/period';
import { formatVnd } from '@/lib/money';
import { prisma } from '@/server/db';
import { loadPeriodSummary } from '@/server/billing';
import { savePeriodGrid } from '@/server/actions/period';

export default async function PeriodGridPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ luu?: string }>;
}) {
  const { year: rawYear, month: rawMonth } = await params;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const { luu } = await searchParams;
  const prev = previousPeriod({ year, month });

  const [summary, electricReadings] = await Promise.all([
    loadPeriodSummary({ year, month }),
    prisma.meterReading.findMany({
      where: {
        meterType: 'ELECTRIC',
        OR: [
          { year, month },
          { year: prev.year, month: prev.month },
        ],
      },
    }),
  ]);

  function reading(roomNumber: number, y: number, m: number): number | null {
    const hit = electricReadings.find(
      (r) => r.roomNumber === roomNumber && r.year === y && r.month === m,
    );
    return hit ? hit.value : null;
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Nhập liệu {formatPeriod({ year, month })}</h1>

      {luu === 'xong' && <p className="rounded bg-green-100 p-3 text-green-900">Đã lưu.</p>}

      <form action={savePeriodGrid} className="flex flex-col gap-4">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2">Phòng</th>
                <th className="p-2">Họ và tên</th>
                <th className="p-2">Có người ở</th>
                <th className="p-2">Điện kỳ trước</th>
                <th className="p-2">Điện kỳ này</th>
                <th className="p-2">Nước kỳ này</th>
                <th className="p-2 text-right">Tổng tạm tính</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.roomNumber} className="border-b">
                  <td className="p-2 text-center font-medium">{row.roomNumber}</td>
                  <td className="p-2">
                    <input
                      name={`tenantName_${row.roomNumber}`}
                      defaultValue={row.tenantName}
                      className="w-full rounded border p-1"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      name={`occupied_${row.roomNumber}`}
                      defaultChecked={row.occupied}
                    />
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-500">
                    {reading(row.roomNumber, prev.year, prev.month) ?? '—'}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      name={`electric_${row.roomNumber}`}
                      defaultValue={reading(row.roomNumber, year, month) ?? ''}
                      className="w-28 rounded border p-1 text-right"
                    />
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-500">
                    {row.water.current ?? 'khách chưa nhập'}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatVnd(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="submit"
          className="self-start rounded bg-blue-600 px-6 py-3 font-medium text-white"
        >
          Lưu toàn bộ
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 8: Kiểm thử thủ công**

Run: `npm run dev`
Đăng nhập bằng PIN, mở `/admin/ky/2026/8`. Nhập tên và chỉ số điện cho phòng 1 (ví dụ `18852`), bỏ tick "Có người ở" của phòng 26, bấm Lưu.
Expected: thấy "Đã lưu.", cột Tổng tạm tính của phòng 1 cập nhật, phòng 26 về 0.
Sau đó mở `/admin/ky/2026/7` nhập chỉ số điện kỳ trước `18708` rồi quay lại tháng 8 — tiền điện phòng 1 phải ra `504.000`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/admin src/server/actions/period.ts src/server/actions/period.test.ts src/app/admin
git commit -m "feat: lưới nhập tên, trạng thái ở và chỉ số điện theo tháng"
```

---

### Task 11: Quản lý đơn giá theo mốc thời gian

**Files:**
- Create: `src/server/actions/rates.ts`
- Create: `src/lib/admin/rate-form-schema.ts`
- Create: `src/app/admin/don-gia/page.tsx`
- Modify: `src/lib/billing/rates.ts` (thêm `FEE_TYPE_LABELS` vào cuối file)
- Test: `src/server/actions/rates.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 5), `requireAdmin` (Task 7), `FeeTypeName` (Task 2)
- Produces:
  - `const FEE_TYPE_LABELS: Record<FeeTypeName, string>` (từ `src/lib/billing/rates.ts`, bổ sung vào file đó)
  - `const rateFormSchema: z.ZodType<{ feeType: FeeTypeName; roomNumber: number | null; effectiveYear: number; effectiveMonth: number; unitPrice: number }>`
  - `async function createRate(formData: FormData): Promise<void>`
  - `async function deleteRate(formData: FormData): Promise<void>`

- [ ] **Step 1: Viết test thất bại cho schema**

Tạo `src/server/actions/rates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rateFormSchema } from '@/lib/admin/rate-form-schema';

describe('rateFormSchema', () => {
  it('chấp nhận đơn giá chung khi để trống số phòng', () => {
    const result = rateFormSchema.parse({
      feeType: 'ROOM',
      roomNumber: '',
      effectiveYear: '2026',
      effectiveMonth: '1',
      unitPrice: '800000',
    });

    expect(result).toEqual({
      feeType: 'ROOM',
      roomNumber: null,
      effectiveYear: 2026,
      effectiveMonth: 1,
      unitPrice: 800000,
    });
  });

  it('chấp nhận đơn giá riêng cho một phòng', () => {
    const result = rateFormSchema.parse({
      feeType: 'ROOM',
      roomNumber: '24',
      effectiveYear: '2025',
      effectiveMonth: '6',
      unitPrice: '300000',
    });

    expect(result.roomNumber).toBe(24);
  });

  it('từ chối loại phí không hợp lệ', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'INTERNET',
        roomNumber: '',
        effectiveYear: '2026',
        effectiveMonth: '1',
        unitPrice: '100',
      }),
    ).toThrow();
  });

  it('từ chối tháng ngoài khoảng 1..12', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'WATER',
        roomNumber: '',
        effectiveYear: '2026',
        effectiveMonth: '13',
        unitPrice: '7000',
      }),
    ).toThrow();
  });

  it('từ chối đơn giá âm', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'WATER',
        roomNumber: '',
        effectiveYear: '2026',
        effectiveMonth: '1',
        unitPrice: '-1',
      }),
    ).toThrow();
  });

  it('từ chối số phòng ngoài khoảng 1..32', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'ROOM',
        roomNumber: '33',
        effectiveYear: '2026',
        effectiveMonth: '1',
        unitPrice: '800000',
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- rates`
Expected: FAIL — `Failed to resolve import "@/lib/admin/rate-form-schema"`.

- [ ] **Step 3: Viết schema và nhãn tiếng Việt**

Tạo `src/lib/admin/rate-form-schema.ts`:

```ts
import { z } from 'zod';

export const rateFormSchema = z.object({
  feeType: z.enum(['ROOM', 'TRASH', 'ELECTRIC', 'WATER']),
  roomNumber: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(32)])
    .transform((value) => (value === '' ? null : value)),
  effectiveYear: z.coerce.number().int().min(2000).max(2100),
  effectiveMonth: z.coerce.number().int().min(1).max(12),
  unitPrice: z.coerce.number().int().min(0),
});

export type RateFormInput = z.infer<typeof rateFormSchema>;
```

Thêm vào cuối `src/lib/billing/rates.ts`:

```ts
export const FEE_TYPE_LABELS: Record<FeeTypeName, string> = {
  ROOM: 'Tiền phòng',
  TRASH: 'Tiền rác',
  ELECTRIC: 'Đơn giá điện',
  WATER: 'Đơn giá nước',
};
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- rates`
Expected: PASS — các test của Task 2 và 6 test mới.

- [ ] **Step 5: Viết Server Actions**

Tạo `src/server/actions/rates.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { rateFormSchema } from '@/lib/admin/rate-form-schema';
import { prisma } from '../db';
import { requireAdmin } from '../session';

export async function createRate(formData: FormData) {
  await requireAdmin();

  const parsed = rateFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect('/admin/don-gia?loi=' + encodeURIComponent('Dữ liệu đơn giá không hợp lệ'));
  }

  const { feeType, roomNumber, effectiveYear, effectiveMonth, unitPrice } = parsed.data;

  const existing = await prisma.rate.findFirst({
    where: { feeType, roomNumber, effectiveYear, effectiveMonth },
  });

  if (existing) {
    await prisma.rate.update({ where: { id: existing.id }, data: { unitPrice } });
  } else {
    await prisma.rate.create({
      data: { feeType, roomNumber, effectiveYear, effectiveMonth, unitPrice },
    });
  }

  revalidatePath('/admin/don-gia');
  redirect('/admin/don-gia?luu=xong');
}

export async function deleteRate(formData: FormData) {
  await requireAdmin();

  const id = z.coerce.number().int().safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/don-gia');

  await prisma.rate.delete({ where: { id: id.data } });

  revalidatePath('/admin/don-gia');
  redirect('/admin/don-gia?luu=xong');
}
```

- [ ] **Step 6: Viết trang quản lý đơn giá**

Tạo `src/app/admin/don-gia/page.tsx`:

```tsx
import { FEE_TYPE_LABELS, type FeeTypeName } from '@/lib/billing/rates';
import { formatVnd } from '@/lib/money';
import { prisma } from '@/server/db';
import { createRate, deleteRate } from '@/server/actions/rates';

const FEE_TYPES: FeeTypeName[] = ['ROOM', 'TRASH', 'ELECTRIC', 'WATER'];

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ luu?: string; loi?: string }>;
}) {
  const { luu, loi } = await searchParams;

  const rates = await prisma.rate.findMany({
    orderBy: [{ feeType: 'asc' }, { effectiveYear: 'desc' }, { effectiveMonth: 'desc' }],
  });

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Đơn giá theo mốc thời gian</h1>

      {luu === 'xong' && <p className="rounded bg-green-100 p-3 text-green-900">Đã lưu.</p>}
      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      <form action={createRate} className="flex flex-wrap items-end gap-3 rounded border p-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Loại phí</span>
          <select name="feeType" className="rounded border p-2">
            {FEE_TYPES.map((t) => (
              <option key={t} value={t}>
                {FEE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Phòng (để trống = áp dụng chung)</span>
          <input name="roomNumber" type="number" min={1} max={32} className="w-40 rounded border p-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Áp dụng từ năm</span>
          <input name="effectiveYear" type="number" defaultValue={2026} className="w-28 rounded border p-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Tháng</span>
          <input name="effectiveMonth" type="number" min={1} max={12} defaultValue={1} className="w-20 rounded border p-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Đơn giá (VND)</span>
          <input name="unitPrice" type="number" min={0} required className="w-40 rounded border p-2" />
        </label>

        <button type="submit" className="rounded bg-blue-600 px-5 py-2 font-medium text-white">
          Thêm / cập nhật
        </button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">Loại phí</th>
            <th className="p-2 text-left">Phạm vi</th>
            <th className="p-2 text-left">Áp dụng từ</th>
            <th className="p-2 text-right">Đơn giá</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id} className="border-b">
              <td className="p-2">{FEE_TYPE_LABELS[rate.feeType as FeeTypeName]}</td>
              <td className="p-2">{rate.roomNumber ? `Phòng ${rate.roomNumber}` : 'Tất cả phòng'}</td>
              <td className="p-2">
                {rate.effectiveMonth}/{rate.effectiveYear}
              </td>
              <td className="p-2 text-right tabular-nums">{formatVnd(rate.unitPrice)}</td>
              <td className="p-2 text-right">
                <form action={deleteRate}>
                  <input type="hidden" name="id" value={rate.id} />
                  <button type="submit" className="text-red-600 underline">
                    Xoá
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 7: Kiểm thử thủ công**

Run: `npm run dev`
Mở `/admin/don-gia`. Thêm "Tiền phòng, phòng 24, từ 6/2025, 300000".
Expected: bảng hiện dòng mới. Mở `/admin/ky/2026/8` — tiền phòng của phòng 24 phải là `300.000`, các phòng khác vẫn `800.000`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin/rate-form-schema.ts src/lib/billing/rates.ts src/server/actions/rates.ts src/server/actions/rates.test.ts src/app/admin/don-gia
git commit -m "feat: quản lý đơn giá theo mốc thời gian và theo phòng"
```

---

### Task 12: Dashboard tổng quát và khoá sổ

**Files:**
- Create: `src/server/dashboard.ts`
- Create: `src/server/actions/lock.ts`
- Create: `src/app/admin/page.tsx`
- Test: `src/server/dashboard.test.ts`

**Interfaces:**
- Consumes: `loadPeriodSummary`, `PeriodSummary`, `PeriodTotals` (Task 5), `MONTHS` (Task 1), `prisma`, `requireAdmin`
- Produces:
  - `interface YearDashboard { year: number; monthlyTotals: PeriodTotals[]; yearTotals: PeriodTotals; occupiedCountByMonth: number[] }`
  - `function buildYearDashboard(year: number, summaries: PeriodSummary[]): YearDashboard`
  - `async function loadYearDashboard(year: number): Promise<YearDashboard>`
  - `async function lockPeriod(formData: FormData): Promise<void>`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/dashboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildYearDashboard } from './dashboard';
import type { PeriodSummary } from './billing';
import type { RoomBill } from '@/lib/billing/calculate';

function bill(roomNumber: number, occupied: boolean, total: number): RoomBill {
  return {
    roomNumber,
    tenantName: '',
    occupied,
    roomFee: occupied ? 800000 : 0,
    trashFee: occupied ? 20000 : 0,
    electric: { previous: null, current: null, usage: null, unitPrice: 3500, amount: 0 },
    water: { previous: null, current: null, usage: null, unitPrice: 7000, amount: 0 },
    lossFee: 0,
    total,
    issues: [],
  };
}

function summary(month: number, rows: RoomBill[]): PeriodSummary {
  return {
    period: { year: 2026, month },
    rows,
    totals: {
      roomFee: rows.reduce((s, r) => s + r.roomFee, 0),
      trashFee: rows.reduce((s, r) => s + r.trashFee, 0),
      electricFee: 0,
      waterFee: 0,
      lossFee: 0,
      total: rows.reduce((s, r) => s + r.total, 0),
    },
  };
}

describe('buildYearDashboard', () => {
  it('trả về đúng 12 phần tử cho các tháng', () => {
    const dashboard = buildYearDashboard(2026, []);
    expect(dashboard.monthlyTotals).toHaveLength(12);
    expect(dashboard.occupiedCountByMonth).toHaveLength(12);
  });

  it('tháng chưa có dữ liệu thì mọi khoản bằng 0', () => {
    const dashboard = buildYearDashboard(2026, []);
    expect(dashboard.monthlyTotals[0].total).toBe(0);
    expect(dashboard.occupiedCountByMonth[0]).toBe(0);
  });

  it('đếm số phòng có người ở của từng tháng', () => {
    const dashboard = buildYearDashboard(2026, [
      summary(8, [bill(1, true, 820000), bill(26, false, 0)]),
    ]);

    expect(dashboard.occupiedCountByMonth[7]).toBe(1);
  });

  it('cộng tổng cả năm từ các tháng có dữ liệu', () => {
    const dashboard = buildYearDashboard(2026, [
      summary(7, [bill(1, true, 820000)]),
      summary(8, [bill(1, true, 820000)]),
    ]);

    expect(dashboard.yearTotals.total).toBe(1640000);
    expect(dashboard.yearTotals.roomFee).toBe(1600000);
  });

  it('bỏ qua kỳ thuộc năm khác', () => {
    const other: PeriodSummary = {
      ...summary(8, [bill(1, true, 820000)]),
      period: { year: 2025, month: 8 },
    };

    const dashboard = buildYearDashboard(2026, [other]);
    expect(dashboard.yearTotals.total).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- dashboard`
Expected: FAIL — `Failed to resolve import "./dashboard"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/server/dashboard.ts`:

```ts
import { MONTHS } from '@/lib/period';
import { loadPeriodSummary, type PeriodSummary, type PeriodTotals } from './billing';

export interface YearDashboard {
  year: number;
  /** 12 phần tử, chỉ số 0 là tháng 1. */
  monthlyTotals: PeriodTotals[];
  yearTotals: PeriodTotals;
  occupiedCountByMonth: number[];
}

function zeroTotals(): PeriodTotals {
  return { roomFee: 0, trashFee: 0, electricFee: 0, waterFee: 0, lossFee: 0, total: 0 };
}

function addTotals(a: PeriodTotals, b: PeriodTotals): PeriodTotals {
  return {
    roomFee: a.roomFee + b.roomFee,
    trashFee: a.trashFee + b.trashFee,
    electricFee: a.electricFee + b.electricFee,
    waterFee: a.waterFee + b.waterFee,
    lossFee: a.lossFee + b.lossFee,
    total: a.total + b.total,
  };
}

export function buildYearDashboard(year: number, summaries: PeriodSummary[]): YearDashboard {
  const monthlyTotals: PeriodTotals[] = [];
  const occupiedCountByMonth: number[] = [];
  let yearTotals = zeroTotals();

  for (const month of MONTHS) {
    const summary = summaries.find((s) => s.period.year === year && s.period.month === month);

    if (!summary) {
      monthlyTotals.push(zeroTotals());
      occupiedCountByMonth.push(0);
      continue;
    }

    monthlyTotals.push(summary.totals);
    occupiedCountByMonth.push(summary.rows.filter((r) => r.occupied).length);
    yearTotals = addTotals(yearTotals, summary.totals);
  }

  return { year, monthlyTotals, yearTotals, occupiedCountByMonth };
}

export async function loadYearDashboard(year: number): Promise<YearDashboard> {
  const summaries = await Promise.all(MONTHS.map((month) => loadPeriodSummary({ year, month })));
  return buildYearDashboard(year, summaries);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- dashboard`
Expected: PASS — 5 test.

- [ ] **Step 5: Viết Server Action khoá sổ**

Tạo `src/server/actions/lock.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { loadPeriodSummary } from '../billing';
import { prisma } from '../db';
import { requireAdmin } from '../session';

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  action: z.enum(['lock', 'unlock']),
});

/**
 * Khoá sổ một kỳ: tính lại toàn bộ rồi đóng băng kết quả vào snapshotJson,
 * để sau này sửa đơn giá không làm thay đổi số liệu quá khứ.
 */
export async function lockPeriod(formData: FormData) {
  await requireAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/admin');

  const { year, month, action } = parsed.data;

  if (action === 'unlock') {
    await prisma.monthlyRecord.updateMany({
      where: { year, month },
      data: { locked: false, snapshotJson: null },
    });
  } else {
    const summary = await loadPeriodSummary({ year, month });

    for (const row of summary.rows) {
      await prisma.monthlyRecord.upsert({
        where: { roomNumber_year_month: { roomNumber: row.roomNumber, year, month } },
        update: { locked: true, snapshotJson: JSON.stringify(row) },
        create: {
          roomNumber: row.roomNumber,
          year,
          month,
          tenantName: row.tenantName,
          occupied: row.occupied,
          locked: true,
          snapshotJson: JSON.stringify(row),
        },
      });
    }
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/ky/${year}/${month}`);
  redirect(`/admin?nam=${year}`);
}
```

- [ ] **Step 6: Viết trang dashboard quản lý**

Tạo `src/app/admin/page.tsx`:

```tsx
import Link from 'next/link';
import { MONTHS } from '@/lib/period';
import { formatVnd } from '@/lib/money';
import { loadYearDashboard } from '@/server/dashboard';
import { lockPeriod } from '@/server/actions/lock';
import { prisma } from '@/server/db';

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ nam?: string }>;
}) {
  const { nam } = await searchParams;
  const year = Number(nam) || new Date().getFullYear();

  const [dashboard, lockedRecords] = await Promise.all([
    loadYearDashboard(year),
    prisma.monthlyRecord.findMany({
      where: { year, locked: true },
      select: { month: true },
      distinct: ['month'],
    }),
  ]);

  const lockedMonths = new Set(lockedRecords.map((r) => r.month));
  const maxTotal = Math.max(1, ...dashboard.monthlyTotals.map((t) => t.total));

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">Tổng quan năm {year}</h1>
        <Link href={`/admin?nam=${year - 1}`} className="underline">
          ← {year - 1}
        </Link>
        <Link href={`/admin?nam=${year + 1}`} className="underline">
          {year + 1} →
        </Link>
        <a
          href={`/api/export?nam=${year}`}
          className="ml-auto rounded bg-green-700 px-4 py-2 text-white"
        >
          Tải Excel
        </a>
      </header>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Doanh thu theo tháng</h2>
        <div className="flex h-48 items-end gap-2">
          {dashboard.monthlyTotals.map((totals, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-blue-500"
                style={{ height: `${(totals.total / maxTotal) * 100}%` }}
                title={formatVnd(totals.total)}
              />
              <span className="text-xs">T{index + 1}</span>
            </div>
          ))}
        </div>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">Tháng</th>
            <th className="p-2 text-right">Tiền phòng</th>
            <th className="p-2 text-right">Tiền rác</th>
            <th className="p-2 text-right">Tiền điện</th>
            <th className="p-2 text-right">Tiền nước</th>
            <th className="p-2 text-right">Hao hụt</th>
            <th className="p-2 text-right">Tổng</th>
            <th className="p-2 text-center">Phòng có người</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((month) => {
            const totals = dashboard.monthlyTotals[month - 1];
            const locked = lockedMonths.has(month);

            return (
              <tr key={month} className="border-b">
                <td className="p-2">
                  <Link href={`/admin/ky/${year}/${month}`} className="text-blue-600 underline">
                    Tháng {month}
                  </Link>
                </td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.roomFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.trashFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.electricFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.waterFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.lossFee)}</td>
                <td className="p-2 text-right font-semibold tabular-nums">
                  {formatVnd(totals.total)}
                </td>
                <td className="p-2 text-center">{dashboard.occupiedCountByMonth[month - 1]}</td>
                <td className="p-2 text-right">
                  <form action={lockPeriod}>
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="month" value={month} />
                    <input type="hidden" name="action" value={locked ? 'unlock' : 'lock'} />
                    <button type="submit" className="underline">
                      {locked ? 'Mở khoá' : 'Khoá sổ'}
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          <tr className="bg-slate-100 font-bold">
            <td className="p-2">Cả năm</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.roomFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.trashFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.electricFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.waterFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.lossFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.total)}</td>
            <td className="p-2" />
            <td className="p-2" />
          </tr>
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 7: Kiểm thử thủ công**

Run: `npm run dev`
Mở `/admin?nam=2026`. Tháng 8 phải có số liệu đã nhập ở Task 10.
Bấm "Khoá sổ" tháng 8, rồi vào `/admin/don-gia` đổi đơn giá điện thành `4000` có hiệu lực từ 1/2026.
Expected: số liệu tháng 8 **không đổi** (đã đóng băng). Bấm "Mở khoá" — số liệu tính lại theo đơn giá mới.

- [ ] **Step 8: Commit**

```bash
git add src/server/dashboard.ts src/server/dashboard.test.ts src/server/actions/lock.ts src/app/admin/page.tsx
git commit -m "feat: dashboard tổng quát theo năm và chức năng khoá sổ"
```

---

### Task 13: Xuất Excel

**Files:**
- Create: `src/server/excel.ts`
- Create: `src/app/api/export/route.ts`
- Test: `src/server/excel.test.ts`

**Interfaces:**
- Consumes: `PeriodSummary` (Task 5), `RoomYearBreakdown` (Task 6), `MONTHS` (Task 1), `loadPeriodSummary`, `loadRoomYearBreakdown`, `getSession` (Task 7)
- Produces:
  - `function buildWorkbook(input: { year: number; month: number; summary: PeriodSummary; breakdowns: RoomYearBreakdown[] }): ExcelJS.Workbook`
  - `async function exportYearWorkbook(year: number, month: number): Promise<Buffer>`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/server/excel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildWorkbook } from './excel';
import type { PeriodSummary } from './billing';
import type { RoomYearBreakdown } from './breakdown';
import type { RoomBill } from '@/lib/billing/calculate';

const row: RoomBill = {
  roomNumber: 1,
  tenantName: 'Huyền',
  occupied: true,
  roomFee: 800000,
  trashFee: 20000,
  electric: { previous: 18708, current: 18852, usage: 144, unitPrice: 3500, amount: 504000 },
  water: { previous: 1495, current: 1500, usage: 5, unitPrice: 7000, amount: 35000 },
  lossFee: 53900,
  total: 1413000,
  issues: [],
};

const summary: PeriodSummary = {
  period: { year: 2026, month: 8 },
  rows: [row],
  totals: {
    roomFee: 800000,
    trashFee: 20000,
    electricFee: 504000,
    waterFee: 35000,
    lossFee: 53900,
    total: 1413000,
  },
};

function emptyLine() {
  return { months: Array.from({ length: 12 }, () => null), total: 0 };
}

const breakdown: RoomYearBreakdown = {
  roomNumber: 1,
  year: 2026,
  room: { months: [...emptyLine().months], total: 800000 },
  trash: emptyLine(),
  electric: emptyLine(),
  electricUnitPrice: emptyLine(),
  water: emptyLine(),
  waterUnitPrice: emptyLine(),
  grandTotal: emptyLine(),
};

describe('buildWorkbook', () => {
  it('tạo đủ 5 sheet', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });

    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tong quan',
      'Phong',
      'Dien',
      'Nuoc',
      'Rac',
    ]);
  });

  it('sheet Tong quan có dòng tiêu đề tiếng Việt', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Tong quan')!;

    expect(sheet.getRow(2).getCell(1).value).toBe('Số phòng');
    expect(sheet.getRow(2).getCell(2).value).toBe('Họ và tên');
  });

  it('ghi đúng số liệu dòng phòng 1', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Tong quan')!;
    const dataRow = sheet.getRow(3);

    expect(dataRow.getCell(1).value).toBe(1);
    expect(dataRow.getCell(2).value).toBe('Huyền');
    expect(dataRow.getCell(13).value).toBe(1413000);
  });

  it('có dòng tổng cộng ở cuối sheet Tong quan', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Tong quan')!;

    expect(sheet.getRow(4).getCell(1).value).toBe('TỔNG CỘNG');
    expect(sheet.getRow(4).getCell(13).value).toBe(1413000);
  });

  it('sheet Phong có một dòng cho mỗi phòng', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Phong')!;

    expect(sheet.getRow(2).getCell(1).value).toBe(1);
    expect(sheet.getRow(2).getCell(14).value).toBe(800000);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- excel`
Expected: FAIL — `Failed to resolve import "./excel"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/server/excel.ts`:

```ts
import ExcelJS from 'exceljs';
import { MONTHS, formatPeriod } from '@/lib/period';
import { loadPeriodSummary, type PeriodSummary } from './billing';
import { loadRoomYearBreakdown, type MonthlyLine, type RoomYearBreakdown } from './breakdown';

const SUMMARY_HEADERS = [
  'Số phòng',
  'Họ và tên',
  'Tiền phòng',
  'Tiền rác',
  'Điện cũ',
  'Điện mới',
  'Điện TSD',
  'Điện thành tiền',
  'Nước cũ',
  'Nước mới',
  'Nước TSD',
  'Nước thành tiền',
  'Tổng (gồm hao hụt 10%)',
];

function addPivotSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  breakdowns: RoomYearBreakdown[],
  pick: (b: RoomYearBreakdown) => MonthlyLine,
) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(['Số phòng', ...MONTHS.map((m) => `Tháng ${m}`), 'Cả năm']);
  sheet.getRow(1).font = { bold: true };

  for (const breakdown of breakdowns) {
    const line = pick(breakdown);
    sheet.addRow([breakdown.roomNumber, ...line.months, line.total]);
  }

  sheet.columns.forEach((column) => {
    column.width = 14;
  });
}

export function buildWorkbook(input: {
  year: number;
  month: number;
  summary: PeriodSummary;
  breakdowns: RoomYearBreakdown[];
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Tong quan');
  summarySheet.addRow([formatPeriod({ year: input.year, month: input.month })]);
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.addRow(SUMMARY_HEADERS);
  summarySheet.getRow(2).font = { bold: true };

  for (const row of input.summary.rows) {
    summarySheet.addRow([
      row.roomNumber,
      row.tenantName,
      row.roomFee,
      row.trashFee,
      row.electric.previous,
      row.electric.current,
      row.electric.usage,
      row.electric.amount,
      row.water.previous,
      row.water.current,
      row.water.usage,
      row.water.amount,
      row.total,
    ]);
  }

  const totalsRow = summarySheet.addRow([
    'TỔNG CỘNG',
    '',
    input.summary.totals.roomFee,
    input.summary.totals.trashFee,
    null,
    null,
    null,
    input.summary.totals.electricFee,
    null,
    null,
    null,
    input.summary.totals.waterFee,
    input.summary.totals.total,
  ]);
  totalsRow.font = { bold: true };

  summarySheet.columns.forEach((column) => {
    column.width = 16;
  });

  addPivotSheet(workbook, 'Phong', input.breakdowns, (b) => b.room);
  addPivotSheet(workbook, 'Dien', input.breakdowns, (b) => b.electric);
  addPivotSheet(workbook, 'Nuoc', input.breakdowns, (b) => b.water);
  addPivotSheet(workbook, 'Rac', input.breakdowns, (b) => b.trash);

  return workbook;
}

export async function exportYearWorkbook(year: number, month: number): Promise<Buffer> {
  const summary = await loadPeriodSummary({ year, month });
  const breakdowns = await Promise.all(
    summary.rows.map((row) => loadRoomYearBreakdown(row.roomNumber, year)),
  );

  const workbook = buildWorkbook({ year, month, summary, breakdowns });
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- excel`
Expected: PASS — 5 test.

- [ ] **Step 5: Viết route tải file**

Tạo `src/app/api/export/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { exportYearWorkbook } from '@/server/excel';
import { getSession } from '@/server/session';

export async function GET(request: Request) {
  const session = await getSession();
  if (session?.role !== 'admin') {
    return new NextResponse('Không có quyền', { status: 403 });
  }

  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get('nam')) || now.getFullYear();
  const month = Number(url.searchParams.get('thang')) || now.getMonth() + 1;

  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return new NextResponse('Kỳ không hợp lệ', { status: 400 });
  }

  const buffer = await exportYearWorkbook(year, month);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tien-phong-${year}-${month}.xlsx"`,
    },
  });
}
```

- [ ] **Step 6: Kiểm thử thủ công**

Run: `npm run dev`
Đăng nhập admin, mở `/admin?nam=2026`, bấm "Tải Excel".
Expected: tải về `tien-phong-2026-10.xlsx`. Mở file — có 5 sheet, sheet `Tong quan` khớp với số liệu trên web.
Đăng xuất rồi mở thẳng `/api/export?nam=2026` — phải trả về 403.

- [ ] **Step 7: Chạy toàn bộ test và build**

Run:

```bash
npm test
npm run build
```

Expected: toàn bộ test PASS, build thành công không lỗi TypeScript.

- [ ] **Step 8: Commit**

```bash
git add src/server/excel.ts src/server/excel.test.ts src/app/api/export
git commit -m "feat: xuất Excel bảng tổng quan và các bảng phụ"
```

---

### Task 14: Đổi mã PIN quản lý

Có thể làm bất cứ lúc nào sau Task 7; đặt cuối cho gọn luồng chính.

**Files:**
- Create: `src/lib/admin/validate-pin-change.ts`
- Create: `src/server/actions/pin.ts`
- Create: `src/app/admin/doi-ma-pin/page.tsx`
- Create: `scripts/show-admin-pin.ts`
- Modify: `src/app/admin/layout.tsx` (thêm link "Đổi mã PIN")
- Modify: `src/app/login/page.tsx` (thêm thông báo đổi PIN xong)
- Modify: `package.json` (thêm script `admin:pin`)
- Test: `src/lib/admin/validate-pin-change.test.ts`

**Interfaces:**
- Consumes: `readAdminPin`, `writeAdminPin` (Task 7); `requireAdmin`, `clearSession` (Task 7)
- Produces:
  - `interface PinChangeCheck { ok: boolean; error: string | null }`
  - `function validatePinChange(current: string, storedPin: string, next: string, confirm: string): PinChangeCheck`
  - `async function changeAdminPin(formData: FormData): Promise<void>` — Server Action

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/admin/validate-pin-change.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validatePinChange } from './validate-pin-change';

describe('validatePinChange', () => {
  it('chấp nhận khi PIN hiện tại đúng và PIN mới hợp lệ, khớp nhau', () => {
    expect(validatePinChange('000000', '000000', '135790', '135790')).toEqual({
      ok: true,
      error: null,
    });
  });

  it('từ chối khi PIN hiện tại sai', () => {
    expect(validatePinChange('111111', '000000', '135790', '135790')).toEqual({
      ok: false,
      error: 'Mã PIN hiện tại không đúng',
    });
  });

  it('từ chối PIN mới không đủ 6 chữ số', () => {
    expect(validatePinChange('000000', '000000', '1234', '1234')).toEqual({
      ok: false,
      error: 'Mã PIN mới phải gồm đúng 6 chữ số',
    });
  });

  it('từ chối PIN mới có ký tự không phải chữ số', () => {
    expect(validatePinChange('000000', '000000', '12a456', '12a456')).toEqual({
      ok: false,
      error: 'Mã PIN mới phải gồm đúng 6 chữ số',
    });
  });

  it('chấp nhận PIN mới toàn số 0', () => {
    expect(validatePinChange('135790', '135790', '000000', '000000').ok).toBe(true);
  });

  it('từ chối khi hai lần nhập PIN mới không khớp', () => {
    expect(validatePinChange('000000', '000000', '135790', '135791')).toEqual({
      ok: false,
      error: 'Hai lần nhập mã PIN mới không khớp nhau',
    });
  });

  it('từ chối khi PIN mới trùng PIN cũ', () => {
    expect(validatePinChange('000000', '000000', '000000', '000000')).toEqual({
      ok: false,
      error: 'Mã PIN mới phải khác mã PIN hiện tại',
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- validate-pin-change`
Expected: FAIL — `Failed to resolve import "./validate-pin-change"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/admin/validate-pin-change.ts`:

```ts
export interface PinChangeCheck {
  ok: boolean;
  error: string | null;
}

const SIX_DIGITS = /^\d{6}$/;

/**
 * Kiểm tra yêu cầu đổi PIN.
 * Thứ tự kiểm tra có chủ đích: xác thực PIN hiện tại trước, rồi mới xét PIN mới.
 */
export function validatePinChange(
  current: string,
  storedPin: string,
  next: string,
  confirm: string,
): PinChangeCheck {
  if (current !== storedPin) {
    return { ok: false, error: 'Mã PIN hiện tại không đúng' };
  }
  if (!SIX_DIGITS.test(next)) {
    return { ok: false, error: 'Mã PIN mới phải gồm đúng 6 chữ số' };
  }
  if (next !== confirm) {
    return { ok: false, error: 'Hai lần nhập mã PIN mới không khớp nhau' };
  }
  if (next === storedPin) {
    return { ok: false, error: 'Mã PIN mới phải khác mã PIN hiện tại' };
  }
  return { ok: true, error: null };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- validate-pin-change`
Expected: PASS — 7 test.

- [ ] **Step 5: Viết Server Action**

Tạo `src/server/actions/pin.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { validatePinChange } from '@/lib/admin/validate-pin-change';
import { readAdminPin, writeAdminPin } from '../admin-pin';
import { clearSession, requireAdmin } from '../session';

export async function changeAdminPin(formData: FormData) {
  await requireAdmin();

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const stored = await readAdminPin();
  const check = validatePinChange(current, stored, next, confirm);

  if (!check.ok) {
    redirect(`/admin/doi-ma-pin?loi=${encodeURIComponent(check.error!)}`);
  }

  await writeAdminPin(next);

  // Buộc đăng nhập lại bằng PIN mới để chắc chắn chủ trọ nhớ đúng mã.
  await clearSession();
  redirect('/login?loi=doi-pin-xong');
}
```

- [ ] **Step 6: Viết trang đổi PIN**

Tạo `src/app/admin/doi-ma-pin/page.tsx`:

```tsx
import { changeAdminPin } from '@/server/actions/pin';

export default async function ChangePinPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { loi } = await searchParams;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Đổi mã PIN quản lý</h1>

      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      <p className="rounded bg-amber-100 p-3 text-sm text-amber-900">
        Mã PIN gồm đúng 6 chữ số. Sau khi đổi, bạn sẽ phải đăng nhập lại bằng mã mới.
      </p>

      <form action={changeAdminPin} className="flex flex-col gap-3">
        <label htmlFor="current" className="font-medium">
          Mã PIN hiện tại
        </label>
        <input
          id="current"
          name="current"
          type="password"
          inputMode="numeric"
          maxLength={6}
          required
          autoComplete="off"
          className="rounded border p-3 tracking-widest"
        />

        <label htmlFor="next" className="font-medium">
          Mã PIN mới
        </label>
        <input
          id="next"
          name="next"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoComplete="off"
          className="rounded border p-3 tracking-widest"
        />

        <label htmlFor="confirm" className="font-medium">
          Nhập lại mã PIN mới
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoComplete="off"
          className="rounded border p-3 tracking-widest"
        />

        <button type="submit" className="rounded bg-blue-600 p-3 font-medium text-white">
          Đổi mã PIN
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Thêm link vào thanh điều hướng quản lý**

Trong `src/app/admin/layout.tsx`, thêm ngay sau link Đơn giá:

```tsx
<Link href="/admin/doi-ma-pin">Đổi mã PIN</Link>
```

- [ ] **Step 8: Hiển thị thông báo đổi PIN xong ở trang đăng nhập**

Trong `src/app/login/page.tsx`, thêm ngay sau khối thông báo `loi === 'sai-pin'`:

```tsx
{loi === 'doi-pin-xong' && (
  <p className="rounded bg-green-100 p-3 text-green-900">
    Đã đổi mã PIN. Vui lòng đăng nhập lại bằng mã mới.
  </p>
)}
```

- [ ] **Step 9: Viết script đọc lại PIN khi quên**

Tạo `scripts/show-admin-pin.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const setting = await prisma.setting.findUnique({ where: { key: 'ADMIN_PIN' } });
  console.log(setting ? `Ma PIN quan ly hien tai: ${setting.value}` : 'Chua co ma PIN trong DB.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Thêm vào `scripts` trong `package.json`:

```json
"admin:pin": "tsx scripts/show-admin-pin.ts"
```

- [ ] **Step 10: Kiểm thử thủ công**

Run: `npm run dev`
Đăng nhập bằng `000000`, mở `/admin/doi-ma-pin`.
Nhập sai PIN hiện tại — phải thấy "Mã PIN hiện tại không đúng".
Nhập PIN mới `1234` — phải thấy "Mã PIN mới phải gồm đúng 6 chữ số".
Đổi sang `135790` — bị đẩy về `/login` kèm thông báo xanh; đăng nhập lại bằng `135790` phải vào được, bằng `000000` phải báo sai.

Run: `npm run admin:pin`
Expected: in ra `Ma PIN quan ly hien tai: 135790`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/admin/validate-pin-change.ts src/lib/admin/validate-pin-change.test.ts src/server/actions/pin.ts src/app/admin/doi-ma-pin src/app/admin/layout.tsx src/app/login/page.tsx scripts/show-admin-pin.ts package.json
git commit -m "feat: admin tự đổi mã PIN 6 số, kèm script đọc lại PIN khi quên"
```

---

## Ghi chú vận hành

- Trước khi deploy: đổi `SESSION_SECRET` trong `.env`, và **đổi PIN khỏi `000000`** ngay lần đăng nhập đầu.
- **Đặt `TZ=Asia/Ho_Chi_Minh` trên server.** Hạn khóa chỉ số nước tính theo giờ hệ thống; sai múi giờ sẽ làm ngày khóa lệch (Vercel mặc định chạy UTC).
- PIN lưu dạng chữ thường trong bảng `Setting`. Quên thì chạy `npm run admin:pin`. Vì vậy **không commit file DB** và không để lộ bản sao `dev.db`.
- Chuyển sang Postgres: đổi `provider` trong `datasource db` thành `postgresql`, đổi `DATABASE_URL`, chạy `npx prisma migrate dev`. Schema hiện tại không dùng tính năng riêng của SQLite.
- Nhập số liệu lịch sử từ sổ tay: dùng trang `/admin/ky/<năm>/<tháng>` cho từng tháng, bắt đầu từ tháng cũ nhất để tháng sau có chỉ số kỳ trước.
- Khoá sổ sau khi thu tiền xong mỗi tháng, để việc chỉnh đơn giá về sau không làm lệch số liệu quá khứ.
