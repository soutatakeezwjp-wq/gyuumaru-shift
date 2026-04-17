// ぎゅう丸シフト管理システム - 人件費計算サービス（LaborCostService.gs の移植）

import * as dao from '../db/dao';
import type { DB } from '../db/supabase';
import { getCurrentStoreInfo } from './auth';
import { EMPLOYMENT_TYPES, TIME_CONFIG } from '../config';
import { timeToMinutes, calcBreakMinutes, getMonday } from '../utils';
import { isWeekendOrHoliday } from '../holidays';
import type { StaffData, ShiftSchedule, LaborCostData, ApiResult, StoreInfo, PeakHourBonus } from '../types';

// 月間人件費を計算する
export async function calculateLaborCost(
  db: DB, storeId: number, yearMonth: string
): Promise<ApiResult & { staffCosts: LaborCostData[]; totalCost: number }> {
  const schedules = await dao.getShiftSchedules(db, storeId, yearMonth);
  const allStaff = await dao.getAllStaffData(db, storeId, true);
  const storeInfo = await getCurrentStoreInfo(db, storeId);

  if (schedules.length === 0) {
    return {
      success: false,
      staffCosts: [],
      totalCost: 0,
      message: 'この月の確定シフトがありません',
    };
  }

  // 正社員の月間上限時間を店舗設定から取得
  const monthlyLimit = storeInfo.fulltimeMonthlyLimit;

  // スタッフ情報をマップ化
  const staffMap: Record<string, StaffData> = {};
  for (const s of allStaff) {
    staffMap[s.id] = s;
  }

  // スケジュールをスタッフごとにグループ化
  const staffSchedules: Record<string, ShiftSchedule[]> = {};
  for (const s of schedules) {
    if (!staffSchedules[s.staffId]) staffSchedules[s.staffId] = [];
    staffSchedules[s.staffId].push(s);
  }

  const staffCosts: LaborCostData[] = [];
  let totalCost = 0;

  for (const staffId of Object.keys(staffSchedules)) {
    const staff = staffMap[staffId];
    if (!staff) continue;

    const shifts = staffSchedules[staffId];
    const cost = calcStaffCost(staff, shifts, staff.position || 'ホール', monthlyLimit, storeInfo);
    staffCosts.push(cost);
    totalCost += cost.totalCost;
  }

  // DBに保存
  await dao.saveLaborCosts(db, storeId, yearMonth, staffCosts);
  await dao.addLog(db, storeId, '管理者', '人件費計算', yearMonth + ' 合計: ' + totalCost + '円');

  return {
    success: true,
    staffCosts,
    totalCost,
    message: '人件費を計算しました(合計: ' + totalCost.toLocaleString() + '円)',
  };
}

