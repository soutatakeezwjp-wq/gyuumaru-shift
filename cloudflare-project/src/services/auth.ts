// ぎゅう丸シフト管理システム - 認証サービス（Supabase版）

import * as dao from '../db/dao';
import type { DB } from '../db/supabase';
import { SETTING_KEYS, STAFF_STATUS } from '../config';
import { hashPassword, verifyPassword } from '../utils';
import type { StaffListItem, StoreInfo, TimeSlotStaffing, ManagerAccount, PeakHourBonus } from '../types';

// スタッフ選択画面用の一覧を取得する（ID, 名前, フリガナ, PIN設定済みかどうか）
export async function getStaffList(
  db: DB,
  storeId: number
): Promise<Array<StaffListItem & { pinSet: boolean }>> {
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  return allStaff
    .map((s) => ({
      id: s.id,
      name: s.name,
      kana: s.kana,
      position: s.position,
      pinSet: false, // PIN の有無は PIN check 用の別エンドポイントで返す
    }))
    .sort((a, b) => (a.kana || '').localeCompare(b.kana || '', 'ja'));
}

// 管理者パスワードを検証する（店舗ごとの既存の管理者パスワード）
export async function verifyAdminPassword(db: DB, storeId: number, password: string): Promise<boolean> {
  const storedHash = await dao.getSetting(db, storeId, SETTING_KEYS.ADMIN_PASSWORD);
  if (!storedHash) return false;
  // 定数時間比較 + 旧SHA-256/新PBKDF2の両対応
  return verifyPassword(password, storedHash);
}

// 管理者パスワードを設定する
export async function setAdminPassword(db: DB, storeId: number, password: string): Promise<void> {
  const hashed = await hashPassword(password);
  await dao.updateSetting(db, storeId, SETTING_KEYS.ADMIN_PASSWORD, hashed);
  await dao.addLog(db, storeId, '管理者', 'パスワード変更', '管理者パスワードが変更されました');
}

// 現在の店舗情報を取得する
export async function getCurrentStoreInfo(db: DB, storeId: number): Promise<StoreInfo> {
  const settings = await dao.getSettings(db, storeId);
  return {
    storeName: settings[SETTING_KEYS.STORE_NAME] || '未設定',
    storeCode: settings[SETTING_KEYS.STORE_CODE] || '',
    storeType: settings[SETTING_KEYS.STORE_TYPE] || '',
    openTime: settings[SETTING_KEYS.OPEN_TIME] || '11:00',
    closeTime: settings[SETTING_KEYS.CLOSE_TIME] || '22:00',
    lunchStart: settings[SETTING_KEYS.LUNCH_START] || '11:00',
    lunchEnd: settings[SETTING_KEYS.LUNCH_END] || '15:00',
    dinnerStart: settings[SETTING_KEYS.DINNER_START] || '17:00',
    dinnerEnd: settings[SETTING_KEYS.DINNER_END] || '22:00',
    minStaffLunch: parseInt(settings[SETTING_KEYS.MIN_STAFF_LUNCH]) || 3,
    minStaffDinner: parseInt(settings[SETTING_KEYS.MIN_STAFF_DINNER]) || 4,
    weekdayHallMin: parseInt(settings[SETTING_KEYS.WEEKDAY_HALL_MIN]) || 3,
    weekdayKitchenMin: parseInt(settings[SETTING_KEYS.WEEKDAY_KITCHEN_MIN]) || 2,
    weekendHallMin: parseInt(settings[SETTING_KEYS.WEEKEND_HALL_MIN]) || 5,
    weekendKitchenMin: parseInt(settings[SETTING_KEYS.WEEKEND_KITCHEN_MIN]) || 4,
    // 月間労働時間の上限。設定が無い新規店舗向けのデフォルト。
    // 修正点.md の方針: 240時間（下限）〜280時間（上限/危険ライン）。
    fulltimeMonthlyLimit: parseInt(settings[SETTING_KEYS.FULLTIME_MONTHLY_LIMIT]) || 280,
    requestDeadlineDay: parseInt(settings[SETTING_KEYS.REQUEST_DEADLINE_DAY]) || 20,
    timeSlotStaffing: parseTimeSlotStaffing(settings[SETTING_KEYS.TIME_SLOT_STAFFING]),
    peakHourBonuses: parsePeakHourBonuses(settings[SETTING_KEYS.PEAK_HOUR_BONUSES]),
    weekendBonusPerHour: parseInt(settings[SETTING_KEYS.WEEKEND_BONUS_PER_HOUR]) || 0,
    weekdayBonusPerHour: parseInt(settings[SETTING_KEYS.WEEKDAY_BONUS_PER_HOUR]) || 0,
  };
}

