// ぎゅう丸シフト管理システム - データアクセスオブジェクト（Supabase版）
// 旧D1版と同じ関数シグネチャを保ち、内部だけ Supabase クライアントに置き換えている。

import { generateId, getNow, calcHoursDiff, calcBreakMinutes } from '../utils';
import { STAFF_STATUS, SHIFT_STATUS, SHIFT_CREATION, EMPLOYMENT_TYPES, TIME_CONFIG } from '../config';
import type { StaffData, ShiftRequest, ShiftSchedule, LaborCostData, ManagerAccount } from '../types';
import type { DB } from './supabase';

// ========================================
// 設定 (store_settings)
// ========================================

export async function getSettings(db: DB, storeId: number): Promise<Record<string, string>> {
  const { data, error } = await db
    .from('store_settings')
    .select('key, value')
    .eq('store_id', storeId);
  if (error) throw error;
  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    settings[row.key as string] = (row.value as string) ?? '';
  }
  return settings;
}

export async function getSetting(db: DB, storeId: number, key: string): Promise<string> {
  const { data, error } = await db
    .from('store_settings')
    .select('value')
    .eq('store_id', storeId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as string) || '';
}

export async function updateSetting(db: DB, storeId: number, key: string, value: string): Promise<void> {
  const { error } = await db
    .from('store_settings')
    .upsert({ store_id: storeId, key, value }, { onConflict: 'store_id,key' });
  if (error) throw error;
}

// ========================================
// 店舗
// ========================================

interface StoreRow {
  id: number;
  code: string;
  name: string;
  type: string;
}

export async function getStoreByCode(db: DB, code: string): Promise<StoreRow | null> {
  const { data, error } = await db
    .from('stores')
    .select('id, code, name, type')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return (data as StoreRow | null) ?? null;
}

export async function getStoreById(db: DB, storeId: number): Promise<StoreRow | null> {
  const { data, error } = await db
    .from('stores')
    .select('id, code, name, type')
    .eq('id', storeId)
    .maybeSingle();
  if (error) throw error;
  return (data as StoreRow | null) ?? null;
}

export async function getAllStores(db: DB): Promise<StoreRow[]> {
  const { data, error } = await db
    .from('stores')
    .select('id, code, name, type')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoreRow[];
}

// ========================================
// スタッフ
// ========================================

export async function getAllStaffData(db: DB, storeId: number, activeOnly: boolean): Promise<StaffData[]> {
  let query = db.from('staff').select('*').eq('store_id', storeId);
  if (activeOnly) {
    query = query.eq('status', STAFF_STATUS.ACTIVE);
  }
  const { data, error } = await query;
  if (error) throw error;
  // 正社員を先に表示、その中でフリガナ順
  const rows = (data ?? []).map(rowToStaff);
  rows.sort((a, b) => {
    const aFull = a.employmentType === EMPLOYMENT_TYPES.FULL_TIME ? 0 : 1;
    const bFull = b.employmentType === EMPLOYMENT_TYPES.FULL_TIME ? 0 : 1;
    if (aFull !== bFull) return aFull - bFull;
    return (a.kana || '').localeCompare(b.kana || '', 'ja');
  });
  return rows;
}

