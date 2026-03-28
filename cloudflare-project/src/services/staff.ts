// ぎゅう丸シフト管理システム - スタッフ管理サービス（StaffService.gs の移植）

import * as dao from '../db/dao';
import { STAFF_STATUS } from '../config';
import type { StaffData, ApiResult } from '../types';

// スタッフ詳細を取得する
export async function getStaffById(db: D1Database, staffId: string): Promise<StaffData | null> {
  return dao.getStaffDataById(db, staffId);
}

// 全スタッフを取得する（在籍者のみ）
export async function getAllStaff(db: D1Database, storeId: number): Promise<StaffData[]> {
  return dao.getAllStaffData(db, storeId, true);
}

// スタッフを新規登録する
export async function addStaff(db: D1Database, storeId: number, staffData: Partial<StaffData>): Promise<ApiResult & { staffId?: string }> {
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
export async function updateStaff(db: D1Database, storeId: number, staffId: string, staffData: Partial<StaffData>): Promise<ApiResult> {
  const result = await dao.updateStaffData(db, staffId, staffData);
  if (result) {
    await dao.addLog(db, storeId, '管理者', 'スタッフ更新', staffId);
    return { success: true, message: '更新しました' };
  }
  return { success: false, message: 'スタッフが見つかりません' };
}

// スタッフを退職処理する（論理削除）
export async function retireStaff(db: D1Database, storeId: number, staffId: string): Promise<ApiResult> {
  const staff = await dao.getStaffDataById(db, staffId);
  if (!staff) {
    return { success: false, message: 'スタッフが見つかりません' };
  }

  const result = await dao.updateStaffData(db, staffId, { status: STAFF_STATUS.RETIRED });
  if (result) {
    await dao.addLog(db, storeId, '管理者', 'スタッフ退職', staff.name + ' (' + staffId + ')');
    return { success: true, message: staff.name + 'さんを退職処理しました' };
  }
  return { success: false, message: '処理に失敗しました' };
}
