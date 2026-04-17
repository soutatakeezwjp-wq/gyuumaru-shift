// ぎゅう丸シフト管理システム - シフト表作成・管理サービス（ShiftScheduleService.gs の移植）

import * as dao from '../db/dao';
import type { DB } from '../db/supabase';
import { getCurrentStoreInfo } from './auth';
import { REQUEST_TYPES, SHIFT_STATUS, SHIFT_CREATION, TIME_CONFIG, POSITIONS } from '../config';
import { getAllDatesInMonth, timeToMinutes, calcHoursDiff, addDays, getMonday, getDayOfWeek } from '../utils';
import { isWeekendOrHoliday } from '../holidays';
import type { ShiftSchedule, StaffData, ApiResult, TimeSlotStaffing } from '../types';

// シフト表を自動作成する（時間帯別必要人数対応版）
export async function generateAutoShift(db: DB, storeId: number, yearMonth: string): Promise<ApiResult & { warnings?: string[] }> {
  const storeInfo = await getCurrentStoreInfo(db, storeId);
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  const allRequests = await dao.getAllShiftRequests(db, storeId, yearMonth);

  if (allStaff.length === 0) {
    return { success: false, warnings: [], message: 'スタッフが登録されていません' };
  }

  // 時間帯別必要人数を取得
  const timeSlots = storeInfo.timeSlotStaffing;

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

  // 各スタッフの割当管理
  const assignedMap: Record<string, string[]> = {};
  const staffShiftMap: Record<string, Record<string, { startTime: string; endTime: string }>> = {};
  for (const staff of allStaff) {
    staffShiftMap[staff.id] = {};
  }

  // Step 1: 出勤希望をそのまま仮配置
  for (const staff of allStaff) {
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

  // Step 2: 正社員を配置（通しシフト。ただし1日の実働は8h上限を考慮）
  const fulltimeStaff = allStaff.filter(s => s.employmentType === '正社員');
  const parttimeStaff = allStaff.filter(s => s.employmentType !== '正社員');

  // 正社員はランチ+ディナー(間に休憩)で配置
  // 例: 10:00-14:00 + 休憩1h + 15:00-22:00 = 実働11h → 10:00-22:00 (休憩60分込み)
  const fullStart = timeSlots.length > 0 ? timeSlots[0].start : storeInfo.openTime;
  const fullEnd = timeSlots.length > 0 ? timeSlots[timeSlots.length - 1].end : storeInfo.closeTime;

  for (const date of dates) {
    const candReqCheck = (staffId: string) => {
      const req = (requestMap[staffId] || {})[date];
      return req && req.type === REQUEST_TYPES.OFF;
    };

    for (const ftStaff of fulltimeStaff) {
      if ((assignedMap[date] || []).includes(ftStaff.id)) continue;
      if (candReqCheck(ftStaff.id)) continue;

      const weeklyLimit = TIME_CONFIG.FULLTIME_WEEKLY_LIMIT;
      if (!checkConstraints(ftStaff.id, date, fullStart, fullEnd, staffShiftMap, weeklyLimit)) continue;

      const shift = {
        staffId: ftStaff.id,
        date,
        startTime: fullStart,
        endTime: fullEnd,
        status: SHIFT_STATUS.DRAFT,
        creationMethod: SHIFT_CREATION.AUTO,
      };
      schedules.push(shift);
      if (!assignedMap[date]) assignedMap[date] = [];
      assignedMap[date].push(ftStaff.id);
      staffShiftMap[ftStaff.id][date] = { startTime: shift.startTime, endTime: shift.endTime };
    }
  }

  // --- 均等化のための集計関数 ---
  function countMonthlyShifts(staffId: string): number {
    return Object.keys(staffShiftMap[staffId] || {}).length;
  }
  function calcMonthlyHours(staffId: string): number {
    let total = 0;
    const shifts = staffShiftMap[staffId] || {};
    for (const d of Object.keys(shifts)) {
      total += calcHoursDiff(shifts[d].startTime, shifts[d].endTime);
    }
    return total;
  }
  function countWeekendShifts(staffId: string): number {
    let count = 0;
    const shifts = staffShiftMap[staffId] || {};
    for (const d of Object.keys(shifts)) {
      // 祝日も土日扱いでカウント
      if (isWeekendOrHoliday(d)) count++;
    }
    return count;
  }

  // あるスタッフのシフトが特定の時間帯をカバーしているかチェック
  function coversSlot(staffId: string, date: string, slotStart: string, slotEnd: string): boolean {
    const shift = (staffShiftMap[staffId] || {})[date];
    if (!shift) return false;
    const shiftS = timeToMinutes(shift.startTime);
    const shiftE = timeToMinutes(shift.endTime);
    const slotS = timeToMinutes(slotStart);
    const slotE = timeToMinutes(slotEnd);
    return shiftS <= slotS && shiftE >= slotE;
  }

  // Step 3: 時間帯別に不足を特定してアルバイトを配置
  type SlotShortage = {
    date: string;
    slotStart: string;
    slotEnd: string;
    position: string;
    needed: number;
    current: number;
  };
  const slotShortages: SlotShortage[] = [];

  for (const date of dates) {
    // 祝日も土日扱いで必要人数を切り替え
    const isWeekend = isWeekendOrHoliday(date);

    for (const slot of timeSlots) {
      // 平日/土日祝で必要人数を切り替え
      const hallNeeded = isWeekend
        ? (slot.weekendHall ?? slot.hall ?? 4)
        : (slot.weekdayHall ?? slot.hall ?? 4);
      const kitchenNeeded = isWeekend
        ? (slot.weekendKitchen ?? slot.kitchen ?? 3)
        : (slot.weekdayKitchen ?? slot.kitchen ?? 3);

      // この時間帯をカバーしているスタッフをポジション別にカウント
      let hallCount = 0;
      let kitchenCount = 0;
      const assigned = assignedMap[date] || [];
      for (const staffId of assigned) {
        if (coversSlot(staffId, date, slot.start, slot.end)) {
          const pos = staffMap[staffId]?.position || POSITIONS.HALL;
          if (pos === POSITIONS.HALL) hallCount++;
          else kitchenCount++;
        }
      }

      if (hallCount < hallNeeded) {
        slotShortages.push({ date, slotStart: slot.start, slotEnd: slot.end, position: POSITIONS.HALL, needed: hallNeeded, current: hallCount });
      }
      if (kitchenCount < kitchenNeeded) {
        slotShortages.push({ date, slotStart: slot.start, slotEnd: slot.end, position: POSITIONS.KITCHEN, needed: kitchenNeeded, current: kitchenCount });
      }
    }
  }

  // シャッフルして偏りを防ぐ
  for (let si = slotShortages.length - 1; si > 0; si--) {
    const rj = Math.floor(Math.random() * (si + 1));
    const tmp = slotShortages[si]; slotShortages[si] = slotShortages[rj]; slotShortages[rj] = tmp;
  }

  // 不足を補充
  for (const shortage of slotShortages) {
    // 再カウント（他のスロットの補充で既にカバーされている場合がある）
    let currentCount = 0;
    const assigned = assignedMap[shortage.date] || [];
    for (const staffId of assigned) {
      if (coversSlot(staffId, shortage.date, shortage.slotStart, shortage.slotEnd)) {
        const pos = staffMap[staffId]?.position || POSITIONS.HALL;
        if (pos === shortage.position) currentCount++;
      }
    }
    const need = shortage.needed - currentCount;
    if (need <= 0) continue;

    // 祝日も土日扱いで判定
    const isShortageWeekend = isWeekendOrHoliday(shortage.date);

    const candidates: Array<{ staffId: string; score: number }> = [];

    for (const candidate of parttimeStaff) {
      const candidatePosition = candidate.position || POSITIONS.HALL;
      if (candidatePosition !== shortage.position) continue;

      // 既にこの日に割当済みならスキップ
      if ((assignedMap[shortage.date] || []).includes(candidate.id)) continue;

      const candReq = (requestMap[candidate.id] || {})[shortage.date];
      if (candReq && candReq.type === REQUEST_TYPES.OFF) continue;

      const candidateWeeklyLimit = candidate.weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT;
      if (!checkConstraints(candidate.id, shortage.date, shortage.slotStart, shortage.slotEnd, staffShiftMap, candidateWeeklyLimit)) continue;

      let score = 0;
      if (candReq && candReq.type === REQUEST_TYPES.EITHER) score -= 50;
      score += countMonthlyShifts(candidate.id) * 10;
      if (isShortageWeekend) score += countWeekendShifts(candidate.id) * 15;
      score += calcMonthlyHours(candidate.id) * 0.5;
      score += Math.random() * 3;
      candidates.push({ staffId: candidate.id, score });
    }

    candidates.sort((a, b) => a.score - b.score);
    const fillCount = Math.min(need, candidates.length);

    for (let i = 0; i < fillCount; i++) {
      const fillStaff = candidates[i];
      const shift = {
        staffId: fillStaff.staffId,
        date: shortage.date,
        startTime: shortage.slotStart,
        endTime: shortage.slotEnd,
        status: SHIFT_STATUS.DRAFT,
        creationMethod: SHIFT_CREATION.AUTO,
      };
      schedules.push(shift);
      if (!assignedMap[shortage.date]) assignedMap[shortage.date] = [];
      assignedMap[shortage.date].push(fillStaff.staffId);
      staffShiftMap[fillStaff.staffId][shortage.date] = { startTime: shift.startTime, endTime: shift.endTime };
    }

    if (fillCount < need) {
      const dayOfWeek = getDayOfWeek(shortage.date);
      const parts = shortage.date.split('-');
      const warnMsg = parseInt(parts[1]) + '/' + parseInt(parts[2]) + '(' + dayOfWeek + ') ' +
        shortage.slotStart + '-' + shortage.slotEnd + ' ' + shortage.position + ': 必要' + shortage.needed + '人に対して' +
        (currentCount + fillCount) + '人しか確保できません';
      warnings.push(warnMsg);
    }
  }

  // 余剰削減は自動配置では行わない（「余剰を自動解消」ボタンで別途実行）

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

// 余剰を自動解消する
// 毎パスでDBから再取得し、全時間帯の余剰がなくなるまで繰り返す
export async function resolveSurplus(db: DB, storeId: number, yearMonth: string): Promise<ApiResult & { changes?: string[] }> {
  const storeInfo = await getCurrentStoreInfo(db, storeId);
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  const timeSlots = storeInfo.timeSlotStaffing;

  const staffMap: Record<string, StaffData> = {};
  for (const s of allStaff) staffMap[s.id] = s;

  const dates = getAllDatesInMonth(yearMonth);
  const changes: string[] = [];

  // 最大5パスで余剰を解消（各パスでDBから最新データを再取得）
  for (let pass = 0; pass < 5; pass++) {
    const schedules = await dao.getShiftSchedules(db, storeId, yearMonth);
    if (schedules.length === 0) break;

    // 月間労働時間を計算
    const staffHours: Record<string, number> = {};
    for (const s of schedules) {
      if (!staffHours[s.staffId]) staffHours[s.staffId] = 0;
      staffHours[s.staffId] += calcHoursDiff(s.startTime, s.endTime);
    }

    let changedThisPass = 0;

    for (const date of dates) {
      // 祝日も土日扱いで判定
      const isWeekend = isWeekendOrHoliday(date);
      const dayShifts = schedules.filter(s => s.date === date);

      for (const slot of timeSlots) {
        const hallNeeded = isWeekend ? (slot.weekendHall ?? slot.hall ?? 4) : (slot.weekdayHall ?? slot.hall ?? 4);
        const kitchenNeeded = isWeekend ? (slot.weekendKitchen ?? slot.kitchen ?? 3) : (slot.weekdayKitchen ?? slot.kitchen ?? 3);
        const slotS = timeToMinutes(slot.start);
        const slotE = timeToMinutes(slot.end);

        // カバーしている人（シフトが時間帯と重なる人）
        const hallCov: ShiftSchedule[] = [];
        const kitchenCov: ShiftSchedule[] = [];
        for (const shift of dayShifts) {
          const shS = timeToMinutes(shift.startTime);
          const shE = timeToMinutes(shift.endTime);
          if (shS < slotE && shE > slotS) {
            const pos = staffMap[shift.staffId]?.position || POSITIONS.HALL;
            if (pos === POSITIONS.HALL) hallCov.push(shift);
            else kitchenCov.push(shift);
          }
        }

        // 余剰を解消する
        async function fix(covering: ShiftSchedule[], needed: number) {
          if (covering.length <= needed) return;
          // 月間時間が多い人から（正社員は後回し）
          const sorted = covering.slice().sort((a, b) => {
            const aFt = staffMap[a.staffId]?.employmentType === '正社員' ? 1 : 0;
            const bFt = staffMap[b.staffId]?.employmentType === '正社員' ? 1 : 0;
            if (aFt !== bFt) return aFt - bFt;
            return (staffHours[b.staffId] || 0) - (staffHours[a.staffId] || 0);
          });

          let excess = covering.length - needed;
          for (const shift of sorted) {
            if (excess <= 0) break;
            const shS = timeToMinutes(shift.startTime);
            const shE = timeToMinutes(shift.endTime);
            const name = staffMap[shift.staffId]?.name || shift.staffId;

            if (shS >= slotS && shE <= slotE) {
              // 完全にスロット内 → 削除
              await dao.deleteShiftScheduleEntry(db, storeId, shift.id);
              changes.push(name + ' ' + date + ' ' + shift.startTime + '-' + shift.endTime + ' 削除');
              changedThisPass++;
              excess--;
            } else if (shS < slotS) {
              // 前から始まっている → スロット開始で切る
              await dao.updateShiftScheduleEntry(db, storeId, shift.id, { endTime: slot.start });
              changes.push(name + ' ' + date + ' ' + shift.startTime + '-' + shift.endTime + ' → ' + shift.startTime + '-' + slot.start);
              changedThisPass++;
              excess--;
            } else if (shE > slotE) {
              // 後ろに延びている → スロット終了から開始
              await dao.updateShiftScheduleEntry(db, storeId, shift.id, { startTime: slot.end });
              changes.push(name + ' ' + date + ' ' + shift.startTime + '-' + shift.endTime + ' → ' + slot.end + '-' + shift.endTime);
              changedThisPass++;
              excess--;
            }
          }
        }

        await fix(hallCov, hallNeeded);
        await fix(kitchenCov, kitchenNeeded);
      }
    }

    // このパスで変更がなければ終了
    if (changedThisPass === 0) break;
  }

  if (changes.length > 0) {
    await dao.addLog(db, storeId, '管理者', '余剰自動解消', yearMonth + ' ' + changes.length + '件変更');
  }

  return {
    success: true,
    changes,
    message: changes.length > 0
      ? changes.length + '件のシフトを調整して余剰を解消しました'
      : '余剰はありませんでした',
  };
}

// 人員不足テキストを自動生成する（LINE配信用）
export async function generateShortageText(db: DB, storeId: number, yearMonth: string): Promise<ApiResult & { text?: string }> {
  const storeInfo = await getCurrentStoreInfo(db, storeId);
  const schedules = await dao.getShiftSchedules(db, storeId, yearMonth);
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  const timeSlots = storeInfo.timeSlotStaffing;

  const staffMap: Record<string, StaffData> = {};
  for (const s of allStaff) staffMap[s.id] = s;

  // スタッフシフトマップを構築
  const staffShiftMap: Record<string, Record<string, { startTime: string; endTime: string }>> = {};
  const assignedMap: Record<string, string[]> = {};
  for (const s of schedules) {
    if (!staffShiftMap[s.staffId]) staffShiftMap[s.staffId] = {};
    staffShiftMap[s.staffId][s.date] = { startTime: s.startTime, endTime: s.endTime };
    if (!assignedMap[s.date]) assignedMap[s.date] = [];
    assignedMap[s.date].push(s.staffId);
  }

  const dates = getAllDatesInMonth(yearMonth);
  const shortageLines: string[] = [];

  for (const date of dates) {
    // 祝日も土日扱いで判定
    const isWeekend = isWeekendOrHoliday(date);

    for (const slot of timeSlots) {
      const hallNeeded = isWeekend ? (slot.weekendHall ?? slot.hall ?? 4) : (slot.weekdayHall ?? slot.hall ?? 4);
      const kitchenNeeded = isWeekend ? (slot.weekendKitchen ?? slot.kitchen ?? 3) : (slot.weekdayKitchen ?? slot.kitchen ?? 3);

      let hallCount = 0;
      let kitchenCount = 0;
      const assigned = assignedMap[date] || [];
      for (const staffId of assigned) {
        const shift = (staffShiftMap[staffId] || {})[date];
        if (!shift) continue;
        const shiftS = timeToMinutes(shift.startTime);
        const shiftE = timeToMinutes(shift.endTime);
        const slotS = timeToMinutes(slot.start);
        const slotE = timeToMinutes(slot.end);
        if (shiftS <= slotS && shiftE >= slotE) {
          const pos = staffMap[staffId]?.position || POSITIONS.HALL;
          if (pos === POSITIONS.HALL) hallCount++;
          else kitchenCount++;
        }
      }

      const dayOfWeek = getDayOfWeek(date);
      const dateParts = date.split('-');
      const dateLabel = parseInt(dateParts[1]) + '/' + parseInt(dateParts[2]) + '(' + dayOfWeek + ')';

      if (hallCount < hallNeeded) {
        const shortage = hallNeeded - hallCount;
        shortageLines.push(dateLabel + ' ' + slot.start + '~' + slot.end + ' ホール' + shortage + '名不足');
      }
      if (kitchenCount < kitchenNeeded) {
        const shortage = kitchenNeeded - kitchenCount;
        shortageLines.push(dateLabel + ' ' + slot.start + '~' + slot.end + ' キッチン' + shortage + '名不足');
      }
    }
  }

  if (shortageLines.length === 0) {
    return { success: true, message: '人員不足なし', text: '現在、人員不足の時間帯はありません。' };
  }

  const parts = yearMonth.split('-');
  let text = '【' + parseInt(parts[1]) + '月シフト 人員募集のお知らせ】\n\n';
  text += '以下の日時でスタッフが不足しています。\n出勤可能な方はご連絡ください！\n\n';
  for (const line of shortageLines) {
    text += '- ' + line + '\n';
  }
  text += '\nよろしくお願いします！';

  return { success: true, message: '人員不足テキストを生成しました', text };
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
export async function getShiftSchedule(db: DB, storeId: number, yearMonth: string): Promise<ShiftSchedule[]> {
  return dao.getShiftSchedules(db, storeId, yearMonth);
}

// 自分の確定シフトを取得する
export async function getMyShift(db: DB, storeId: number, staffId: string, yearMonth: string): Promise<ShiftSchedule[]> {
  const all = await dao.getShiftSchedules(db, storeId, yearMonth);
  return all.filter(s => s.staffId === staffId);
}

// シフト1件を更新する
export async function updateShiftEntry(db: DB, storeId: number, shiftId: string, data: Partial<{ startTime: string; endTime: string }>): Promise<ApiResult> {
  const result = await dao.updateShiftScheduleEntry(db, storeId, shiftId, data);
  if (result) {
    await dao.addLog(db, storeId, '管理者', 'シフト編集', shiftId);
    return { success: true, message: '更新しました' };
  }
  return { success: false, message: 'シフトが見つかりません' };
}

// シフト1件を追加する
export async function addShiftEntry(
  db: DB, storeId: number, data: { staffId: string; yearMonth: string; date: string; startTime: string; endTime: string }
): Promise<ApiResult & { shiftId?: string }> {
  const shiftId = await dao.addShiftScheduleEntry(db, storeId, data);
  await dao.addLog(db, storeId, '管理者', 'シフト追加', data.staffId + ' ' + data.date);
  return { success: true, shiftId, message: '追加しました' };
}

// シフト1件を削除する
export async function deleteShiftEntry(db: DB, storeId: number, shiftId: string): Promise<ApiResult> {
  const result = await dao.deleteShiftScheduleEntry(db, storeId, shiftId);
  if (result) {
    await dao.addLog(db, storeId, '管理者', 'シフト削除', shiftId);
    return { success: true, message: '削除しました' };
  }
  return { success: false, message: 'シフトが見つかりません' };
}

// シフトを全クリアする
export async function clearShift(db: DB, storeId: number, yearMonth: string): Promise<ApiResult> {
  await dao.clearShiftSchedules(db, storeId, yearMonth);
  await dao.addLog(db, storeId, '管理者', 'シフトクリア', yearMonth);
  return { success: true, message: yearMonth + 'のシフトをクリアしました' };
}

// シフトを確定する
export async function finalizeShift(db: DB, storeId: number, yearMonth: string): Promise<ApiResult> {
  await dao.updateShiftStatus(db, storeId, yearMonth, SHIFT_STATUS.CONFIRMED);
  await dao.addLog(db, storeId, '管理者', 'シフト確定', yearMonth);
  return { success: true, message: yearMonth + 'のシフトを確定しました' };
}