// スタッフ1人分の人件費を計算する（内部関数）
// position: スタッフのポジション（ホール/キッチン）
// monthlyLimit: 正社員の月間上限時間（超えた分は1.3倍で計算）
// storeInfo: 店舗別の手当設定（ピーク手当・曜日手当）を読むために必要
function calcStaffCost(
  staff: StaffData,
  shifts: ShiftSchedule[],
  position: string,
  monthlyLimit: number,
  storeInfo: StoreInfo,
): LaborCostData {
  let totalMinutes = 0;
  let lateNightMinutes = 0;
  // 1-1: ピーク手当（時間帯別追加時給）の累計（円）
  let peakBonusPay = 0;
  // 1-2: 曜日手当（土日祝の追加時給）の累計（円）
  let weekendBonusPay = 0;
  const workDays = shifts.length;

  const peakBonuses: PeakHourBonus[] = storeInfo.peakHourBonuses || [];
  const weekendBonus = storeInfo.weekendBonusPerHour || 0;
  const weekdayBonus = storeInfo.weekdayBonusPerHour || 0;
  const isFulltime = staff.employmentType === EMPLOYMENT_TYPES.FULL_TIME;

  // 週ごとの労働時間を集計
  const weeklyMinutes: Record<string, number> = {};

  for (const shift of shifts) {
    let startMin = timeToMinutes(shift.startTime);
    let endMin = timeToMinutes(shift.endTime);
    if (endMin <= startMin) endMin += 24 * 60;

    const totalWorkMin = endMin - startMin;
    const breakMin = calcBreakMinutes(totalWorkMin / 60);
    const actualWorkMin = totalWorkMin - breakMin;
    totalMinutes += actualWorkMin;

    // 深夜時間の計算（22:00-翌5:00）
    const lateStart = TIME_CONFIG.LATE_NIGHT_START * 60;
    const lateEnd = (24 + TIME_CONFIG.LATE_NIGHT_END) * 60;

    const overlapStart = Math.max(startMin, lateStart);
    const overlapEnd = Math.min(endMin, lateEnd);
    if (overlapEnd > overlapStart) {
      lateNightMinutes += (overlapEnd - overlapStart);
    }

    // 1-1 ピーク手当の計算
    // アルバイト/パートのみ対象（正社員は固定月給のため別途加算しない方針）
    if (!isFulltime && peakBonuses.length > 0) {
      for (const peak of peakBonuses) {
        const pStart = timeToMinutes(peak.start);
        const pEnd = timeToMinutes(peak.end);
        const oStart = Math.max(startMin, pStart);
        const oEnd = Math.min(endMin, pEnd);
        if (oEnd > oStart) {
          const overlapHours = (oEnd - oStart) / 60;
          peakBonusPay += Math.round(overlapHours * peak.bonus);
        }
      }
    }

    // 1-2 曜日手当の計算（土日祝に追加時給）
    if (!isFulltime) {
      const isWeekend = isWeekendOrHoliday(shift.date);
      const bonus = isWeekend ? weekendBonus : weekdayBonus;
      if (bonus > 0) {
        const workHours = actualWorkMin / 60;
        weekendBonusPay += Math.round(workHours * bonus);
      }
    }

    // 週ごとの集計
    const monday = getMonday(shift.date);
    if (!weeklyMinutes[monday]) weeklyMinutes[monday] = 0;
    weeklyMinutes[monday] += actualWorkMin;
  }

  const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
  const lateNightHours = Math.round(lateNightMinutes / 60 * 100) / 100;

  // 基本給計算
  let basePay = 0;
  if (staff.employmentType === EMPLOYMENT_TYPES.FULL_TIME) {
    basePay = staff.monthlySalary || 0;
  } else {
    basePay = Math.round((staff.hourlyRate || 0) * totalHours);
  }

  // 深夜手当
  let lateNightPay = 0;
  if (lateNightHours > 0 && staff.employmentType !== EMPLOYMENT_TYPES.FULL_TIME) {
    lateNightPay = Math.round((staff.hourlyRate || 0) * lateNightHours * TIME_CONFIG.LATE_NIGHT_RATE);
  }

  // 残業手当
  let overtimePay = 0;
  // 正社員の月間上限時間フラグ
  let isOverLimit = false;
  let isDanger = false;

  if (staff.employmentType === EMPLOYMENT_TYPES.FULL_TIME) {
    // 正社員: 月間基準240h、見込み残業込み
    // 時給相当 = 月給 / 160（法定基準時間）
    // 月間240hを超えた分が追加残業、うち60hを超えた分は1.3倍
    if (totalHours > monthlyLimit) {
      const hourlyEquivalent = (staff.monthlySalary || 0) / 160;
      const overtimeHours = totalHours - monthlyLimit;
      if (overtimeHours > TIME_CONFIG.FULLTIME_OVERTIME_THRESHOLD) {
        // 60h以内は通常残業（1.0倍）、60h超は1.3倍
        const normalOT = TIME_CONFIG.FULLTIME_OVERTIME_THRESHOLD;
        const heavyOT = overtimeHours - TIME_CONFIG.FULLTIME_OVERTIME_THRESHOLD;
        overtimePay = Math.round(hourlyEquivalent * normalOT + hourlyEquivalent * heavyOT * TIME_CONFIG.FULLTIME_OVERTIME_RATE);
      } else {
        overtimePay = Math.round(hourlyEquivalent * overtimeHours);
      }
      isOverLimit = true;
    }
    // 危険ライン判定（280h超）
    if (totalHours > TIME_CONFIG.FULLTIME_DANGER_LINE) {
      isDanger = true;
    }
  } else {
    // アルバイト/パート: 週40時間超過分 × 時給 × 0.25
    const weeklyLimit = (staff.weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT) * 60;
    for (const week of Object.keys(weeklyMinutes)) {
      if (weeklyMinutes[week] > weeklyLimit) {
        const overtimeMin = weeklyMinutes[week] - weeklyLimit;
        overtimePay += Math.round((staff.hourlyRate || 0) * (overtimeMin / 60) * TIME_CONFIG.OVERTIME_RATE);
      }
    }
  }

  // 交通費
  const transportTotal = workDays * (staff.transportDaily || 0);

  return {
    staffId: staff.id,
    name: staff.name,
    employmentType: staff.employmentType,
    position,
    totalHours,
    basePay,
    lateNightPay,
    overtimePay,
    peakBonusPay,
    weekendBonusPay,
    transportTotal,
    totalCost: basePay + lateNightPay + overtimePay + peakBonusPay + weekendBonusPay + transportTotal,
    monthlyLimit,
    isOverLimit,
    isDanger,
  };
}

// 保存済みの人件費レポートを取得する
export async function getLaborCostReport(
  db: DB, storeId: number, yearMonth: string
): Promise<{ staffCosts: LaborCostData[]; totalCost: number }> {
  const costs = await dao.getLaborCosts(db, storeId, yearMonth);
  let totalCost = 0;
  for (const c of costs) {
    totalCost += c.totalCost || 0;
  }
  return { staffCosts: costs, totalCost };
}
