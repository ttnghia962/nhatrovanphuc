import { redirect } from 'next/navigation';

/**
 * Trang gốc không có nội dung riêng: khách thuê gõ địa chỉ web vào đây thì
 * đưa thẳng tới chỗ chọn phòng / nhập mã PIN.
 * redirect() hoạt động bằng cách throw, nên không bọc trong try/catch.
 */
export default function Home() {
  redirect('/login');
}
