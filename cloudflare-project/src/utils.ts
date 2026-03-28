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

// パスワードをSHA-256でハッシュ化する（Web Crypto API版）
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => ('0' + b.toString(16)).slice(-2)).join('');
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
