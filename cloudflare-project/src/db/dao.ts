// ぎゅう丸シフト管理システム - データアクセスオブジェクト（SheetDAO.gs の SQL版）

import { generateId, getNow, calcHoursDiff, calcBreakMinutes } from '../utils';
import { STAFF_STATUS, SHIFT_STATUS, SHIFT_CREATION, EMPLOYMENT_TYPES, TIME_CONFIG } from '../config';
import type { StaffData, StaffListItem, ShiftRequest, ShiftSchedule, LaborCostData, StoreInfo } from '../types';

// D1Databaseの型
type DB = D1Database;

// ========================================
// 設定
// ========================================

export async function getSettings(db: DB, storeId: number): Promise<Record<string, string>> {
  const rows = await db.prepare(
    'SELECT key, value FROM store_settings WHERE store_id = ?'
  ).bind(storeId).all();

  const settings: Record<string, string> = {};
  for (const row of rows.results) {
    settings[row.key as string] = row.value as string;
  }
  return settings;
}

export async function getSetting(db: DB, storeId: number, key: string): Promise<string> {
  const row = await db.prepare(
    'SELECT value FROM store_settings WHERE store_id = ? AND key = ?'
  ).bind(storeId, key).first();
  return (row?.value as string) || '';
}

export async function updateSetting(db: DB, storeId: number, key: string, value: string): Promise<void> {
  await db.prepare(
    'INSERT INTO store_settings (store_id, key, value) VALUES (?, ?, ?) ON CONFLICT(store_id, key) DO UPDATE SET value = ?'
  ).bind(storeId, key, value, value).run();
}

// ========================================
// 店舗
// ========================================

export async function getStoreByCode(db: DB, code: string): Promise<{ id: number; code: string; name: string; type: string } | null> {
  const row = await db.prepare(
    'SELECT id, code, name, type FROM stores WHERE code = ?'
  ).bind(code).first();
  if (!row) return null;
  return { id: row.id as number, code: row.code as string, name: row.name as string, type: row.type as string };
}

export async function getStoreById(db: DB, storeId: number): Promise<{ id: number; code: string; name: string; type: string } | null> {
  const row = await db.prepare(
    'SELECT id, code, name, type FROM stores WHERE id = ?'
  ).bind(storeId).first();
  if (!row) return null;
  return { id: row.id as number, code: row.code as string, name: row.name as string, type: row.type as string };
}

export async function getAllStores(db: DB): Promise<Array<{ id: number; code: string; name: string; type: string }>> {
  const rows = await db.prepare('SELECT id, code, name, type FROM stores ORDER BY id').all();
  return rows.results.map(r => ({
    id: r.id as number,
    code: r.code as string,
    name: r.name as string,
    type: r.type as string,
  }));
}

// ========================================
// スタッフ
// ========================================

export async function getAllStaffData(db: DB, storeId: number, activeOnly: boolean): Promise<StaffData[]> {
  let sql = 'SELECT * FROM staff WHERE store_id = ?';
  if (activeOnly) {
    sql += ' AND status = ?';
  }
  sql += ' ORDER BY kana ASC';

  const stmt = activeOnly
    ? db.prepare(sql).bind(storeId, STAFF_STATUS.ACTIVE)
    : db.prepare(sql).bind(storeId);

  const rows = await stmt.all();
  return rows.results.map(rowToStaff);
}

export async function getStaffDataById(db: DB, staffId: string): Promise<StaffData | null> {
  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').bind(staffId).first();
  if (!row) return null;
  return rowToStaff(row);
}

