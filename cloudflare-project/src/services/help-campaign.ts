// ぎゅう丸シフト管理システム - ヘルプ募集URLサービス
// 店舗・月ごとに公開URLを発行し、バイトがカレンダーから不足日を見て応募できる仕組み。

import type { DB } from '../db/supabase';
import * as dao from '../db/dao';
import { getCurrentStoreInfo, verifyStaffPin } from './auth';
import { addShiftEntry } from './shift-schedule';
import { POSITIONS } from '../config';
import { getAllDatesInMonth, getDayOfWeek, timeToMinutes } from '../utils';
import { isWeekendOrHoliday } from '../holidays';
import type { ApiResult, StaffData, TimeSlotStaffing } from '../types';

// -----------------------------------------------------------------
// 型
// -----------------------------------------------------------------
export interface HelpCampaign {
  id: string;
  storeId: number;
  yearMonth: string;
  title: string;
  message: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface ShortageSlot {
  date: string;
  dayOfWeek: string;          // 日/月/火...
  isWeekend: boolean;
  slotStart: string;          // 'HH:MM'
  slotEnd: string;
  position: string;           // ホール/キッチン
  needed: number;             // 必要人数
  current: number;            // 現在の確定済み+承認済み応募
  shortage: number;           // 不足人数
  label?: string;             // ランチ/ディナー等
}

export interface HelpApplication {
  id: string;
  campaignId: string;
  storeId: number;
  staffId: string;
  staffName?: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string;
  status: string;
  note: string;
  appliedAt: string;
  reviewedAt: string | null;
  reviewedBy: string;
}

// -----------------------------------------------------------------
// ランダムトークン生成（URL用）
// -----------------------------------------------------------------
function generateCampaignToken(): string {
  // 32文字の英数字。URLに埋め込む。
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // base36で収まる範囲に落とす
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}

// -----------------------------------------------------------------
// 管理者: キャンペーン作成
// -----------------------------------------------------------------
export async function createCampaign(
  db: DB,
  storeId: number,
  params: { yearMonth: string; title?: string; message?: string; expiresAt?: string | null; createdBy?: string }
): Promise<ApiResult & { campaign?: HelpCampaign }> {
  if (!/^\d{4}-\d{2}$/.test(params.yearMonth)) {
    return { success: false, message: '対象月の形式が不正です（YYYY-MM）' };
  }

  const token = generateCampaignToken();
  const now = new Date().toISOString();

  const row = {
    id: token,
    store_id: storeId,
    year_month: params.yearMonth,
    title: params.title || 'ヘルプ募集',
    message: params.message || '',
    is_active: true,
    expires_at: params.expiresAt || null,
    created_at: now,
    created_by: params.createdBy || '',
  };

  const { error } = await db.from('help_campaigns').insert(row);
  if (error) {
    return { success: false, message: 'キャンペーン作成に失敗しました: ' + error.message };
  }

  await dao.addLog(db, storeId, params.createdBy || '管理者', 'ヘルプ募集作成', `${params.yearMonth} token=${token}`);

  return {
    success: true,
    message: 'ヘルプ募集URLを発行しました',
    campaign: rowToCampaign(row),
  };
}

// -----------------------------------------------------------------
// 管理者: キャンペーン一覧
// -----------------------------------------------------------------
export async function listCampaigns(db: DB, storeId: number): Promise<HelpCampaign[]> {
  const { data, error } = await db
    .from('help_campaigns')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToCampaign(r as Record<string, unknown>));
}

// -----------------------------------------------------------------
// 管理者: キャンペーン無効化
// -----------------------------------------------------------------
export async function deactivateCampaign(
  db: DB,
  storeId: number,
  campaignId: string,
  operator: string
): Promise<ApiResult> {
  const { error, count } = await db
    .from('help_campaigns')
    .update({ is_active: false }, { count: 'exact' })
    .eq('id', campaignId)
    .eq('store_id', storeId);
  if (error) return { success: false, message: '停止に失敗しました: ' + error.message };
  if (!count) return { success: false, message: '募集が見つかりません' };
  await dao.addLog(db, storeId, operator, 'ヘルプ募集停止', campaignId);
  return { success: true, message: '募集を停止しました' };
}

