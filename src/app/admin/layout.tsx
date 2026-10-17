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