// ピーク手当のJSON文字列をパースする
function parsePeakHourBonuses(json: string | undefined): PeakHourBonus[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && p.start && p.end && Number.isFinite(p.bonus))
      .map((p) => ({
        start: String(p.start),
        end: String(p.end),
        bonus: Number(p.bonus),
        label: p.label ? String(p.label) : undefined,
      }));
  } catch {
    return [];
  }
}

// 時間帯別必要人数のJSON文字列をパースする
function parseTimeSlotStaffing(json: string | undefined): TimeSlotStaffing[] {
  const defaults: TimeSlotStaffing[] = [
    { start: '10:00', end: '14:00', hall: 4, kitchen: 3, weekdayHall: 4, weekdayKitchen: 3, weekendHall: 4, weekendKitchen: 3, label: 'ランチ' },
    { start: '14:00', end: '17:00', hall: 1, kitchen: 1, weekdayHall: 1, weekdayKitchen: 1, weekendHall: 1, weekendKitchen: 1, label: 'つなぎ' },
    { start: '17:00', end: '22:00', hall: 4, kitchen: 3, weekdayHall: 4, weekdayKitchen: 3, weekendHall: 4, weekendKitchen: 3, label: 'ディナー' },
  ];
  if (!json) return defaults;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s: TimeSlotStaffing) => ({
        ...s,
        hall: s.hall ?? s.weekdayHall ?? 3,
        kitchen: s.kitchen ?? s.weekdayKitchen ?? 2,
      }));
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

// シフト希望の受付期間中かどうかを判定する
export function isRequestPeriodOpen(yearMonth: string, deadlineDay: number): boolean {
  const parts = yearMonth.split('-');
  const targetMonth = parseInt(parts[1]);
  const targetYear = parseInt(parts[0]);

  let prevMonth = targetMonth - 1;
  let prevYear = targetYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }

  const deadlineDate = new Date(prevYear, prevMonth - 1, deadlineDay, 23, 59, 59);
  const now = new Date();
  return now <= deadlineDate;
}

// =====================================================================
// 新機能 1: スタッフ4桁PIN ログイン
// =====================================================================

const PIN_LOCKOUT_THRESHOLD = 5; // 5回連続失敗で15分ロック
const PIN_LOCKOUT_MINUTES = 15;

// PINを新規設定する（初回 or 再設定）
export async function setStaffPin(db: DB, staffId: string, pin: string): Promise<{ success: boolean; message: string }> {
  if (!/^\d{4}$/.test(pin)) {
    return { success: false, message: '4桁の数字で設定してください' };
  }
  const pinHash = await hashPassword(pin);
  const ok = await dao.setStaffPinHash(db, staffId, pinHash);
  if (!ok) return { success: false, message: 'スタッフが見つかりません' };
  return { success: true, message: 'PINを設定しました' };
}

// スタッフがPINを既に設定しているか確認する
export async function hasPinSet(db: DB, staffId: string): Promise<boolean> {
  const info = await dao.getStaffPinInfo(db, staffId);
  return !!info && !!info.pinHash;
}

