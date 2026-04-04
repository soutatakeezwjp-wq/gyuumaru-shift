// ぎゅう丸シフト管理システム - シフト表作成・管理サービス（ShiftScheduleService.gs の移植）

import * as dao from '../db/dao';
import { getCurrentStoreInfo } from './auth';
import { REQUEST_TYPES, SHIFT_STATUS, SHIFT_CREATION, TIME_CONFIG, POSITIONS } from '../config';
import { getAllDatesInMonth, timeToMinutes, calcHoursDiff, addDays, getMonday, getDayOfWeek } from '../utils';
import type { ShiftSchedule, StaffData, ApiResult } from '../types';

// シフト表を自動作成する
export async function generateAutoShift(db: D1Database, storeId: number, yearMonth: string): Promise<ApiResult & { warnings?: string[] }> {
  const storeInfo = await getCurrentStoreInfo(db, storeId);
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  const allRequests = await dao.getAllShiftRequests(db, storeId, yearMonth);

  if (allStaff.length === 0) {
    return { success: false, warnings: [], message: 'スタッフが登録されていません' };
  }

  // スタッフ情報をIDでマップ化
  const staffMap: Record<string, StaffData> = {};
  for (const s of allStaff) {
    staffMap[s.id] = s;
  }

  // 希望データをスタッフID+日付でマップ化
  const requestMap: Record<string, Record<string, { type: string; startTime: string; endTime: string }>> = {};
  for (const req of allRequests) {
    if (!requestMap[req.staffId]) requestMap[req.staffId] = {};
    requestMap[req.staffId][req.date] = req;
  }

  const dates = getAllDatesInMonth(yearMonth);
  const schedules: Array<{ staffId: string; date: string; startTime: string; endTime: string; status: string; creationMethod: string }> = [];
  const warnings: string[] = [];

  // Step 1: 出勤希望をそのまま仮配置
  const assignedMap: Record<string, string[]> = {};
  const staffShiftMap: Record<string, Record<string, { startTime: string; endTime: string }>> = {};

  for (const staff of allStaff) {
    staffShiftMap[staff.id] = {};

    for (const date of dates) {
      const request = (requestMap[staff.id] || {})[date];

      if (request && request.type === REQUEST_TYPES.WORK) {
        const shift = {
          staffId: staff.id,
          date,
          startTime: request.startTime || storeInfo.openTime,
          endTime: request.endTime || storeInfo.closeTime,
          status: SHIFT_STATUS.DRAFT,
          creationMethod: SHIFT_CREATION.AUTO,
        };
        schedules.push(shift);
        if (!assignedMap[date]) assignedMap[date] = [];
        assignedMap[date].push(staff.id);
        staffShiftMap[staff.id][date] = { startTime: shift.startTime, endTime: shift.endTime };
      }
    }
  }

  // Step 2: 各日の人数チェック・不足日特定（曜日×ポジション別）
  const shortages: Array<{ date: string; period: string; position: string; needed: number; current: number; startTime: string; endTime: string }> = [];

  for (const d of dates) {
    const assigned = assignedMap[d] || [];

    // 土日かどうかを判定（0=日, 6=土）
    const dateObj = new Date(d);
    const dayOfWeekNum = dateObj.getDay();
    const isWeekend = (dayOfWeekNum === 0 || dayOfWeekNum === 6);

    // 曜日に応じた最低人数を決定
    const hallMin = isWeekend ? storeInfo.weekendHallMin : storeInfo.weekdayHallMin;
    const kitchenMin = isWeekend ? storeInfo.weekendKitchenMin : storeInfo.weekdayKitchenMin;

    // ポジション別にカウント
    let hallCount = 0;
    let kitchenCount = 0;

    for (const staffId of assigned) {
      const s = staffShiftMap[staffId][d];
      if (s) {
        const pos = staffMap[staffId]?.position || POSITIONS.HALL;
        if (pos === POSITIONS.HALL) {
          hallCount++;
        } else if (pos === POSITIONS.KITCHEN) {
          kitchenCount++;
        }
      }
    }

    // ホールの不足チェック
    if (hallCount < hallMin) {
      shortages.push({
        date: d, period: isWeekend ? '土日' : '平日', position: POSITIONS.HALL,
        needed: hallMin, current: hallCount,
        startTime: storeInfo.openTime, endTime: storeInfo.closeTime,
      });
    }
    // キッチンの不足チェック
    if (kitchenCount < kitchenMin) {
      shortages.push({
        date: d, period: isWeekend ? '土日' : '平日', position: POSITIONS.KITCHEN,
        needed: kitchenMin, current: kitchenCount,
        startTime: storeInfo.openTime, endTime: storeInfo.closeTime,
      });
    }
  }

  // --- 均等化のための集計関数 ---
  // あるスタッフの現時点での月間シフト回数を数える
  function countMonthlyShifts(staffId: string): number {
    return Object.keys(staffShiftMap[staffId] || {}).length;
  }

  // あるスタッフの現時点での月間労働時間を計算する
  function calcMonthlyHours(staffId: string): number {
    let total = 0;
    const shifts = staffShiftMap[staffId] || {};
    for (const date of Object.keys(shifts)) {
      total += calcHoursDiff(shifts[date].startTime, shifts[date].endTime);
    }
    return total;
  }

  // あるスタッフの現時点での土日シフト回数を数える
  function countWeekendShifts(staffId: string): number {
    let count = 0;
    const shifts = staffShiftMap[staffId] || {};
    for (const date of Object.keys(shifts)) {
      const dow = new Date(date).getDay();
      if (dow === 0 || dow === 6) count++;
    }
    return count;
  }

  // 不足日リストをシャッフルして、特定の日付が常に先に処理されないようにする
  for (let si = shortages.length - 1; si > 0; si--) {
    const rj = Math.floor(Math.random() * (si + 1));
    const tmp = shortages[si]; shortages[si] = shortages[rj]; shortages[rj] = tmp;
  }

  // Step 3: 不足日を補充（均等化スコアで候補者を公平に選ぶ）
  for (const shortage of shortages) {
    const need = shortage.needed - shortage.current;

    // この日が土日かどうか
    const shortageDow = new Date(shortage.date).getDay();
    const isShortageWeekend = (shortageDow === 0 || shortageDow === 6);

    const candidates: Array<{ staffId: string; score: number }> = [];

    for (const candidate of allStaff) {
      // 不足しているポジションと同じポジションのスタッフのみ候補にする
      const candidatePosition = candidate.position || POSITIONS.HALL;
      if (candidatePosition !== shortage.position) continue;

      const alreadyAssigned = (assignedMap[shortage.date] || []).includes(candidate.id);
      if (alreadyAssigned) continue;

      const candReq = (requestMap[candidate.id] || {})[shortage.date];
      if (candReq && candReq.type === REQUEST_TYPES.OFF) continue;

      // 正社員は週60h、アルバイトは週40hが上限
      var candidateWeeklyLimit = candidate.employmentType === '正社員' ? TIME_CONFIG.FULLTIME_WEEKLY_LIMIT : (candidate.weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT);
      if (!checkConstraints(candidate.id, shortage.date, shortage.startTime, shortage.endTime, staffShiftMap, candidateWeeklyLimit)) {
        continue;
      }

      // --- 均等化スコアの計算（低いほど優先される） ---
      let score = 0;

      // (1) 「どちらでも」の人は優先（スコアを下げる）
      if (candReq && candReq.type === REQUEST_TYPES.EITHER) {
        score -= 50;
      }

      // (2) 月間シフト回数が少ない人を優先（最重要）
      score += countMonthlyShifts(candidate.id) * 10;

      // (3) 土日シフトの場合、土日出勤回数が少ない人を優先
      if (isShortageWeekend) {
        score += countWeekendShifts(candidate.id) * 15;
      }

      // (4) 月間労働時間が少ない人を優先
      score += calcMonthlyHours(candidate.id) * 0.5;

      // (5) 同スコアの場合にランダムで散らす（登録順の偏りを防ぐ）
      score += Math.random() * 3;

      candidates.push({ staffId: candidate.id, score });
    }

    // スコアが低い（=負担が少ない）人から選ぶ
    candidates.sort((a, b) => a.score - b.score);

    const fillCount = Math.min(need, candidates.length);
    for (let i = 0; i < fillCount; i++) {
      const fillStaff = candidates[i];
      const fillShift = {
        staffId: fillStaff.staffId,
        date: shortage.date,
        startTime: shortage.startTime,
        endTime: shortage.endTime,
        status: SHIFT_STATUS.DRAFT,
        creationMethod: SHIFT_CREATION.AUTO,
      };
      schedules.push(fillShift);
      if (!assignedMap[shortage.date]) assignedMap[shortage.date] = [];
      assignedMap[shortage.date].push(fillStaff.staffId);
      staffShiftMap[fillStaff.staffId][shortage.date] = { startTime: fillShift.startTime, endTime: fillShift.endTime };
    }

    if (fillCount < need) {
      const dayOfWeek = getDayOfWeek(shortage.date);
      const parts = shortage.date.split('-');
      const warnMsg = parseInt(parts[1]) + '/' + parseInt(parts[2]) + '(' + dayOfWeek + ') ' +
        shortage.period + ' ' + shortage.position + ': 必要' + shortage.needed + '人に対して' +
        (shortage.current + fillCount) + '人しか確保できません';
      warnings.push(warnMsg);
    }
  }

  // Step 4: 結果をDBに書き込む
  if (schedules.length > 0) {
    await dao.saveShiftSchedules(db, storeId, yearMonth, schedules);
    await dao.addLog(db, storeId, '管理者', 'シフト自動作成', yearMonth + ' ' + schedules.length + '件');
  }

  return {
    success: true,
    warnings,
    message: schedules.length + '件のシフトを作成しました' +
      (warnings.length > 0 ? '(' + warnings.length + '件の警告あり)' : ''),
  };
}

