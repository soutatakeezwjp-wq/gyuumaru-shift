// ぎゅう丸シフト管理システム - 共通ユーティリティ（Utils.gs の移植）

import { TIME_CONFIG } from './config';

// ユニークIDを生成する
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return prefix + '_' + timestamp + random;
}

// 日付を 'YYYY-MM-DD' 形式の文字列に変換する
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

// 日付を 'YYYY-MM' 形式の文字列に変換する
export function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  return year + '-' + month;
}

// 時刻を 'HH:MM' 形式の文字列に変換する
export function formatTime(time: string): string {
  if (!time) return '';
  if (/^\d{1,2}:\d{2}$/.test(time)) return time;
  return '';
}

// 現在の日時を 'YYYY-MM-DD HH:MM:SS' 形式で取得する（日本時間）
export function getNow(): string {
  const d = new Date();
  // 日本時間に変換
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = ('0' + (jst.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + jst.getUTCDate()).slice(-2);
  const hours = ('0' + jst.getUTCHours()).slice(-2);
  const minutes = ('0' + jst.getUTCMinutes()).slice(-2);
  const seconds = ('0' + jst.getUTCSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 指定した年月の日数を取得する
export function getDaysInMonth(yearMonth: string): number {
  const parts = yearMonth.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  return new Date(year, month, 0).getDate();
}

// 指定した年月の全日付を配列で取得する
export function getAllDatesInMonth(yearMonth: string): string[] {
  const days = getDaysInMonth(yearMonth);
  const dates: string[] = [];
  for (let i = 1; i <= days; i++) {
    dates.push(yearMonth + '-' + ('0' + i).slice(-2));
  }
  return dates;
}

// 指定した日付の曜日を取得する（日本語）
export function getDayOfWeek(dateStr: string): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

// 時刻文字列を分数に変換する
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// 分数を時刻文字列に変換する
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

// 2つの時刻の差を時間（小数）で計算する
export function calcHoursDiff(startTime: string, endTime: string): number {
  let startMin = timeToMinutes(startTime);
  let endMin = timeToMinutes(endTime);
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }
  return (endMin - startMin) / 60;
}

// 勤務時間から休憩時間（分）を計算する（労基法ベース）
export function calcBreakMinutes(workHours: number): number {
  if (workHours > 8) {
    return TIME_CONFIG.BREAK_THRESHOLD_8H;
  } else if (workHours > 6) {
    return TIME_CONFIG.BREAK_THRESHOLD_6H;
  }
  return 0;
}

// =====================================================================
// パスワード/PINハッシュ
// =====================================================================
// 方針: ソルト付き PBKDF2-SHA256 を使う。保存形式は
//   pbkdf2$<iterations>$<saltHex>$<hashHex>
// 旧形式（生のSHA-256: 64文字のhex）も verifyPassword 側で検証可能にして
// 既存DBとの互換を保つ。新しく作られるハッシュは全て新形式になる。

const PBKDF2_ITERATIONS = 100_000; // 2026年時点でPBKDF2-SHA256の現実的な下限
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => ('0' + b.toString(16)).slice(-2))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function pbkdf2Derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

// 定数時間で文字列を比較する（タイミング攻撃対策）
// 長さが違っても一定時間を使う（ただし長さ情報は漏れる。これは許容）
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// パスワード/PINをハッシュ化する（新形式: PBKDF2 + salt）
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const derived = await pbkdf2Derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

// 入力されたパスワード/PINを保存されたハッシュと比較する。
// 新形式（pbkdf2$...）と旧形式（64文字のSHA-256 hex）の両方に対応する。
// 認証箇所では `===` ではなく必ずこの関数を使うこと（タイミング攻撃対策）。
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (stored.startsWith('pbkdf2$')) {
    // 新形式: pbkdf2$iterations$salt$hash
    const parts = stored.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1]);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    const salt = hexToBytes(parts[2]);
    const derived = await pbkdf2Derive(password, salt, iterations);
    return timingSafeEqual(bytesToHex(derived), parts[3]);
  }

  // 旧形式: 生の SHA-256 hex（64文字）。既存DBとの互換のため残す。
  // 次期バージョンで運用データが全て新形式に移行したら削除する予定。
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map((b) => ('0' + b.toString(16)).slice(-2)).join('');
  return timingSafeEqual(inputHash, stored);
}

// 指定した日付が含まれる週の月曜日を取得する
export function getMonday(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return formatDate(d);
}

// 来月の年月を取得する
export function getNextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return formatYearMonth(d);
}

// 今月の年月を取得する
export function getCurrentMonth(): string {
  return formatYearMonth(new Date());
}

// 日付に日数を加算する
export function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

// 30分刻みの時間選択肢を生成する
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = TIME_CONFIG.EARLIEST_HOUR; h < TIME_CONFIG.LATEST_HOUR; h++) {
    for (let m = 0; m < 60; m += TIME_CONFIG.SLOT_INTERVAL) {
      slots.push(('0' + h).slice(-2) + ':' + ('0' + m).slice(-2));
    }
  }
  slots.push(('0' + TIME_CONFIG.LATEST_HOUR).slice(-2) + ':00');
  return slots;
}
