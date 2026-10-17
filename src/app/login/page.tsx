import { loginAsAdmin, loginAsTenant } from '@/server/actions/auth';

const ROOMS = Array.from({ length: 32 }, (_, i) => i + 1);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { loi } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-8 sm:justify-center sm:p-6">
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

      {/* Mỗi phòng là một nút submit riêng: khách thuê chạm đúng số phòng là vào
          luôn, không phải mở danh sách 32 dòng rồi bấm thêm nút xác nhận. */}
      <form action={loginAsTenant} className="flex flex-col gap-3">
        <h2 className="font-medium">Chạm vào số phòng của bạn</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ROOMS.map((n) => (
            <button
              key={n}
              type="submit"
              name="roomNumber"
              value={n}
              aria-label={`Phòng ${n}`}
              className="flex h-14 items-center justify-center rounded-lg border-2 border-blue-200 bg-blue-50 text-xl font-semibold text-blue-900 active:bg-blue-600 active:text-white"
            >
              {n}
            </button>
          ))}
        </div>
      </form>

      {/* Phần quản lý thu gọn lại để khách thuê không bị rối bởi ô nhập PIN. */}
      <details className="rounded-lg border p-4" open={loi === 'sai-pin' || loi === 'doi-pin-xong'}>
        <summary className="cursor-pointer py-1 font-medium text-slate-700">
          Dành cho quản lý
        </summary>
        <form action={loginAsAdmin} className="mt-3 flex flex-col gap-3">
          <label htmlFor="pin" className="font-medium">
            Nhập mã PIN 8 số
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{8}"
            maxLength={8}
            autoComplete="off"
            className="rounded border p-3 text-center text-2xl tracking-[0.4em]"
          />
          <button type="submit" className="rounded bg-slate-800 p-3 font-medium text-white">
            Vào trang quản lý
          </button>
        </form>
      </details>
    </main>
  );
}