// 制約チェック（内部関数）
function checkConstraints(
  staffId: string, date: string, startTime: string, endTime: string,
  staffShiftMap: Record<string, Record<string, { startTime: string; endTime: string }>>,
  weeklyLimit: number
): boolean {
  const shifts = staffShiftMap[staffId] || {};

  // 連勤チェック（6日以内）
  let consecutive = 0;
  for (let c = -6; c <= 6; c++) {
    const checkDate = addDays(date, c);
    if (shifts[checkDate] || c === 0) {
      consecutive++;
      if (consecutive > TIME_CONFIG.MAX_CONSECUTIVE_DAYS) return false;
    } else {
      consecutive = 0;
    }
  }

  // インターバルチェック（前日との間隔）
  const prevDate = addDays(date, -1);
  if (shifts[prevDate]) {
    const prevEnd = timeToMinutes(shifts[prevDate].endTime);
    const thisStart = timeToMinutes(startTime);
    const intervalMinutes = (24 * 60 - prevEnd) + thisStart;
    if (intervalMinutes < TIME_CONFIG.MIN_INTERVAL_HOURS * 60) return false;
  }

  // 週上限チェック
  const monday = getMonday(date);
  let weekTotal = 0;
  for (let w = 0; w < 7; w++) {
    const weekDate = addDays(monday, w);
    if (shifts[weekDate]) {
      weekTotal += calcHoursDiff(shifts[weekDate].startTime, shifts[weekDate].endTime);
    }
  }
  const newHours = calcHoursDiff(startTime, endTime);
  if (weekTotal + newHours > (weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT)) return false;

  return true;
}

