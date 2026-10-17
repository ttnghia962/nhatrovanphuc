'use client';

import { useState } from 'react';
import { MONTHS } from '@/lib/period';

/**
 * Ô "Áp dụng từ năm" + "Tháng" của form đơn giá. Khoá sẵn các tháng đã qua
 * (cùng năm hiện tại thì chỉ chọn được tháng sau tháng hiện tại), để quản lý
 * không chọn nhầm rồi mới bị server báo lỗi. Server vẫn kiểm lại bằng
 * effectivePeriodError, đây chỉ là lớp tiện cho người dùng.
 *
 * Năm/tháng hiện tại lấy từ server truyền xuống để khớp với múi giờ máy chủ.
 */
export function RatePeriodFields({
  currentYear,
  currentMonth,
  minYear,
}: {
  currentYear: number;
  currentMonth: number;
  minYear: number;
}) {
  const firstOpenMonth = (y: number) => (y === currentYear ? currentMonth + 1 : 1);

  // Tháng 12: tháng kế tiếp nằm ở năm sau.
  const initialYear = currentMonth === 12 ? currentYear + 1 : Math.max(currentYear, minYear);
  // Giữ dạng chuỗi để xoá trắng ô rồi gõ lại không bị nhảy thành "0".
  const [yearText, setYearText] = useState(String(initialYear));
  const [month, setMonth] = useState(firstOpenMonth(initialYear));
  const year = Number(yearText);

  function changeYear(value: string) {
    setYearText(value);
    // Đổi về năm hiện tại mà tháng đang chọn đã qua thì nhảy sang tháng gần nhất còn chọn được.
    const y = Number(value);
    if (y === currentYear && month < firstOpenMonth(y)) setMonth(firstOpenMonth(y));
  }

  const isClosed = (m: number) => year < currentYear || m < firstOpenMonth(year);

  return (
    <>
      <label className="flex w-full flex-col gap-1 sm:w-auto">
        <span className="text-sm">Áp dụng từ năm</span>
        <input
          name="effectiveYear"
          type="number"
          min={Math.max(currentYear, minYear)}
          max={2100}
          required
          value={yearText}
          onChange={(e) => changeYear(e.target.value)}
          className="h-11 w-full rounded border px-2 sm:w-28"
        />
      </label>

      <label className="flex w-full flex-col gap-1 sm:w-auto">
        <span className="text-sm">Tháng</span>
        <select
          name="effectiveMonth"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="h-11 w-full rounded border px-2 sm:w-24"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m} disabled={isClosed(m)}>
              {m}
              {isClosed(m) ? ' (đã qua)' : ''}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
