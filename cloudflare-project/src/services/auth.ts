// ぎゅう丸シフト管理システム - 認証サービス（AuthService.gs の移植）

import * as dao from '../db/dao';
import { SETTING_KEYS } from '../config';
import { hashPassword } from '../utils';
import type { StaffListItem, StoreInfo } from '../types';

// スタッフ選択画面用の一覧を取得する（ID, 名前, フリガナのみ）
export async function getStaffList(db: D1Database, storeId: number): Promise<StaffListItem[]> {
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  return allStaff
    .map(s => ({ id: s.id, name: s.name, kana: s.kana, position: s.position }))
    .sort((a, b) => (a.kana || '').localeCompare(b.kana || '', 'ja'));
}

// 管理者パスワードを検証する
export async function verifyAdminPassword(db: D1Database, storeId: number, password: string): Promise<boolean> {
  const storedHash = await dao.getSetting(db, storeId, SETTING_KEYS.ADMIN_PASSWORD);
  if (!storedHash) return false;
  const inputHash = await hashPassword(password);
  return storedHash === inputHash;
}

// 管理者パスワードを設定する
export async function setAdminPassword(db: D1Database, storeId: number, password: string): Promise<void> {
  const hashed = await hashPassword(password);
  await dao.updateSetting(db, storeId, SETTING_KEYS.ADMIN_PASSWORD, hashed);
  await dao.addLog(db, storeId, '管理者', 'パスワード変更', '管理者パスワードが変更されました');
}

// 現在の店舗情報を取得する
export async function getCurrentStoreInfo(db: D1Database, storeId: number): Promise<StoreInfo> {
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
    fulltimeMonthlyLimit: parseInt(settings[SETTING_KEYS.FULLTIME_MONTHLY_LIMIT]) || 60,
    requestDeadlineDay: parseInt(settings[SETTING_KEYS.REQUEST_DEADLINE_DAY]) || 20,
  };
}

// シフト希望の受付期間中かどうかを判定する
export function isRequestPeriodOpen(yearMonth: string, deadlineDay: number): boolean {
  const parts = yearMonth.split('-');
  const targetMonth = parseInt(parts[1]);
  const targetYear = parseInt(parts[0]);

  let prevMonth = targetMonth - 1;
  let prevYear = targetYear;
  if (prevMonth === 0) { prevMonth = 12; prevYear--; }

  const deadlineDate = new Date(prevYear, prevMonth - 1, deadlineDay, 23, 59, 59);
  const now = new Date();
  return now <= deadlineDate;
}
