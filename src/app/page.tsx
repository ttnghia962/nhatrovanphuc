import { redirect } from 'next/navigation';
import { getSession } from '@/server/session';

/**
 * Trang gốc không có nội dung riêng. Ai đã đăng nhập (cookie còn hạn 30 ngày)
 * thì đưa thẳng về trang của mình, để khách thuê mở web trên điện thoại là
 * thấy ngay bill thay vì phải chọn lại phòng; chưa đăng nhập thì sang /login.
 * redirect() hoạt động bằng cách throw, nên không bọc trong try/catch.
 */
export default async function Home() {
  const session = await getSession();
  if (session?.role === 'admin') redirect('/admin');
  if (session?.role === 'tenant') redirect(`/phong/${session.roomNumber}`);
  redirect('/login');
}
