import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from '@/server/session';
import { logout } from '@/server/actions/auth';
import { RoomTabs } from '@/components/room-tabs';

/**
 * Thanh trên cùng cho khu vực khách thuê. Chỉ để điều hướng — việc kiểm quyền
 * vẫn nằm ở từng page (requireRoom), vì layout không chạy lại khi chuyển trang.
 */
export default async function RoomLayout({
  children,
  params,
}: LayoutProps<'/phong/[roomNumber]'>) {
  const { roomNumber } = await params;
  const session = await getSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-1">
          <Link href={`/phong/${roomNumber}`} className="py-2 text-lg font-bold">
            Phòng {roomNumber}
          </Link>
          {session?.role === 'admin' ? (
            <Link href="/admin" className="ml-auto rounded px-3 py-2 text-blue-700">
              ← Trang quản lý
            </Link>
          ) : (
            <form action={logout} className="ml-auto">
              <button type="submit" className="rounded border px-3 py-2 text-slate-700">
                Thoát ra
              </button>
            </form>
          )}
        </div>
        <nav aria-label="Chọn khoản">
          {/* useSearchParams trong client component cần Suspense bao ngoài. */}
          <Suspense>
            <RoomTabs roomNumber={roomNumber} />
          </Suspense>
        </nav>
      </header>
      {children}
    </div>
  );
}
