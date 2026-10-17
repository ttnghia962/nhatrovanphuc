import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'phuc_session';

export type Session = { role: 'tenant'; roomNumber: number } | { role: 'admin' };

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function encodeSession(session: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(token: string, secret: string): Session | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    if (parsed.role === 'admin') return { role: 'admin' };
    if (parsed.role === 'tenant' && Number.isInteger(parsed.roomNumber)) {
      return { role: 'tenant', roomNumber: parsed.roomNumber };
    }
    return null;
  } catch {
    return null;
  }
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('Thiếu biến môi trường SESSION_SECRET');
  return value;
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? decodeSession(token, secret()) : null;
}

export async function setSession(session: Session): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, encodeSession(session, secret()), {
    httpOnly: true,
    sameSite: 'lax',
    // Cookie này là toàn bộ ranh giới khách thuê / quản lý. Bật secure khi chạy
    // thật (HTTPS); ở máy cá nhân và trong mạng LAN vẫn là HTTP nên không bật.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (session?.role !== 'admin') redirect('/login');
}

export async function requireRoom(roomNumber: number): Promise<void> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'admin') return;
  if (session.roomNumber !== roomNumber) redirect(`/phong/${session.roomNumber}`);
}