export async function getStaffDataById(db: DB, staffId: string): Promise<StaffData | null> {
  const { data, error } = await db
    .from('staff')
    .select('*')
    .eq('id', staffId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToStaff(data as Record<string, unknown>) : null;
}

export async function addStaffData(db: DB, storeId: number, staffData: Partial<StaffData>): Promise<string> {
  const id = generateId('STF');
  const now = getNow();
  const { error } = await db.from('staff').insert({
    id,
    store_id: storeId,
    name: staffData.name || '',
    kana: staffData.kana || '',
    employment_type: staffData.employmentType || EMPLOYMENT_TYPES.PART_TIME,
    position: staffData.position || 'ホール',
    hourly_rate: staffData.hourlyRate || 0,
    monthly_salary: staffData.monthlySalary || 0,
    transport_daily: staffData.transportDaily || 0,
    phone: staffData.phone || '',
    email: staffData.email || '',
    line_user_id: staffData.lineUserId || '',
    join_date: staffData.joinDate || now.split(' ')[0],
    weekly_limit: staffData.weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT,
    fixed_off: staffData.fixedOff || '',
    status: STAFF_STATUS.ACTIVE,
    memo: staffData.memo || '',
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return id;
}

export async function updateStaffData(db: DB, staffId: string, staffData: Partial<StaffData>): Promise<boolean> {
  const mapping: Record<string, string> = {
    name: 'name',
    kana: 'kana',
    employmentType: 'employment_type',
    position: 'position',
    hourlyRate: 'hourly_rate',
    monthlySalary: 'monthly_salary',
    transportDaily: 'transport_daily',
    phone: 'phone',
    email: 'email',
    lineUserId: 'line_user_id',
    weeklyLimit: 'weekly_limit',
    fixedOff: 'fixed_off',
    status: 'status',
    memo: 'memo',
  };
  const update: Record<string, unknown> = {};
  for (const [jsKey, dbCol] of Object.entries(mapping)) {
    const val = (staffData as Record<string, unknown>)[jsKey];
    if (val !== undefined) update[dbCol] = val;
  }
  if (Object.keys(update).length === 0) return false;
  update.updated_at = getNow();

  const { error, count } = await db
    .from('staff')
    .update(update, { count: 'exact' })
    .eq('id', staffId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// 4桁PIN（ハッシュ済み）を保存する
export async function setStaffPinHash(db: DB, staffId: string, pinHash: string): Promise<boolean> {
  const { error, count } = await db
    .from('staff')
    .update(
      {
        pin_hash: pinHash,
        pin_updated_at: new Date().toISOString(),
        pin_failed_count: 0,
        pin_locked_until: null,
        updated_at: getNow(),
      },
      { count: 'exact' }
    )
    .eq('id', staffId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// PIN認証用にハッシュとロック情報を取得する
export async function getStaffPinInfo(db: DB, staffId: string): Promise<{
  pinHash: string;
  failedCount: number;
  lockedUntil: string | null;
} | null> {
  const { data, error } = await db
    .from('staff')
    .select('pin_hash, pin_failed_count, pin_locked_until, status')
    .eq('id', staffId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.status !== STAFF_STATUS.ACTIVE) return null; // 退職者はログイン不可
  return {
    pinHash: (data.pin_hash as string) || '',
    failedCount: (data.pin_failed_count as number) || 0,
    lockedUntil: (data.pin_locked_until as string | null) || null,
  };
}

// 失敗カウントを増やし、必要ならロックする
export async function incrementPinFailure(db: DB, staffId: string, lockedUntil: string | null): Promise<void> {
  const { data: cur } = await db
    .from('staff')
    .select('pin_failed_count')
    .eq('id', staffId)
    .maybeSingle();
  const newCount = ((cur?.pin_failed_count as number) || 0) + 1;
  await db
    .from('staff')
    .update({ pin_failed_count: newCount, pin_locked_until: lockedUntil, updated_at: getNow() })
    .eq('id', staffId);
}

export async function resetPinFailure(db: DB, staffId: string): Promise<void> {
  await db
    .from('staff')
    .update({ pin_failed_count: 0, pin_locked_until: null, updated_at: getNow() })
    .eq('id', staffId);
}

// 退職処理（論理削除）
export async function retireStaff(db: DB, staffId: string, retiredBy: string, reason: string): Promise<boolean> {
  const { error, count } = await db
    .from('staff')
    .update(
      {
        status: STAFF_STATUS.RETIRED,
        retired_at: new Date().toISOString(),
        retired_by: retiredBy,
        retired_reason: reason,
        updated_at: getNow(),
      },
      { count: 'exact' }
    )
    .eq('id', staffId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ========================================
// 管理者・店長アカウント (managers)
// ========================================

function rowToManager(row: Record<string, unknown>): ManagerAccount {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as 'headquarters_admin' | 'store_manager',
    storeId: (row.store_id as number) ?? null,
    isActive: (row.is_active as boolean) ?? true,
    lastLoginAt: (row.last_login_at as string) || null,
  };
}

export async function getManagerByEmail(db: DB, email: string): Promise<{ manager: ManagerAccount; passwordHash: string } | null> {
  const { data, error } = await db
    .from('managers')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    manager: rowToManager(data as Record<string, unknown>),
    passwordHash: (data.password_hash as string) || '',
  };
}

export async function createManager(
  db: DB,
  email: string,
  passwordHash: string,
  name: string,
  role: 'headquarters_admin' | 'store_manager',
  storeId: number | null
): Promise<string> {
  const { data, error } = await db
    .from('managers')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      role,
      store_id: storeId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function touchManagerLogin(db: DB, managerId: string): Promise<void> {
  await db
    .from('managers')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', managerId);
}

export async function listManagers(db: DB): Promise<ManagerAccount[]> {
  const { data, error } = await db
    .from('managers')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToManager(r as Record<string, unknown>));
}

// 管理者アカウントを1件取得
export async function getManagerById(db: DB, id: string): Promise<ManagerAccount | null> {
  const { data, error } = await db
    .from('managers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToManager(data as Record<string, unknown>) : null;
}

// 管理者のパスワードをリセット
export async function updateManagerPassword(db: DB, id: string, passwordHash: string): Promise<boolean> {
  const { error, count } = await db
    .from('managers')
    .update({ password_hash: passwordHash }, { count: 'exact' })
    .eq('id', id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// 管理者の名前や有効状態を更新
export async function updateManagerInfo(
  db: DB,
  id: string,
  info: { name?: string; isActive?: boolean }
): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if (info.name !== undefined) update.name = info.name;
  if (info.isActive !== undefined) update.is_active = info.isActive;
  if (Object.keys(update).length === 0) return false;
  const { error, count } = await db
    .from('managers')
    .update(update, { count: 'exact' })
    .eq('id', id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// 管理者アカウントを削除
export async function deleteManager(db: DB, id: string): Promise<boolean> {
  const { error, count } = await db
    .from('managers')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ========================================
// シフト希望
// ========================================

export async function saveShiftRequests(
  db: DB,
  storeId: number,
  staffId: string,
  yearMonth: string,
  requests: Array<{ date: string; type: string; startTime?: string; endTime?: string; note?: string }>
): Promise<void> {
  const now = getNow();
  // 既存の希望を全削除
  const { error: delErr } = await db
    .from('shift_requests')
    .delete()
    .eq('store_id', storeId)
    .eq('staff_id', staffId)
    .eq('year_month', yearMonth);
  if (delErr) throw delErr;

  if (requests.length === 0) return;

  const rows = requests.map((req) => ({
    id: generateId('REQ'),
    store_id: storeId,
    staff_id: staffId,
    year_month: yearMonth,
    date: req.date,
    type: req.type,
    start_time: req.startTime || '',
    end_time: req.endTime || '',
    note: req.note || '',
    submitted_at: now,
    updated_at: now,
  }));

  // Postgres + Supabase は1リクエストで数千行入れられるが、安全のため500件ずつ
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('shift_requests').insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
}

export async function getShiftRequestsByStaff(db: DB, staffId: string, yearMonth: string): Promise<ShiftRequest[]> {
  const { data, error } = await db
    .from('shift_requests')
    .select('*')
    .eq('staff_id', staffId)
    .eq('year_month', yearMonth)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToShiftRequest(r as Record<string, unknown>));
}

export async function getAllShiftRequests(db: DB, storeId: number, yearMonth: string): Promise<ShiftRequest[]> {
  const { data, error } = await db
    .from('shift_requests')
    .select('*')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)
    .order('date', { ascending: true })
    .order('staff_id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToShiftRequest(r as Record<string, unknown>));
}

// ========================================
// 確定シフト
// ========================================

export async function saveShiftSchedules(
  db: DB,
  storeId: number,
  yearMonth: string,
  schedules: Array<{ staffId: string; date: string; startTime: string; endTime: string; status?: string; creationMethod?: string; id?: string }>
): Promise<void> {
  const now = getNow();
  const { error: delErr } = await db
    .from('shift_schedules')
    .delete()
    .eq('store_id', storeId)
    .eq('year_month', yearMonth);
  if (delErr) throw delErr;

  if (schedules.length === 0) return;

  const rows = schedules.map((s) => {
    const id = s.id || generateId('SFT');
    const workHoursRaw = calcHoursDiff(s.startTime, s.endTime);
    const breakMin = calcBreakMinutes(workHoursRaw);
    const workHours = Math.round((workHoursRaw - breakMin / 60) * 100) / 100;
    return {
      id,
      store_id: storeId,
      staff_id: s.staffId,
      year_month: yearMonth,
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      break_minutes: breakMin,
      work_hours: workHours,
      status: s.status || SHIFT_STATUS.DRAFT,
      creation_method: s.creationMethod || SHIFT_CREATION.AUTO,
      confirmed_at: null,
      updated_at: now,
    };
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('shift_schedules').insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
}

export async function getShiftSchedules(db: DB, storeId: number, yearMonth: string): Promise<ShiftSchedule[]> {
  const { data, error } = await db
    .from('shift_schedules')
    .select('*')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)
    .order('date', { ascending: true })
    .order('staff_id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToShiftSchedule(r as Record<string, unknown>));
}

export async function updateShiftScheduleEntry(
  db: DB,
  storeId: number,
  shiftId: string,
  updateData: Partial<{ startTime: string; endTime: string; status: string }>
): Promise<boolean> {
  // storeId でフィルタし、他店舗のシフトを更新できないようにする（認可チェック）
  const { data: current, error: getErr } = await db
    .from('shift_schedules')
    .select('*')
    .eq('id', shiftId)
    .eq('store_id', storeId)
    .maybeSingle();
  if (getErr) throw getErr;
  if (!current) return false;

  const now = getNow();
  const newStart = updateData.startTime ?? (current.start_time as string);
  const newEnd = updateData.endTime ?? (current.end_time as string);
  const update: Record<string, unknown> = { updated_at: now };

  if (updateData.startTime !== undefined) update.start_time = updateData.startTime;
  if (updateData.endTime !== undefined) update.end_time = updateData.endTime;
  if (updateData.startTime !== undefined || updateData.endTime !== undefined) {
    const workRaw = calcHoursDiff(newStart, newEnd);
    const brk = calcBreakMinutes(workRaw);
    update.break_minutes = brk;
    update.work_hours = Math.round((workRaw - brk / 60) * 100) / 100;
  }
  if (updateData.status !== undefined) update.status = updateData.status;

  const { error, count } = await db
    .from('shift_schedules')
    .update(update, { count: 'exact' })
    .eq('id', shiftId)
    .eq('store_id', storeId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function addShiftScheduleEntry(
  db: DB,
  storeId: number,
  data: { staffId: string; yearMonth: string; date: string; startTime: string; endTime: string }
): Promise<string> {
  const id = generateId('SFT');
  const now = getNow();
  const workRaw = calcHoursDiff(data.startTime, data.endTime);
  const breakMin = calcBreakMinutes(workRaw);
  const workHours = Math.round((workRaw - breakMin / 60) * 100) / 100;

  const { error } = await db.from('shift_schedules').insert({
    id,
    store_id: storeId,
    staff_id: data.staffId,
    year_month: data.yearMonth,
    date: data.date,
    start_time: data.startTime,
    end_time: data.endTime,
    break_minutes: breakMin,
    work_hours: workHours,
    status: SHIFT_STATUS.DRAFT,
    creation_method: SHIFT_CREATION.MANUAL,
    confirmed_at: null,
    updated_at: now,
  });
  if (error) throw error;
  return id;
}

export async function deleteShiftScheduleEntry(db: DB, storeId: number, shiftId: string): Promise<boolean> {
  // storeId でフィルタすることで、他店舗のシフトを誤って/意図的に削除することを防ぐ
  const { error, count } = await db
    .from('shift_schedules')
    .delete({ count: 'exact' })
    .eq('id', shiftId)
    .eq('store_id', storeId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function clearShiftSchedules(db: DB, storeId: number, yearMonth: string): Promise<void> {
  const { error } = await db
    .from('shift_schedules')
    .delete()
    .eq('store_id', storeId)
    .eq('year_month', yearMonth);
  if (error) throw error;
}

export async function updateShiftStatus(db: DB, storeId: number, yearMonth: string, newStatus: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await db
    .from('shift_schedules')
    .update({ status: newStatus, confirmed_at: nowIso, updated_at: getNow() })
    .eq('store_id', storeId)
    .eq('year_month', yearMonth);
  if (error) throw error;
}

// ========================================
// 人件費
// ========================================

export async function saveLaborCosts(db: DB, storeId: number, yearMonth: string, costData: LaborCostData[]): Promise<void> {
  const now = getNow();
  const { error: delErr } = await db
    .from('labor_costs')
    .delete()
    .eq('store_id', storeId)
    .eq('year_month', yearMonth);
  if (delErr) throw delErr;

  if (costData.length === 0) return;

  const rows = costData.map((c) => ({
    store_id: storeId,
    year_month: yearMonth,
    staff_id: c.staffId,
    name: c.name,
    employment_type: c.employmentType,
    total_hours: c.totalHours,
    base_pay: c.basePay,
    late_night_pay: c.lateNightPay,
    overtime_pay: c.overtimePay,
    peak_bonus_pay: c.peakBonusPay || 0,
    weekend_bonus_pay: c.weekendBonusPay || 0,
    transport_total: c.transportTotal,
    total_cost: c.totalCost,
    calculated_at: now,
  }));

  const { error } = await db.from('labor_costs').insert(rows);
  if (error) throw error;
}

export async function getLaborCosts(db: DB, storeId: number, yearMonth: string): Promise<LaborCostData[]> {
  const { data, error } = await db
    .from('labor_costs')
    .select('*')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    staffId: r.staff_id as string,
    name: r.name as string,
    employmentType: r.employment_type as string,
    position: 'ホール',
    totalHours: (r.total_hours as number) || 0,
    basePay: (r.base_pay as number) || 0,
    lateNightPay: (r.late_night_pay as number) || 0,
    overtimePay: (r.overtime_pay as number) || 0,
    peakBonusPay: (r.peak_bonus_pay as number) || 0,
    weekendBonusPay: (r.weekend_bonus_pay as number) || 0,
    transportTotal: (r.transport_total as number) || 0,
    totalCost: (r.total_cost as number) || 0,
  }));
}

// ========================================
// 5-3 給与明細（社労士CSV取込）
// ========================================

export async function upsertPayslips(
  db: DB,
  items: Array<{ storeId: number; staffId: string; yearMonth: string; data: Record<string, string | number> }>,
  uploadedBy: string,
): Promise<void> {
  if (items.length === 0) return;
  const rows = items.map((it) => ({
    store_id: it.storeId,
    staff_id: it.staffId,
    year_month: it.yearMonth,
    data: it.data,
    uploaded_by: uploadedBy,
  }));
  // (store_id, staff_id, year_month) のユニーク制約に対して upsert
  const { error } = await db.from('payslips').upsert(rows, { onConflict: 'store_id,staff_id,year_month' });
  if (error) throw error;
}

export async function getPayslip(
  db: DB,
  staffId: string,
  yearMonth: string,
): Promise<{ storeId: number; staffId: string; yearMonth: string; data: Record<string, string | number>; uploadedAt?: string } | null> {
  const { data, error } = await db
    .from('payslips')
    .select('*')
    .eq('staff_id', staffId)
    .eq('year_month', yearMonth)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    storeId: data.store_id as number,
    staffId: data.staff_id as string,
    yearMonth: data.year_month as string,
    data: data.data as Record<string, string | number>,
    uploadedAt: data.uploaded_at as string,
  };
}

export async function getPayslipMonthsForStaff(db: DB, staffId: string): Promise<string[]> {
  const { data, error } = await db
    .from('payslips')
    .select('year_month')
    .eq('staff_id', staffId)
    .order('year_month', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.year_month as string);
}

export async function getPayslipsForStore(
  db: DB,
  storeId: number,
  yearMonth: string,
): Promise<Array<{ storeId: number; staffId: string; yearMonth: string; data: Record<string, string | number>; uploadedAt?: string }>> {
  const { data, error } = await db
    .from('payslips')
    .select('*')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    storeId: d.store_id as number,
    staffId: d.staff_id as string,
    yearMonth: d.year_month as string,
    data: d.data as Record<string, string | number>,
    uploadedAt: d.uploaded_at as string,
  }));
}

// ========================================
// ログ
// ========================================

export async function addLog(db: DB, storeId: number | null, operator: string, action: string, detail: string): Promise<void> {
  await db.from('logs').insert({
    store_id: storeId,
    datetime: new Date().toISOString(),
    operator,
    action,
    detail,
  });
}

// ========================================
// 行データ → オブジェクト変換
// ========================================

function rowToStaff(row: Record<string, unknown>): StaffData {
  return {
    id: row.id as string,
    name: row.name as string,
    kana: (row.kana as string) || '',
    employmentType: row.employment_type as string,
    position: (row.position as string) || 'ホール',
    hourlyRate: (row.hourly_rate as number) || 0,
    monthlySalary: (row.monthly_salary as number) || 0,
    transportDaily: (row.transport_daily as number) || 0,
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    lineUserId: (row.line_user_id as string) || '',
    joinDate: (row.join_date as string) || '',
    weeklyLimit: (row.weekly_limit as number) || TIME_CONFIG.WEEKLY_HOUR_LIMIT,
    fixedOff: (row.fixed_off as string) || '',
    status: row.status as string,
    memo: (row.memo as string) || '',
  };
}

function rowToShiftRequest(row: Record<string, unknown>): ShiftRequest {
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    yearMonth: row.year_month as string,
    date: row.date as string,
    type: row.type as string,
    startTime: (row.start_time as string) || '',
    endTime: (row.end_time as string) || '',
    note: (row.note as string) || '',
    submittedAt: (row.submitted_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function rowToShiftSchedule(row: Record<string, unknown>): ShiftSchedule {
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    yearMonth: row.year_month as string,
    date: row.date as string,
    startTime: (row.start_time as string) || '',
    endTime: (row.end_time as string) || '',
    breakMinutes: (row.break_minutes as number) || 0,
    workHours: (row.work_hours as number) || 0,
    status: row.status as string,
    creationMethod: (row.creation_method as string) || '',
    confirmedAt: (row.confirmed_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}