// -----------------------------------------------------------------
// 公開: トークンからキャンペーンを取得
// -----------------------------------------------------------------
export async function getCampaignByToken(db: DB, token: string): Promise<HelpCampaign | null> {
  const { data, error } = await db
    .from('help_campaigns')
    .select('*')
    .eq('id', token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToCampaign(data as Record<string, unknown>);
}

// -----------------------------------------------------------------
// 公開: 月の不足リストを計算（確定シフト＋申請中・承認済み応募を合算）
// 申請中も "仮押さえ" としてカウントする → 応募瞬間に不足が減る
// 却下されると自動的に不足に戻る
// -----------------------------------------------------------------
export async function getShortagesForCampaign(db: DB, campaign: HelpCampaign): Promise<ShortageSlot[]> {
  const storeInfo = await getCurrentStoreInfo(db, campaign.storeId);
  const allStaff = await dao.getAllStaffData(db, campaign.storeId, true);
  const schedules = await dao.getShiftSchedules(db, campaign.storeId, campaign.yearMonth);
  const approvedApps = await listActiveApplicationsForMonth(db, campaign.storeId, campaign.yearMonth);

  const staffMap: Record<string, StaffData> = {};
  for (const s of allStaff) staffMap[s.id] = s;

  // カバー判定: 各日付ごとにスタッフID => {position, startTime, endTime} のリストを作る
  type CoverRow = { staffId: string; position: string; startTime: string; endTime: string };
  const perDate: Record<string, CoverRow[]> = {};

  for (const s of schedules) {
    if (!perDate[s.date]) perDate[s.date] = [];
    perDate[s.date].push({
      staffId: s.staffId,
      position: staffMap[s.staffId]?.position || POSITIONS.HALL,
      startTime: s.startTime,
      endTime: s.endTime,
    });
  }

  // 承認済み応募も擬似的にカバーとして加算する（承認 → 確定シフトにも入っているので重複しないよう staffId+date でユニーク化）
  for (const app of approvedApps) {
    if (!perDate[app.date]) perDate[app.date] = [];
    const dup = perDate[app.date].find(
      (r) => r.staffId === app.staffId && r.startTime === app.startTime && r.endTime === app.endTime
    );
    if (!dup) {
      perDate[app.date].push({
        staffId: app.staffId,
        position: app.position || staffMap[app.staffId]?.position || POSITIONS.HALL,
        startTime: app.startTime,
        endTime: app.endTime,
      });
    }
  }

  const dates = getAllDatesInMonth(campaign.yearMonth);
  const timeSlots: TimeSlotStaffing[] = storeInfo.timeSlotStaffing;
  const shortages: ShortageSlot[] = [];

  for (const date of dates) {
    const isWeekend = isWeekendOrHoliday(date);
    const covers = perDate[date] || [];

    for (const slot of timeSlots) {
      const slotS = timeToMinutes(slot.start);
      const slotE = timeToMinutes(slot.end);
      const hallNeeded = isWeekend ? (slot.weekendHall ?? slot.hall ?? 4) : (slot.weekdayHall ?? slot.hall ?? 4);
      const kitchenNeeded = isWeekend ? (slot.weekendKitchen ?? slot.kitchen ?? 3) : (slot.weekdayKitchen ?? slot.kitchen ?? 3);

      let hallCount = 0;
      let kitchenCount = 0;
      for (const c of covers) {
        const shS = timeToMinutes(c.startTime);
        const shE = timeToMinutes(c.endTime);
        if (shS <= slotS && shE >= slotE) {
          if (c.position === POSITIONS.HALL) hallCount++;
          else kitchenCount++;
        }
      }

      if (hallCount < hallNeeded) {
        shortages.push({
          date,
          dayOfWeek: getDayOfWeek(date),
          isWeekend,
          slotStart: slot.start,
          slotEnd: slot.end,
          position: POSITIONS.HALL,
          needed: hallNeeded,
          current: hallCount,
          shortage: hallNeeded - hallCount,
          label: slot.label,
        });
      }
      if (kitchenCount < kitchenNeeded) {
        shortages.push({
          date,
          dayOfWeek: getDayOfWeek(date),
          isWeekend,
          slotStart: slot.start,
          slotEnd: slot.end,
          position: POSITIONS.KITCHEN,
          needed: kitchenNeeded,
          current: kitchenCount,
          shortage: kitchenNeeded - kitchenCount,
          label: slot.label,
        });
      }
    }
  }

  return shortages;
}

// -----------------------------------------------------------------
// 公開: 応募者のスタッフ選択候補（PIN情報は返さない）
// -----------------------------------------------------------------
export async function getPublicStaffChoices(
  db: DB,
  storeId: number
): Promise<Array<{ id: string; name: string; kana: string; position: string }>> {
  const rows = await dao.getAllStaffData(db, storeId, true);
  return rows
    .map((s) => ({ id: s.id, name: s.name, kana: s.kana, position: s.position }))
    .sort((a, b) => (a.kana || '').localeCompare(b.kana || '', 'ja'));
}

// -----------------------------------------------------------------
// 公開: 応募を受け付ける（本人確認＝4桁PIN）
// -----------------------------------------------------------------
export async function submitApplication(
  db: DB,
  token: string,
  input: {
    staffId: string;
    pin: string;
    date: string;
    startTime: string;
    endTime: string;
    note?: string;
  }
): Promise<ApiResult & { applicationId?: string; locked?: boolean }> {
  // 1. キャンペーン取得＆有効性チェック
  const campaign = await getCampaignByToken(db, token);
  if (!campaign) return { success: false, message: 'URLが無効です' };
  if (!campaign.isActive) return { success: false, message: 'この募集は停止されています' };
  if (campaign.expiresAt && new Date(campaign.expiresAt).getTime() < Date.now()) {
    return { success: false, message: '募集期間が終了しました' };
  }

  // 2. 日付が対象月と一致するか
  if (!input.date.startsWith(campaign.yearMonth)) {
    return { success: false, message: '対象月外の日付です' };
  }

  // 3. スタッフ存在確認
  const staff = await dao.getStaffDataById(db, input.staffId);
  if (!staff) return { success: false, message: 'スタッフが見つかりません' };
  if (staff.status !== '在籍') return { success: false, message: 'このアカウントは現在ご利用になれません' };

  // 4. 所属店舗チェック
  const { data: staffRow, error: staffErr } = await db
    .from('staff')
    .select('store_id')
    .eq('id', input.staffId)
    .maybeSingle();
  if (staffErr) return { success: false, message: '本人確認に失敗しました' };
  if (!staffRow || (staffRow.store_id as number) !== campaign.storeId) {
    return { success: false, message: 'この店舗のスタッフとして登録されていません' };
  }

  // 5. PIN認証（5回失敗で15分ロックされる既存の仕組みを流用）
  if (!/^\d{4}$/.test((input.pin || '').trim())) {
    return { success: false, message: 'PINは4桁の数字です' };
  }
  const pinResult = await verifyStaffPin(db, input.staffId, input.pin.trim());
  if (!pinResult.ok) {
    return { success: false, message: pinResult.message, locked: pinResult.locked || false };
  }

  // 4. 応募レコード作成
  const appId = 'HLP_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const { error: insErr } = await db.from('help_applications').insert({
    id: appId,
    campaign_id: token,
    store_id: campaign.storeId,
    staff_id: input.staffId,
    date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    position: staff.position || '',
    status: '申請中',
    note: input.note || '',
    applied_at: new Date().toISOString(),
  });
  if (insErr) {
    const msg = insErr.message || '';
    if (msg.includes('duplicate') || msg.includes('uq_help_apps_unique')) {
      return { success: false, message: 'この時間帯には既に応募済みです' };
    }
    return { success: false, message: '応募に失敗しました: ' + msg };
  }

  await dao.addLog(db, campaign.storeId, staff.name, 'ヘルプ応募', `${input.date} ${input.startTime}-${input.endTime}`);

  return { success: true, message: '応募を受け付けました！管理者の承認をお待ちください。', applicationId: appId };
}

