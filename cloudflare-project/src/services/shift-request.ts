// ぎゅう丸シフト管理システム - シフト希望サービス（ShiftRequestService.gs の移植）

import * as dao from '../db/dao';
import { REQUEST_TYPES } from '../config';
import type { ShiftRequest, ShiftRequestInput, RequestSummary, ApiResult, StaffListItem } from '../types';

// シフト希望を一括提出する
export async function submitShiftRequests(
  db: D1Database, storeId: number, staffId: string, yearMonth: string, requests: ShiftRequestInput[]
): Promise<ApiResult> {
  if (!staffId || !yearMonth || !requests) {
    return { success: false, message: '入力データが不足しています' };
  }

  const staff = await dao.getStaffDataById(db, staffId);
  if (!staff) {
    return { success: false, message: 'スタッフが見つかりません' };
  }

  await dao.saveShiftRequests(db, storeId, staffId, yearMonth, requests);
  await dao.addLog(db, storeId, staffId, 'シフト希望提出', yearMonth + ' ' + requests.length + '日分');

  return {
    success: true,
    message: requests.length + '日分のシフト希望を提出しました',
  };
}

// 自分のシフト希望を取得する
export async function getMyRequests(db: D1Database, staffId: string, yearMonth: string): Promise<ShiftRequest[]> {
  return dao.getShiftRequestsByStaff(db, staffId, yearMonth);
}

// 全スタッフの希望を取得する（管理者用）
export async function getAllRequests(db: D1Database, storeId: number, yearMonth: string): Promise<ShiftRequest[]> {
  return dao.getAllShiftRequests(db, storeId, yearMonth);
}

// シフト希望の提出状況サマリーを取得する
export async function getRequestSummary(db: D1Database, storeId: number, yearMonth: string): Promise<RequestSummary> {
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  const allRequests = await dao.getAllShiftRequests(db, storeId, yearMonth);

  // 提出済みスタッフIDを集める
  const submittedStaffIds = new Set<string>();
  for (const req of allRequests) {
    submittedStaffIds.add(req.staffId);
  }

  let submittedCount = 0;
  const notSubmitted: StaffListItem[] = [];

  for (const staff of allStaff) {
    if (submittedStaffIds.has(staff.id)) {
      submittedCount++;
    } else {
      notSubmitted.push({ id: staff.id, name: staff.name, kana: staff.kana, position: staff.position });
    }
  }

  // 日別の希望集計
  const dailySummary: Record<string, { work: number; off: number; either: number; total: number }> = {};
  for (const req of allRequests) {
    if (!dailySummary[req.date]) {
      dailySummary[req.date] = { work: 0, off: 0, either: 0, total: 0 };
    }
    if (req.type === REQUEST_TYPES.WORK) dailySummary[req.date].work++;
    else if (req.type === REQUEST_TYPES.OFF) dailySummary[req.date].off++;
    else if (req.type === REQUEST_TYPES.EITHER) dailySummary[req.date].either++;
    dailySummary[req.date].total++;
  }

  return {
    totalStaff: allStaff.length,
    submittedCount,
    notSubmitted,
    dailySummary,
  };
}