// 確定シフト表を取得する
export async function getShiftSchedule(db: D1Database, storeId: number, yearMonth: string): Promise<ShiftSchedule[]> {
  return dao.getShiftSchedules(db, storeId, yearMonth);
}

// 自分の確定シフトを取得する
export async function getMyShift(db: D1Database, storeId: number, staffId: string, yearMonth: string): Promise<ShiftSchedule[]> {
  const all = await dao.getShiftSchedules(db, storeId, yearMonth);
  return all.filter(s => s.staffId === staffId);
}

// シフト1件を更新する
export async function updateShiftEntry(db: D1Database, storeId: number, shiftId: string, data: Partial<{ startTime: string; endTime: string }>): Promise<ApiResult> {
  const result = await dao.updateShiftScheduleEntry(db, shiftId, data);
  if (result) {
    await dao.addLog(db, storeId, '管理者', 'シフト編集', shiftId);
    return { success: true, message: '更新しました' };
  }
  return { success: false, message: 'シフトが見つかりません' };
}

// シフト1件を追加する
export async function addShiftEntry(
  db: D1Database, storeId: number, data: { staffId: string; yearMonth: string; date: string; startTime: string; endTime: string }
): Promise<ApiResult & { shiftId?: string }> {
  const shiftId = await dao.addShiftScheduleEntry(db, storeId, data);
  await dao.addLog(db, storeId, '管理者', 'シフト追加', data.staffId + ' ' + data.date);
  return { success: true, shiftId, message: '追加しました' };
}

// シフト1件を削除する
export async function deleteShiftEntry(db: D1Database, storeId: number, shiftId: string): Promise<ApiResult> {
  const result = await dao.deleteShiftScheduleEntry(db, shiftId);
  if (result) {
    await dao.addLog(db, storeId, '管理者', 'シフト削除', shiftId);
    return { success: true, message: '削除しました' };
  }
  return { success: false, message: 'シフトが見つかりません' };
}

// シフトを全クリアする
export async function clearShift(db: D1Database, storeId: number, yearMonth: string): Promise<ApiResult> {
  await dao.clearShiftSchedules(db, storeId, yearMonth);
  await dao.addLog(db, storeId, '管理者', 'シフトクリア', yearMonth);
  return { success: true, message: yearMonth + 'のシフトをクリアしました' };
}

// シフトを確定する
export async function finalizeShift(db: D1Database, storeId: number, yearMonth: string): Promise<ApiResult> {
  await dao.updateShiftStatus(db, storeId, yearMonth, SHIFT_STATUS.CONFIRMED);
  await dao.addLog(db, storeId, '管理者', 'シフト確定', yearMonth);
  return { success: true, message: yearMonth + 'のシフトを確定しました' };
}