// -----------------------------------------------------------------
// 管理者: 応募一覧
// -----------------------------------------------------------------
export async function listApplications(
  db: DB,
  storeId: number,
  options: { campaignId?: string; status?: string } = {}
): Promise<HelpApplication[]> {
  let q = db.from('help_applications').select('*').eq('store_id', storeId);
  if (options.campaignId) q = q.eq('campaign_id', options.campaignId);
  if (options.status) q = q.eq('status', options.status);
  const { data, error } = await q.order('applied_at', { ascending: false });
  if (error) throw error;

  // staff名を解決するために一括取得
  const apps = (data ?? []).map((r) => rowToApplication(r as Record<string, unknown>));
  if (apps.length === 0) return [];
  const staffIds = Array.from(new Set(apps.map((a) => a.staffId)));
  const { data: staffRows } = await db.from('staff').select('id, name').in('id', staffIds);
  const nameMap: Record<string, string> = {};
  for (const s of staffRows ?? []) nameMap[s.id as string] = s.name as string;
  return apps.map((a) => ({ ...a, staffName: nameMap[a.staffId] || a.staffId }));
}

// 現在有効な応募（申請中＋承認済み）を取得 — shortage計算用の仮押さえ集合
async function listActiveApplicationsForMonth(
  db: DB,
  storeId: number,
  yearMonth: string
): Promise<HelpApplication[]> {
  const { data, error } = await db
    .from('help_applications')
    .select('*')
    .eq('store_id', storeId)
    .in('status', ['申請中', '承認'])
    .like('date', `${yearMonth}-%`);
  if (error) throw error;
  return (data ?? []).map((r) => rowToApplication(r as Record<string, unknown>));
}

