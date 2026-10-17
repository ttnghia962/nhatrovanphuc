import { describe, it, expect } from 'vitest';
import { initialAdminPin } from './initial-pin';

describe('initialAdminPin', () => {
  it('đọc PIN 8 chữ số từ ADMIN_INITIAL_PIN, bỏ khoảng trắng', () => {
    expect(initialAdminPin({ ADMIN_INITIAL_PIN: ' 12345678 ' })).toBe('12345678');
  });

  it('giữ nguyên số 0 ở đầu', () => {
    expect(initialAdminPin({ ADMIN_INITIAL_PIN: '00012345' })).toBe('00012345');
  });

  it('báo lỗi rõ ràng khi thiếu biến', () => {
    expect(() => initialAdminPin({})).toThrow(/ADMIN_INITIAL_PIN/);
  });

  it('báo lỗi khi không đúng 8 chữ số', () => {
    expect(() => initialAdminPin({ ADMIN_INITIAL_PIN: '123456' })).toThrow(/8 chữ số/);
    expect(() => initialAdminPin({ ADMIN_INITIAL_PIN: '1234567a' })).toThrow(/8 chữ số/);
  });
});
