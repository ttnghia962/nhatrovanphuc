'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export const ROOM_TABS = [
  { key: 'tong', label: 'Tổng cộng', short: 'Tổng' },
  { key: 'phong', label: 'Tiền phòng', short: 'Phòng' },
  { key: 'dien', label: 'Điện', short: 'Điện' },
  { key: 'nuoc', label: 'Nước', short: 'Nước' },
  { key: 'rac', label: 'Rác', short: 'Rác' },
] as const;

/**
 * Hàng tab trên thanh điều hướng của khách thuê. Nằm trong layout nên phải là
 * client component để đọc ?muc= (layout không nhận searchParams). Giữ nguyên
 * năm/tháng đang xem khi đổi tab; trang nhập nước tính là tab Nước.
 */
export function RoomTabs({ roomNumber }: { roomNumber: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/phong/${roomNumber}`;

  const active = pathname === `${base}/nuoc` ? 'nuoc' : pathname === base ? (searchParams.get('muc') ?? 'tong') : null;

  function href(key: string) {
    const params = new URLSearchParams();
    const nam = searchParams.get('nam');
    const thang = searchParams.get('thang');
    if (nam) params.set('nam', nam);
    if (thang) params.set('thang', thang);
    if (key !== 'tong') params.set('muc', key);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  return (
    // Lề = lề nội dung trừ lề trong của tab (16−8, 24−12), để chữ tab đầu thẳng mép với trang.
    <div className="mx-auto flex max-w-5xl items-center justify-between px-2 sm:justify-start sm:px-3">
      {ROOM_TABS.map((tab, index) => {
        const isActive = tab.key === active;
        return (
          <Fragment key={tab.key}>
            {index > 0 && (
              <span aria-hidden className="text-slate-300">
                |
              </span>
            )}
            <Link
              href={href(tab.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`border-b-2 px-2 py-3 sm:px-3 ${
                isActive ? 'border-blue-600 font-bold text-blue-700' : 'border-transparent text-slate-700'
              }`}
            >
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          </Fragment>
        );
      })}
    </div>
  );
}