// PINで認証する
export async function verifyStaffPin(
  db: DB,
  staffId: string,
  pin: string
): Promise<{ ok: boolean; message: string; locked?: boolean }> {
  const info = await dao.getStaffPinInfo(db, staffId);
  if (!info) {
    return { ok: false, message: 'スタッフが見つかりません、または退職済みです' };
  }

  // ロック中チェック
  if (info.lockedUntil) {
    const until = new Date(info.lockedUntil);
    if (until > new Date()) {
      const leftMin = Math.ceil((until.getTime() - Date.now()) / 60000);
      return { ok: false, locked: true, message: `PIN入力が多すぎます。約${leftMin}分後に再度お試しください。` };
    }
  }

  if (!info.pinHash) {
    return { ok: false, message: 'PINが未設定です。初回ログインから設定してください。' };
  }

  // 定数時間比較 + 旧SHA-256/新PBKDF2の両対応
  const pinOk = await verifyPassword(pin, info.pinHash);
  if (!pinOk) {
    const newCount = info.failedCount + 1;
    let lockedUntil: string | null = null;
    if (newCount >= PIN_LOCKOUT_THRESHOLD) {
      lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60000).toISOString();
    }
    await dao.incrementPinFailure(db, staffId, lockedUntil);
    if (lockedUntil) {
      return { ok: false, locked: true, message: `PINを${PIN_LOCKOUT_THRESHOLD}回連続で間違えたため、${PIN_LOCKOUT_MINUTES}分間ロックされました` };
    }
    return { ok: false, message: `PINが一致しません（残り${PIN_LOCKOUT_THRESHOLD - newCount}回）` };
  }

  // 成功したら失敗カウントをリセット
  if (info.failedCount > 0 || info.lockedUntil) {
    await dao.resetPinFailure(db, staffId);
  }
  return { ok: true, message: 'PIN認証に成功しました' };
}

// =====================================================================
// 新機能 4: 3階層ロール（本部管理者・店長）のログイン
// =====================================================================

export async function loginManager(
  db: DB,
  email: string,
  password: string
): Promise<{ ok: boolean; manager?: ManagerAccount; message: string }> {
  const row = await dao.getManagerByEmail(db, email);
  if (!row) {
    return { ok: false, message: 'メールアドレスまたはパスワードが正しくありません' };
  }
  // 定数時間比較 + 旧SHA-256/新PBKDF2の両対応
  const passOk = await verifyPassword(password, row.passwordHash);
  if (!passOk) {
    return { ok: false, message: 'メールアドレスまたはパスワードが正しくありません' };
  }
  await dao.touchManagerLogin(db, row.manager.id);
  return { ok: true, manager: row.manager, message: 'ログインしました' };
}

export async function registerManager(
  db: DB,
  email: string,
  password: string,
  name: string,
  role: 'headquarters_admin' | 'store_manager',
  storeId: number | null
): Promise<{ ok: boolean; managerId?: string; message: string }> {
  if (!email || !password || !name) {
    return { ok: false, message: '必須項目が未入力です' };
  }
  if (password.length < 8) {
    return { ok: false, message: 'パスワードは8文字以上にしてください' };
  }
  if (role === 'store_manager' && storeId == null) {
    return { ok: false, message: '店長アカウントには店舗の指定が必要です' };
  }
  if (role === 'headquarters_admin' && storeId != null) {
    return { ok: false, message: '本部管理者に店舗を指定することはできません' };
  }
  const passwordHash = await hashPassword(password);
  try {
    const id = await dao.createManager(db, email, passwordHash, name, role, storeId);
    await dao.addLog(db, storeId, 'system', '管理者アカウント作成', `${role}: ${email}`);
    return { ok: true, managerId: id, message: 'アカウントを作成しました' };
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || '';
    if (msg.includes('duplicate key') || msg.includes('managers_email_key')) {
      return { ok: false, message: 'そのメールアドレスは既に使われています' };
    }
    throw e;
  }
}
