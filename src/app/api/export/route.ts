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

  // Number.isInteger cho cả tháng: "thang=3.5" lọt qua kiểm tra khoảng 1..12
  // sẽ làm summaries[2.5] trả undefined và nổ ở tầng dưới.
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return new NextResponse('Kỳ không hợp lệ', { status: 400 });
  }

  const buffer = await exportYearWorkbook(year, month);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tien-phong-${year}-${month}.xlsx"`,
    },
  });
}
