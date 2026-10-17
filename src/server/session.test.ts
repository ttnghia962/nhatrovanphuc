import { describe, it, expect } from 'vitest';
import { encodeSession, decodeSession, type Session } from './session';

const SECRET = 'test-secret';

describe('encodeSession / decodeSession', () => {
  it('đi vòng tròn giữ nguyên phiên khách thuê', () => {
    const session: Session = { role: 'tenant', roomNumber: 7 };
    expect(decodeSession(encodeSession(session, SECRET), SECRET)).toEqual(session);
  });

  it('đi vòng tròn giữ nguyên phiên admin', () => {
    const session: Session = { role: 'admin' };
    expect(decodeSession(encodeSession(session, SECRET), SECRET)).toEqual(session);
  });

  it('từ chối token bị sửa nội dung', () => {
    const token = encodeSession({ role: 'tenant', roomNumber: 7 }, SECRET);
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ role: 'admin' })).toString('base64url')}.${signature}`;

    expect(decodeSession(forged, SECRET)).toBeNull();
  });

  it('từ chối token ký bằng secret khác', () => {
    const token = encodeSession({ role: 'admin' }, 'secret-khac');
    expect(decodeSession(token, SECRET)).toBeNull();
  });

  it('từ chối chuỗi rác', () => {
    expect(decodeSession('khong-phai-token', SECRET)).toBeNull();
    expect(decodeSession('', SECRET)).toBeNull();
  });
});
