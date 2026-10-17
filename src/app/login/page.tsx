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
      {loi === 'doi-pin-xong' && (
        <p className="rounded bg-green-100 p-3 text-green-900">
          Đã đổi mã PIN. Vui lòng đăng nhập lại bằng mã mới.
        </p>
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