export async function addStaffData(db: DB, storeId: number, staffData: Partial<StaffData>): Promise<string> {
  const id = generateId('STF');
  const now = getNow();
  await db.prepare(`
    INSERT INTO staff (id, store_id, name, kana, employment_type, position, hourly_rate, monthly_salary, transport_daily, phone, email, line_user_id, join_date, weekly_limit, fixed_off, status, memo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, storeId,
    staffData.name || '',
    staffData.kana || '',
    staffData.employmentType || EMPLOYMENT_TYPES.PART_TIME,
    staffData.position || 'ホール',
    staffData.hourlyRate || 0,
    staffData.monthlySalary || 0,
    staffData.transportDaily || 0,
    staffData.phone || '',
    staffData.email || '',
    staffData.lineUserId || '',
    staffData.joinDate || now.split(' ')[0],
    staffData.weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT,
    staffData.fixedOff || '',
    STAFF_STATUS.ACTIVE,
    staffData.memo || '',
    now, now
  ).run();
  return id;
}

export async function updateStaffData(db: DB, staffId: string, staffData: Partial<StaffData>): Promise<boolean> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const mapping: Record<string, string> = {
    name: 'name', kana: 'kana', employmentType: 'employment_type',
    position: 'position', hourlyRate: 'hourly_rate', monthlySalary: 'monthly_salary',
    transportDaily: 'transport_daily', phone: 'phone', email: 'email',
    lineUserId: 'line_user_id', weeklyLimit: 'weekly_limit',
    fixedOff: 'fixed_off', status: 'status', memo: 'memo',
  };

  for (const [jsKey, dbCol] of Object.entries(mapping)) {
    const val = (staffData as Record<string, unknown>)[jsKey];
    if (val !== undefined) {
      fields.push(`${dbCol} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(getNow());
  values.push(staffId);

  const result = await db.prepare(
    `UPDATE staff SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return (result.meta.changes ?? 0) > 0;
}

// ========================================
// シフト希望
// ========================================

export async function saveShiftRequests(
  db: DB, storeId: number, staffId: string, yearMonth: string, requests: Array<{ date: string; type: string; startTime?: string; endTime?: string; note?: string }>
): Promise<void> {
  const now = getNow();

  // 既存データを削除
  await db.prepare(
    'DELETE FROM shift_requests WHERE store_id = ? AND staff_id = ? AND year_month = ?'
  ).bind(storeId, staffId, yearMonth).run();

  // 新規データを追加（バッチ）
  if (requests.length === 0) return;

  const stmts = requests.map(req => {
    const id = generateId('REQ');
    return db.prepare(
      'INSERT INTO shift_requests (id, store_id, staff_id, year_month, date, type, start_time, end_time, note, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, storeId, staffId, yearMonth, req.date, req.type, req.startTime || '', req.endTime || '', req.note || '', now, now);
  });

  await db.batch(stmts);
}

export async function getShiftRequestsByStaff(db: DB, staffId: string, yearMonth: string): Promise<ShiftRequest[]> {
  const rows = await db.prepare(
    'SELECT * FROM shift_requests WHERE staff_id = ? AND year_month = ? ORDER BY date'
  ).bind(staffId, yearMonth).all();

  return rows.results.map(rowToShiftRequest);
}

export async function getAllShiftRequests(db: DB, storeId: number, yearMonth: string): Promise<ShiftRequest[]> {
  const rows = await db.prepare(
    'SELECT * FROM shift_requests WHERE store_id = ? AND year_month = ? ORDER BY date, staff_id'
  ).bind(storeId, yearMonth).all();

  return rows.results.map(rowToShiftRequest);
}

// ========================================
// 確定シフト
// ========================================

export async function saveShiftSchedules(
  db: DB, storeId: number, yearMonth: string, schedules: Array<{ staffId: string; date: string; startTime: string; endTime: string; status?: string; creationMethod?: string; id?: string }>
): Promise<void> {
  const now = getNow();

  // 既存データを削除
  await db.prepare(
    'DELETE FROM shift_schedules WHERE store_id = ? AND year_month = ?'
  ).bind(storeId, yearMonth).run();

  if (schedules.length === 0) return;

  const stmts = schedules.map(s => {
    const id = s.id || generateId('SFT');
    const workHoursRaw = calcHoursDiff(s.startTime, s.endTime);
    const breakMin = calcBreakMinutes(workHoursRaw);
    const workHours = Math.round((workHoursRaw - breakMin / 60) * 100) / 100;

    return db.prepare(
      'INSERT INTO shift_schedules (id, store_id, staff_id, year_month, date, start_time, end_time, break_minutes, work_hours, status, creation_method, confirmed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, storeId, s.staffId, yearMonth, s.date, s.startTime, s.endTime, breakMin, workHours, s.status || SHIFT_STATUS.DRAFT, s.creationMethod || SHIFT_CREATION.AUTO, '', now);
  });

  // D1のbatchは一度に最大100件まで
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100));
  }
}

export async function getShiftSchedules(db: DB, storeId: number, yearMonth: string): Promise<ShiftSchedule[]> {
  const rows = await db.prepare(
    'SELECT * FROM shift_schedules WHERE store_id = ? AND year_month = ? ORDER BY date, staff_id'
  ).bind(storeId, yearMonth).all();

  return rows.results.map(rowToShiftSchedule);
}

export async function updateShiftScheduleEntry(db: DB, shiftId: string, updateData: Partial<{ startTime: string; endTime: string; status: string }>): Promise<boolean> {
  // 現在のデータを取得
  const current = await db.prepare('SELECT * FROM shift_schedules WHERE id = ?').bind(shiftId).first();
  if (!current) return false;

  const now = getNow();
  const newStart = updateData.startTime || (current.start_time as string);
  const newEnd = updateData.endTime || (current.end_time as string);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updateData.startTime !== undefined) {
    fields.push('start_time = ?');
    values.push(updateData.startTime);
  }
  if (updateData.endTime !== undefined) {
    fields.push('end_time = ?');
    values.push(updateData.endTime);
  }
  if (updateData.startTime !== undefined || updateData.endTime !== undefined) {
    const workRaw = calcHoursDiff(newStart, newEnd);
    const brk = calcBreakMinutes(workRaw);
    fields.push('break_minutes = ?', 'work_hours = ?');
    values.push(brk, Math.round((workRaw - brk / 60) * 100) / 100);
  }
  if (updateData.status !== undefined) {
    fields.push('status = ?');
    values.push(updateData.status);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(shiftId);

  const result = await db.prepare(
    `UPDATE shift_schedules SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return (result.meta.changes ?? 0) > 0;
}

export async function addShiftScheduleEntry(
  db: DB, storeId: number, data: { staffId: string; yearMonth: string; date: string; startTime: string; endTime: string }
): Promise<string> {
  const id = generateId('SFT');
  const now = getNow();
  const workRaw = calcHoursDiff(data.startTime, data.endTime);
  const breakMin = calcBreakMinutes(workRaw);
  const workHours = Math.round((workRaw - breakMin / 60) * 100) / 100;

  await db.prepare(
    'INSERT INTO shift_schedules (id, store_id, staff_id, year_month, date, start_time, end_time, break_minutes, work_hours, status, creation_method, confirmed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, storeId, data.staffId, data.yearMonth, data.date, data.startTime, data.endTime, breakMin, workHours, SHIFT_STATUS.DRAFT, SHIFT_CREATION.MANUAL, '', now).run();

  return id;
}

export async function deleteShiftScheduleEntry(db: DB, shiftId: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM shift_schedules WHERE id = ?').bind(shiftId).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function updateShiftStatus(db: DB, storeId: number, yearMonth: string, newStatus: string): Promise<void> {
  const now = getNow();
  await db.prepare(
    'UPDATE shift_schedules SET status = ?, confirmed_at = ?, updated_at = ? WHERE store_id = ? AND year_month = ?'
  ).bind(newStatus, now, now, storeId, yearMonth).run();
}

// ========================================
// 人件費
// ========================================

export async function saveLaborCosts(db: DB, storeId: number, yearMonth: string, costData: LaborCostData[]): Promise<void> {
  const now = getNow();

  await db.prepare(
    'DELETE FROM labor_costs WHERE store_id = ? AND year_month = ?'
  ).bind(storeId, yearMonth).run();

  if (costData.length === 0) return;

  const stmts = costData.map(c =>
    db.prepare(
      'INSERT INTO labor_costs (store_id, year_month, staff_id, name, employment_type, total_hours, base_pay, late_night_pay, overtime_pay, transport_total, total_cost, calculated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(storeId, yearMonth, c.staffId, c.name, c.employmentType, c.totalHours, c.basePay, c.lateNightPay, c.overtimePay, c.transportTotal, c.totalCost, now)
  );

  await db.batch(stmts);
}

export async function getLaborCosts(db: DB, storeId: number, yearMonth: string): Promise<LaborCostData[]> {
  const rows = await db.prepare(
    'SELECT * FROM labor_costs WHERE store_id = ? AND year_month = ? ORDER BY name'
  ).bind(storeId, yearMonth).all();

  return rows.results.map(r => ({
    staffId: r.staff_id as string,
    name: r.name as string,
    employmentType: r.employment_type as string,
    position: (r.position as string) || 'ホール',
    totalHours: r.total_hours as number,
    basePay: r.base_pay as number,
    lateNightPay: r.late_night_pay as number,
    overtimePay: r.overtime_pay as number,
    transportTotal: r.transport_total as number,
    totalCost: r.total_cost as number,
  }));
}

// ========================================
// ログ
// ========================================

export async function addLog(db: DB, storeId: number, operator: string, action: string, detail: string): Promise<void> {
  await db.prepare(
    'INSERT INTO logs (store_id, datetime, operator, action, detail) VALUES (?, ?, ?, ?, ?)'
  ).bind(storeId, getNow(), operator, action, detail).run();
}

// ========================================
// 行データ → オブジェクト変換（内部ヘルパー）
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