// -----------------------------------------------------------------
// 管理者: 応募を承認 → 確定シフトに自動反映
// -----------------------------------------------------------------
export async function approveApplication(
  db: DB,
  storeId: number,
  applicationId: string,
  reviewer: string
): Promise<ApiResult> {
  const { data, error } = await db
    .from('help_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('store_id', storeId)
    .maybeSingle();
  if (error) return { success: false, message: '取得に失敗しました: ' + error.message };
  if (!data) return { success: false, message: '応募が見つかりません' };

  const app = rowToApplication(data as Record<string, unknown>);
  if (app.status !== '申請中') {
    return { success: false, message: '既に処理済みです（' + app.status + '）' };
  }

  // 1. 確定シフトに追加
  const yearMonth = app.date.slice(0, 7);
  const addResult = await addShiftEntry(db, storeId, {
    staffId: app.staffId,
    yearMonth,
    date: app.date,
    startTime: app.startTime,
    endTime: app.endTime,
  });
  if (!addResult.success) {
    return { success: false, message: 'シフト追加に失敗しました: ' + addResult.message };
  }

  // 2. ステータス更新
  const { error: updErr } = await db
    .from('help_applications')
    .update({
      status: '承認',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
    })
    .eq('id', applicationId);
  if (updErr) return { success: false, message: 'ステータス更新に失敗: ' + updErr.message };

  await dao.addLog(db, storeId, reviewer, 'ヘルプ承認', `${app.staffId} ${app.date}`);
  return { success: true, message: '応募を承認し、確定シフトに反映しました' };
}

// -----------------------------------------------------------------
// 管理者: 応募を却下
// -----------------------------------------------------------------
export async function rejectApplication(
  db: DB,
  storeId: number,
  applicationId: string,
  reviewer: string,
  reason: string = ''
): Promise<ApiResult> {
  const { data, error } = await db
    .from('help_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('store_id', storeId)
    .maybeSingle();
  if (error) return { success: false, message: '取得に失敗しました: ' + error.message };
  if (!data) return { success: false, message: '応募が見つかりません' };

  const app = rowToApplication(data as Record<string, unknown>);
  if (app.status !== '申請中') {
    return { success: false, message: '既に処理済みです（' + app.status + '）' };
  }

  const { error: updErr } = await db
    .from('help_applications')
    .update({
      status: '却下',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
      note: reason ? (app.note ? app.note + ' / ' + reason : reason) : app.note,
    })
    .eq('id', applicationId);
  if (updErr) return { success: false, message: '更新に失敗: ' + updErr.message };

  await dao.addLog(db, storeId, reviewer, 'ヘルプ却下', `${applicationId} ${reason}`);
  return { success: true, message: '応募を却下しました' };
}

// -----------------------------------------------------------------
// 内部: 行→オブジェクト変換
// -----------------------------------------------------------------
function rowToCampaign(row: Record<string, unknown>): HelpCampaign {
  return {
    id: row.id as string,
    storeId: row.store_id as number,
    yearMonth: row.year_month as string,
    title: (row.title as string) || 'ヘルプ募集',
    message: (row.message as string) || '',
    isActive: (row.is_active as boolean) ?? true,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: (row.created_at as string) || '',
    createdBy: (row.created_by as string) || '',
  };
}

function rowToApplication(row: Record<string, unknown>): HelpApplication {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    storeId: row.store_id as number,
    staffId: row.staff_id as string,
    date: row.date as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    position: (row.position as string) || '',
    status: row.status as string,
    note: (row.note as string) || '',
    appliedAt: (row.applied_at as string) || '',
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    reviewedBy: (row.reviewed_by as string) || '',
  };
}

