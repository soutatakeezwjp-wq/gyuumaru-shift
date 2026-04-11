// ぎゅう丸シフト管理システム - スタッフ管理サービス（StaffService.gs の移植・Supabase版）

import * as dao from '../db/dao';
import type { DB } from '../db/supabase';
import type { StaffData, ApiResult } from '../types';
import * as authService from './auth';

// スタッフ詳細を取得する
export async function getStaffById(db: DB, staffId: string): Promise<StaffData | null> {
  return dao.getStaffDataById(db, staffId);
}

// 全スタッフを取得する（在籍者のみ）
export async function getAllStaff(db: DB, storeId: number): Promise<StaffData[]> {
  return dao.getAllStaffData(db, storeId, true);
}

// スタッフを新規登録する
export async function addStaff(
  db: DB,
  storeId: number,
  staffData: Partial<StaffData>
): Promise<ApiResult & { staffId?: string }> {
  if (!staffData.name) {
    return { success: false, message: '氏名は必須です' };
  }

  const staffId = await dao.addStaffData(db, storeId, staffData);
  await dao.addLog(db, storeId, '管理者', 'スタッフ追加', staffData.name + ' (' + staffId + ')');

  return {
    success: true,
    staffId,
    message: staffData.name + 'さんを登録しました',
  };
}

// スタッフ情報を更新する
export async function updateStaff(
  db: DB,
  storeId: number,
  staffId: string,
  staffData: Partial<StaffData>
): Promise<ApiResult> {
  const result = await dao.updateStaffData(db, staffId, staffData);
  if (result) {
    await dao.addLog(db, storeId, '管理者', 'スタッフ更新', staffId);
    return { success: true, message: '更新しました' };
  }
  return { success: false, message: 'スタッフが見つかりません' };
}

// スタッフを退職処理する（論理削除・管理者パスワード必須）
// adminPassword: 店長 or 本部管理者のパスワード
// operator: ログに残す処理者の名前
export async function retireStaffWithAuth(
  db: DB,
  storeId: number,
  staffId: string,
  adminPassword: string,
  operator: string,
  reason: string
): Promise<ApiResult> {
  // 管理者パスワードを検証する（店舗ごとの管理者パスワード）
  const passwordOk = await authService.verifyAdminPassword(db, storeId, adminPassword);
  if (!passwordOk) {
    return { success: false, message: '管理者パスワードが正しくありません' };
  }

  const staff = await dao.getStaffDataById(db, staffId);
  if (!staff) {
    return { success: false, message: 'スタッフが見つかりません' };
  }

  const result = await dao.retireStaff(db, staffId, operator, reason);
  if (result) {
    await dao.addLog(db, storeId, operator, 'スタッフ退職', staff.name + ' (' + staffId + ') 理由:' + reason);
    return { success: true, message: staff.name + 'さんを退職処理しました（データは保持されます）' };
  }
  return { success: false, message: '処理に失敗しました' };
}
