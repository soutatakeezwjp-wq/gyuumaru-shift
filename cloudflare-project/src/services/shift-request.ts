// ぎゅう丸シフト管理システム - シフト希望サービス（ShiftRequestService.gs の移植）

import * as dao from '../db/dao';
import type { DB } from '../db/supabase';
import { REQUEST_TYPES, SETTING_KEYS } from '../config';
import type { ShiftRequest, ShiftRequestInput, RequestSummary, ApiResult, StaffListItem, UserRole } from '../types';

// 希望提出が締切を過ぎているか判定する
// 締切日: 対象月の前月の N日 23:59:59
export async function isPastDeadline(db: DB, storeId: number, yearMonth: string): Promise<boolean> {
  const dayStr = await dao.getSetting(db, storeId, SETTING_KEYS.REQUEST_DEADLINE_DAY);
  const deadlineDay = parseInt(dayStr) || 20;

  const parts = yearMonth.split('-');
  const targetYear = parseInt(parts[0]);
  const targetMonth = parseInt(parts[1]);

  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }

  const deadlineDate = new Date(prevYear, prevMonth - 1, deadlineDay, 23, 59, 59);
  return new Date() > deadlineDate;
}

// シフト希望を一括提出する
// role が 'staff' の場合は締切後の提出をブロックする
export async function submitShiftRequests(
  db: DB,
  storeId: number,
  staffId: string,
  yearMonth: string,
  requests: ShiftRequestInput[],
  role: UserRole = 'staff'
): Promise<ApiResult> {
  if (!staffId || !yearMonth || !requests) {
    return { success: false, message: '入力データが不足しています' };
  }

  const staff = await dao.getStaffDataById(db, staffId);
  if (!staff) {
    return { success: false, message: 'スタッフが見つかりません' };
  }

  // 新機能5: 締切後はスタッフからの変更を拒否（店長・本部はオーバーライド可）
  if (role === 'staff') {
    const past = await isPastDeadline(db, storeId, yearMonth);
    if (past) {
      return {
        success: false,
        message: '提出締切を過ぎています。シフト変更が必要な場合は店長へ直接ご連絡ください。',
      };
    }
  }

  await dao.saveShiftRequests(db, storeId, staffId, yearMonth, requests);
  await dao.addLog(db, storeId, staffId, 'シフト希望提出', yearMonth + ' ' + requests.length + '日分');

  return {
    success: true,
    message: requests.length + '日分のシフト希望を提出しました',
  };
}

// 自分のシフト希望を取得する
export async function getMyRequests(db: DB, staffId: string, yearMonth: string): Promise<ShiftRequest[]> {
  return dao.getShiftRequestsByStaff(db, staffId, yearMonth);
}

// 全スタッフの希望を取得する（管理者用）
export async function getAllRequests(db: DB, storeId: number, yearMonth: string): Promise<ShiftRequest[]> {
  return dao.getAllShiftRequests(db, storeId, yearMonth);
}

// シフト希望の提出状況サマリーを取得する
export async function getRequestSummary(db: DB, storeId: number, yearMonth: string): Promise<RequestSummary> {
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
