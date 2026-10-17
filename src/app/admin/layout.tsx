import { Fragment } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/server/session';
import { logout } from '@/server/actions/auth';

const TABS = [
  { href: '/admin', label: 'Quản lý' },
  { href: '/admin/phong', label: 'Các phòng' },
  { href: '/admin/don-gia', label: 'Đơn giá' },
  { href: '/admin/doi-ma-pin', label: 'Đổi PIN' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-dvh">
      <nav className="sticky top-0 z-10 flex flex-wrap items-center border-b bg-slate-800 px-1 py-1 text-[15px] text-white sm:gap-x-3 sm:px-4 sm:text-base">
        {TABS.map((tab, index) => (
          <Fragment key={tab.href}>
            {/* Vạch "|" giữa các tab để dễ phân biệt từng mục; vùng bấm vẫn cao đủ cho ngón tay. */}
            {index > 0 && (
              <span aria-hidden className="text-slate-500">
                |
              </span>
            )}
            <Link href={tab.href} className={`px-1.5 py-3 min-[390px]:px-2 sm:px-3 ${index === 0 ? 'font-bold' : ''}`}>
              {tab.label}
            </Link>
          </Fragment>
        ))}
        <form action={logout} className="ml-auto">
          <button type="submit" className="px-1.5 py-3 underline min-[390px]:px-2 sm:px-3">
            Thoát
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
