import { changeAdminPin } from '@/server/actions/pin';

export default async function ChangePinPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { loi } = await searchParams;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Đổi mã PIN quản lý</h1>

      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      <p className="rounded bg-amber-100 p-3 text-sm text-amber-900">
        Mã PIN gồm đúng 6 chữ số. Sau khi đổi, bạn sẽ phải đăng nhập lại bằng mã mới.
      </p>

      <form action={changeAdminPin} className="flex flex-col gap-3">
        <label htmlFor="current" className="font-medium">
          Mã PIN hiện tại
        </label>
        <input
          id="current"
          name="current"
          type="password"
          inputMode="numeric"
          maxLength={6}
          required
          autoComplete="off"
          className="rounded border p-3 tracking-widest"
        />

        <label htmlFor="next" className="font-medium">
          Mã PIN mới
        </label>
        <input
          id="next"
          name="next"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoComplete="off"
          className="rounded border p-3 tracking-widest"
        />

        <label htmlFor="confirm" className="font-medium">
          Nhập lại mã PIN mới
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoComplete="off"
          className="rounded border p-3 tracking-widest"
        />

        <button type="submit" className="rounded bg-blue-600 p-3 font-medium text-white">
          Đổi mã PIN
        </button>
      </form>
    </main>
  );
}
