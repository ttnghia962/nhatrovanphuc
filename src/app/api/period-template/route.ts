import { NextResponse } from 'next/server';
import { buildPeriodTemplate } from '@/server/period-import';
import { getSession } from '@/server/session';

/** File Excel mẫu để nhập liệu một kỳ: /api/period-template?nam=2026&thang=10 */
export async function GET(request: Request) {
  const session = await getSession();
  if (session?.role !== 'admin') {
    return new NextResponse('Không có quyền', { status: 403 });
  }

  const url = new URL(request.url);
  const year = Number(url.searchParams.get('nam'));
  const month = Number(url.searchParams.get('thang'));
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return new NextResponse('Kỳ không hợp lệ', { status: 400 });
  }

  const buffer = await buildPeriodTemplate({ year, month });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="nhap-lieu-${year}-${month}.xlsx"`,
    },
  });
}
