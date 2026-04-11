// ぎゅう丸シフト管理システム - JWT認証ミドルウェア

import { Context, Next } from 'hono';
import type { Env, UserRole } from '../types';

interface JwtPayload {
  // 本部管理者: storeId=null
  // 店長/スタッフ: storeId=自店舗ID
  storeId: number | null;
  role: UserRole;
  staffId?: string;
  managerId?: string;
  name?: string;
  exp: number;
}

// JWTトークンを生成する
export async function createToken(secret: string, payload: Omit<JwtPayload, 'exp'>, expiresIn = 86400): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = { ...payload, exp: now + expiresIn };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signingInput = encodedHeader + '.' + encodedPayload;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = base64url(signature);

  return signingInput + '.' + encodedSignature;
}

// JWTトークンを検証する
export async function verifyToken(secret: string, token: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const signingInput = parts[0] + '.' + parts[1];

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = base64urlDecode(parts[2]);
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(signingInput));

  if (!valid) return null;

  const payload: JwtPayload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));

  // 有効期限チェック
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  return payload;
}

type AuthVariables = {
  storeId: number | null;
  role: UserRole;
  staffId?: string;
  managerId?: string;
  name?: string;
};

// 認証ミドルウェア（トークン検証のみ。権限チェックは requireRole で）
export function authMiddleware() {
  return async (
    c: Context<{ Bindings: Env; Variables: AuthVariables }>,
    next: Next
  ) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, message: '認証が必要です' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(c.env.JWT_SECRET, token);

    if (!payload) {
      return c.json({ success: false, message: 'トークンが無効です' }, 401);
    }

    c.set('storeId', payload.storeId);
    c.set('role', payload.role);
    if (payload.staffId) c.set('staffId', payload.staffId);
    if (payload.managerId) c.set('managerId', payload.managerId);
    if (payload.name) c.set('name', payload.name);

    await next();
  };
}

// 特定ロール以上のみ許可するミドルウェア
// 階層: headquarters_admin > store_manager > staff
export function requireRole(...allowed: UserRole[]) {
  return async (
    c: Context<{ Bindings: Env; Variables: AuthVariables }>,
    next: Next
  ) => {
    const role = c.get('role');
    if (!allowed.includes(role)) {
      return c.json({ success: false, message: 'この操作を実行する権限がありません' }, 403);
    }
    await next();
  };
}

// 特定店舗のデータへのアクセスを許可するか判定
// 本部管理者は全店舗OK、店長・スタッフは自店舗のみ
export function canAccessStore(role: UserRole, myStoreId: number | null, targetStoreId: number): boolean {
  if (role === 'headquarters_admin') return true;
  return myStoreId === targetStoreId;
}

// Base64URL エンコード
function base64url(input: string | ArrayBuffer): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }

  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64URL デコード
function base64urlDecode(input: string): ArrayBuffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
