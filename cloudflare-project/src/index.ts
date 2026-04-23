// ぎゅう丸シフト管理システム - Honoルーター（Supabase + 3階層ロール版）

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, UserRole } from './types';
import { createToken, authMiddleware, requireRole, canAccessStore } from './middleware/auth';
import { generateTimeSlots } from './utils';
import { getSupabase } from './db/supabase';

// サービス
import * as authService from './services/auth';
import * as staffService from './services/staff';
import * as shiftRequestService from './services/shift-request';
import * as shiftScheduleService from './services/shift-schedule';
import * as laborCostService from './services/labor-cost';
import * as lineNotifyService from './services/line-notify';
import * as payslipService from './services/payslip';
import * as helpCampaignService from './services/help-campaign';
import * as dao from './db/dao';

type Variables = {
  storeId: number | null;
  role: UserRole;
  staffId?: string;
  managerId?: string;
  name?: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS設定
app.use('/api/*', cors());

// ========================================
// 公開API（認証不要）
// ========================================

// 店舗一覧を取得
app.get('/api/stores', async (c) => {
  const db = getSupabase(c.env);
  const stores = await dao.getAllStores(db);
  return c.json(stores);
});

// スタッフ選択用の一覧を取得
app.get('/api/stores/:storeCode/staff-list', async (c) => {
  const db = getSupabase(c.env);
  const store = await dao.getStoreByCode(db, c.req.param('storeCode')!);
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);
  const list = await authService.getStaffList(db, store.id);
  return c.json(list);
});

// 店舗情報を取得
app.get('/api/stores/:storeCode/info', async (c) => {
  const db = getSupabase(c.env);
  const store = await dao.getStoreByCode(db, c.req.param('storeCode')!);
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);
  const info = await authService.getCurrentStoreInfo(db, store.id);
  return c.json(info);
});

// 時間選択肢を取得
app.get('/api/time-slots', (c) => {
  return c.json(generateTimeSlots());
});

// デプロイごとの初期設定をフロントへ渡す
// 店舗ごと専用デプロイの場合は STORE_CODE を返し、フロントは店舗選択をスキップする
// 本部用デプロイの場合は initialPage='hq' を返し、フロントは /hq.html へリダイレクトする
app.get('/api/config', (c) => {
  return c.json({
    storeCode: c.env.STORE_CODE || null,
    initialPage: c.env.INITIAL_PAGE || null,
  });
});

// ========================================
// 公開: ヘルプ募集URL（トークンベース・認証不要）
// ========================================

// 募集の公開情報（店舗名・月・案内文）を取得
app.get('/api/help/:token', async (c) => {
  const db = getSupabase(c.env);
  const token = c.req.param('token')!;
  const campaign = await helpCampaignService.getCampaignByToken(db, token);
  if (!campaign) return c.json({ success: false, message: 'URLが無効です' }, 404);
  if (!campaign.isActive) return c.json({ success: false, message: 'この募集は停止されています' }, 410);
  if (campaign.expiresAt && new Date(campaign.expiresAt).getTime() < Date.now()) {
    return c.json({ success: false, message: '募集期間が終了しました' }, 410);
  }

  const store = await dao.getStoreById(db, campaign.storeId);
  return c.json({
    success: true,
    campaign: {
      token: campaign.id,
      yearMonth: campaign.yearMonth,
      title: campaign.title,
      message: campaign.message,
      storeName: store?.name || '',
    },
  });
});

// 募集の不足日・時間帯リスト（カレンダー表示用）
app.get('/api/help/:token/shortages', async (c) => {
  const db = getSupabase(c.env);
  const token = c.req.param('token')!;
  const campaign = await helpCampaignService.getCampaignByToken(db, token);
  if (!campaign || !campaign.isActive) return c.json({ success: false, message: '募集が無効です' }, 404);
  const shortages = await helpCampaignService.getShortagesForCampaign(db, campaign);
  return c.json({ success: true, shortages });
});

// 応募画面用のスタッフ一覧（名前・フリガナのみ）
app.get('/api/help/:token/staff', async (c) => {
  const db = getSupabase(c.env);
  const token = c.req.param('token')!;
  const campaign = await helpCampaignService.getCampaignByToken(db, token);
  if (!campaign || !campaign.isActive) return c.json({ success: false, message: '募集が無効です' }, 404);
  const staff = await helpCampaignService.getPublicStaffChoices(db, campaign.storeId);
  return c.json({ success: true, staff });
});

// 応募を送信
app.post('/api/help/:token/apply', async (c) => {
  const db = getSupabase(c.env);
  const token = c.req.param('token')!;
  const body = await c.req.json<{
    staffId: string;
    pin: string;
    date: string;
    startTime: string;
    endTime: string;
    note?: string;
  }>();
  const result = await helpCampaignService.submitApplication(db, token, body);
  return c.json(result, result.success ? 200 : 400);
});

// ========================================
// 管理者ログイン（既存: 店舗パスワード方式、後方互換のため残す）
// ========================================
app.post('/api/stores/:storeCode/admin/login', async (c) => {
  const db = getSupabase(c.env);
  const store = await dao.getStoreByCode(db, c.req.param('storeCode')!);
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);

  const body = await c.req.json<{ password: string }>();

  const storedHash = await dao.getSetting(db, store.id, '管理者パスワード');
  if (!storedHash) {
    // 初回: パスワード登録
    await authService.setAdminPassword(db, store.id, body.password);
    const token = await createToken(c.env.JWT_SECRET, {
      storeId: store.id,
      role: 'store_manager',
      name: store.name,
    });
    return c.json({ success: true, token, storeName: store.name, firstTime: true, role: 'store_manager' });
  }

  const valid = await authService.verifyAdminPassword(db, store.id, body.password);
  if (!valid) {
    return c.json({ success: false, message: 'パスワードが正しくありません' }, 401);
  }

  const token = await createToken(c.env.JWT_SECRET, {
    storeId: store.id,
    role: 'store_manager',
    name: store.name,
  });
  return c.json({ success: true, token, storeName: store.name, role: 'store_manager' });
});

// ========================================
// 新: スタッフPINログイン
// ========================================

// PINが設定済みか確認する（スタッフ選択画面用）
app.get('/api/stores/:storeCode/staff/:staffId/has-pin', async (c) => {
  const db = getSupabase(c.env);
  const has = await authService.hasPinSet(db, c.req.param('staffId')!);
  return c.json({ hasPin: has });
});

// （廃止）スタッフの自己PIN設定
// 方針変更: PINは店長のみが設定できる。このエンドポイントは常に拒否する。
app.post('/api/stores/:storeCode/staff/:staffId/setup-pin', async (c) => {
  return c.json(
    {
      success: false,
      message: 'PINはご自身では設定できません。店長にPINの発行を依頼してください。',
    },
    403
  );
});

// スタッフPINログイン
app.post('/api/stores/:storeCode/staff/login', async (c) => {
  const db = getSupabase(c.env);
  const store = await dao.getStoreByCode(db, c.req.param('storeCode')!);
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);

  const body = await c.req.json<{ staffId: string; pin: string }>();
  const staff = await dao.getStaffDataById(db, body.staffId);
  if (!staff) return c.json({ success: false, message: 'スタッフが見つかりません' }, 404);
  if (staff.status !== '在籍') return c.json({ success: false, message: '退職処理されたアカウントです' }, 403);

  // PIN認証
  const verify = await authService.verifyStaffPin(db, body.staffId, body.pin);
  if (!verify.ok) {
    return c.json({ success: false, message: verify.message, locked: verify.locked || false }, 401);
  }

  const token = await createToken(c.env.JWT_SECRET, {
    storeId: store.id,
    role: 'staff',
    staffId: staff.id,
    name: staff.name,
  });
  return c.json({ success: true, token, staffName: staff.name, staffId: staff.id, role: 'staff' });
});

// ========================================
// 新: 本部管理者・店長のメール＋パスワードログイン
// ========================================
app.post('/api/managers/login', async (c) => {
  const db = getSupabase(c.env);
  const body = await c.req.json<{ email: string; password: string }>();
  const result = await authService.loginManager(db, body.email, body.password);
  if (!result.ok || !result.manager) {
    return c.json({ success: false, message: result.message }, 401);
  }
  const token = await createToken(c.env.JWT_SECRET, {
    storeId: result.manager.storeId,
    role: result.manager.role,
    managerId: result.manager.id,
    name: result.manager.name,
  });
  return c.json({
    success: true,
    token,
    name: result.manager.name,
    role: result.manager.role,
    storeId: result.manager.storeId,
  });
});

// ========================================
// 認証必須API
// ========================================
const authed = new Hono<{ Bindings: Env; Variables: Variables }>();
authed.use('*', authMiddleware());

// --- スタッフ用API ---

// シフト希望を提出する（スタッフは自分のしか編集できない）
authed.post('/shift-requests', async (c) => {
  const db = getSupabase(c.env);
  const role = c.get('role');
  const myStoreId = c.get('storeId');
  const myStaffId = c.get('staffId');

  const body = await c.req.json<{ staffId: string; yearMonth: string; requests: Array<{ date: string; type: string; startTime?: string; endTime?: string; note?: string }> }>();

  // 新機能2: スタッフは他人のシフトを編集できない
  if (role === 'staff' && body.staffId !== myStaffId) {
    return c.json({ success: false, message: '他のスタッフのシフトは編集できません' }, 403);
  }

  // 店長は自店舗のみ
  if (role === 'store_manager' && myStoreId == null) {
    return c.json({ success: false, message: '店舗情報が不明です' }, 400);
  }

  // 店舗IDは認証ユーザーの店舗に固定（本部管理者のみ body で指定可、ここでは myStoreId を優先）
  const storeId = myStoreId ?? 0;

  const result = await shiftRequestService.submitShiftRequests(
    db,
    storeId,
    body.staffId,
    body.yearMonth,
    body.requests,
    role
  );
  return c.json(result);
});

// 自分のシフト希望を取得する（スタッフは自分のしか見られない）
authed.get('/shift-requests/:staffId/:yearMonth', async (c) => {
  const db = getSupabase(c.env);
  const role = c.get('role');
  const myStaffId = c.get('staffId');
  const targetStaffId = c.req.param('staffId')!;

  if (role === 'staff' && targetStaffId !== myStaffId) {
    return c.json({ success: false, message: '他のスタッフのシフト希望は閲覧できません' }, 403);
  }

  const requests = await shiftRequestService.getMyRequests(db, targetStaffId, c.req.param('yearMonth')!);
  return c.json(requests);
});

// 自分の確定シフトを取得する
authed.get('/my-shifts/:staffId/:yearMonth', async (c) => {
  const db = getSupabase(c.env);
  const role = c.get('role');
  const myStaffId = c.get('staffId');
  const targetStaffId = c.req.param('staffId')!;

  if (role === 'staff' && targetStaffId !== myStaffId) {
    return c.json({ success: false, message: '他のスタッフのシフトは閲覧できません' }, 403);
  }

  const storeId = c.get('storeId') ?? 0;
  const shifts = await shiftScheduleService.getMyShift(db, storeId, targetStaffId, c.req.param('yearMonth')!);
  return c.json(shifts);
});

// シフト希望受付期間のチェック
authed.get('/request-period/:yearMonth', async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const info = await authService.getCurrentStoreInfo(db, storeId);
  const open = authService.isRequestPeriodOpen(c.req.param('yearMonth')!, info.requestDeadlineDay);
  return c.json({ open, deadlineDay: info.requestDeadlineDay });
});

// 現在のログインユーザー情報を返す（フロントがロール判定に使う）
authed.get('/me', async (c) => {
  return c.json({
    role: c.get('role'),
    storeId: c.get('storeId'),
    staffId: c.get('staffId') ?? null,
    managerId: c.get('managerId') ?? null,
    name: c.get('name') ?? null,
  });
});

// ========================================
// 管理者・店長以上のAPI
// ========================================
const managerOnly = requireRole('headquarters_admin', 'store_manager');

// 全スタッフのシフト希望を取得する
authed.get('/admin/shift-requests/:yearMonth', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const requests = await shiftRequestService.getAllRequests(db, storeId, c.req.param('yearMonth')!);
  return c.json(requests);
});

// シフト希望の提出サマリーを取得する
authed.get('/admin/request-summary/:yearMonth', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const summary = await shiftRequestService.getRequestSummary(db, storeId, c.req.param('yearMonth')!);
  return c.json(summary);
});

// 確定シフト表を取得する
authed.get('/admin/schedules/:yearMonth', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const schedules = await shiftScheduleService.getShiftSchedule(db, storeId, c.req.param('yearMonth')!);
  return c.json(schedules);
});

// シフト自動作成
authed.post('/admin/schedules/auto-generate', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.generateAutoShift(db, storeId, body.yearMonth);
  return c.json(result);
});

// シフト1件追加
authed.post('/admin/schedules/entry', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ staffId: string; yearMonth: string; date: string; startTime: string; endTime: string }>();
  const result = await shiftScheduleService.addShiftEntry(db, storeId, body);
  return c.json(result);
});

// シフト1件更新
authed.put('/admin/schedules/entry/:shiftId', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ startTime?: string; endTime?: string }>();
  const result = await shiftScheduleService.updateShiftEntry(db, storeId, c.req.param('shiftId')!, body);
  return c.json(result);
});

// シフト1件削除
authed.delete('/admin/schedules/entry/:shiftId', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const result = await shiftScheduleService.deleteShiftEntry(db, storeId, c.req.param('shiftId')!);
  return c.json(result);
});

// シフト全クリア
authed.post('/admin/schedules/clear', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.clearShift(db, storeId, body.yearMonth);
  return c.json(result);
});

// 余剰自動解消
authed.post('/admin/schedules/resolve-surplus', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.resolveSurplus(db, storeId, body.yearMonth);
  return c.json(result);
});

// 人員不足テキスト自動生成
authed.post('/admin/schedules/shortage-text', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.generateShortageText(db, storeId, body.yearMonth);
  return c.json(result);
});

// シフト確定
authed.post('/admin/schedules/finalize', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.finalizeShift(db, storeId, body.yearMonth);
  return c.json(result);
});

// --- スタッフ管理 ---

authed.get('/admin/staff', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const staff = await staffService.getAllStaff(db, storeId);
  return c.json(staff);
});

authed.get('/admin/staff/:staffId', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const staff = await staffService.getStaffById(db, c.req.param('staffId')!);
  if (!staff) return c.json({ success: false, message: 'スタッフが見つかりません' }, 404);
  return c.json(staff);
});

authed.post('/admin/staff', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json();
  const result = await staffService.addStaff(db, storeId, body);
  return c.json(result);
});

authed.put('/admin/staff/:staffId', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json();
  const result = await staffService.updateStaff(db, storeId, c.req.param('staffId')!, body);
  return c.json(result);
});

// 新機能3: スタッフ退職処理（管理者パスワード必須）
authed.post('/admin/staff/:staffId/retire', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const operator = c.get('name') || '管理者';
  const body = await c.req.json<{ adminPassword: string; reason?: string }>();

  if (!body.adminPassword) {
    return c.json({ success: false, message: '管理者パスワードの入力が必要です' }, 400);
  }

  const result = await staffService.retireStaffWithAuth(
    db,
    storeId,
    c.req.param('staffId')!,
    body.adminPassword,
    operator,
    body.reason || ''
  );
  return c.json(result, result.success ? 200 : 403);
});

// 管理者が特定スタッフのPINをリセット（忘れた時用）
authed.post('/admin/staff/:staffId/reset-pin', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const body = await c.req.json<{ adminPassword: string }>();
  const storeId = c.get('storeId') ?? 0;

  const ok = await authService.verifyAdminPassword(db, storeId, body.adminPassword);
  if (!ok) {
    return c.json({ success: false, message: '管理者パスワードが正しくありません' }, 403);
  }

  // PINハッシュを空にする（次回ログイン時に再設定が必要）
  await dao.setStaffPinHash(db, c.req.param('staffId')!, '');
  await dao.addLog(db, storeId, c.get('name') || '管理者', 'PINリセット', c.req.param('staffId')!);
  return c.json({ success: true, message: 'PINをリセットしました。次回ログイン時に再設定してください。' });
});

// --- 人件費 ---

authed.post('/admin/labor-cost/calculate', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await laborCostService.calculateLaborCost(db, storeId, body.yearMonth);
  return c.json(result);
});

authed.get('/admin/labor-cost/:yearMonth', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const report = await laborCostService.getLaborCostReport(db, storeId, c.req.param('yearMonth')!);
  return c.json(report);
});

// --- LINE通知 ---

authed.post('/admin/line/notify-shift', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const baseUrl = new URL(c.req.url).origin;
  const result = await lineNotifyService.sendShiftConfirmNotification(db, storeId, body.yearMonth, baseUrl);
  return c.json(result);
});

authed.post('/admin/line/notify-reminder', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string }>();
  const baseUrl = new URL(c.req.url).origin;
  const result = await lineNotifyService.sendReminderNotification(db, storeId, body.yearMonth, baseUrl);
  return c.json(result);
});

authed.post('/admin/line/test', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const result = await lineNotifyService.testLineNotification(db, storeId);
  return c.json(result);
});

// --- 管理者パスワード設定（店長/本部管理者） ---
authed.post('/admin/set-password', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ password: string }>();
  await authService.setAdminPassword(db, storeId, body.password);
  return c.json({ success: true, message: 'パスワードを設定しました' });
});

// --- ヘルプ募集URL ---

// 募集一覧（自店舗）
authed.get('/admin/help-campaigns', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const list = await helpCampaignService.listCampaigns(db, storeId);
  return c.json(list);
});

// 新規発行
authed.post('/admin/help-campaigns', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ yearMonth: string; title?: string; message?: string; expiresAt?: string | null }>();
  const result = await helpCampaignService.createCampaign(db, storeId, {
    ...body,
    createdBy: c.get('name') || '管理者',
  });
  return c.json(result, result.success ? 200 : 400);
});

// 停止
authed.post('/admin/help-campaigns/:id/deactivate', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const result = await helpCampaignService.deactivateCampaign(db, storeId, c.req.param('id')!, c.get('name') || '管理者');
  return c.json(result, result.success ? 200 : 400);
});

// 応募一覧
authed.get('/admin/help-applications', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const campaignId = c.req.query('campaignId');
  const status = c.req.query('status');
  const list = await helpCampaignService.listApplications(db, storeId, { campaignId, status });
  return c.json(list);
});

// 応募の承認
authed.post('/admin/help-applications/:id/approve', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const result = await helpCampaignService.approveApplication(db, storeId, c.req.param('id')!, c.get('name') || '管理者');
  return c.json(result, result.success ? 200 : 400);
});

// 応募の却下
authed.post('/admin/help-applications/:id/reject', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: '' }));
  const result = await helpCampaignService.rejectApplication(
    db,
    storeId,
    c.req.param('id')!,
    c.get('name') || '管理者',
    body.reason || ''
  );
  return c.json(result, result.success ? 200 : 400);
});

// --- 店舗設定 ---

authed.get('/admin/settings', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const settings = await dao.getSettings(db, storeId);
  return c.json(settings);
});

authed.post('/admin/settings', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const body = await c.req.json<Record<string, string>>();
  for (const [key, value] of Object.entries(body)) {
    await dao.updateSetting(db, storeId, key, value);
  }
  return c.json({ success: true, message: '設定を保存しました' });
});

// ========================================
// 本部管理者のみのAPI
// ========================================
const hqOnly = requireRole('headquarters_admin');

// 全店舗一覧（本部管理者ダッシュボード用）
authed.get('/hq/stores', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const stores = await dao.getAllStores(db);
  return c.json(stores);
});

// 特定店舗のスタッフ一覧を取得（本部管理者用）
authed.get('/hq/stores/:storeId/staff', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = parseInt(c.req.param('storeId')!);
  const staff = await staffService.getAllStaff(db, storeId);
  return c.json(staff);
});

// 特定店舗の人件費を取得（本部管理者用）
authed.get('/hq/stores/:storeId/labor-cost/:yearMonth', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = parseInt(c.req.param('storeId')!);
  const report = await laborCostService.getLaborCostReport(db, storeId, c.req.param('yearMonth')!);
  return c.json(report);
});

// 全店舗横断のサマリー（人件費合計、シフト状況など）
authed.get('/hq/summary/:yearMonth', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const yearMonth = c.req.param('yearMonth')!;
  const stores = await dao.getAllStores(db);

  const summary = await Promise.all(
    stores.map(async (s) => {
      const report = await laborCostService.getLaborCostReport(db, s.id, yearMonth);
      return {
        storeId: s.id,
        storeCode: s.code,
        storeName: s.name,
        totalCost: (report as { totalCost?: number })?.totalCost || 0,
        staffCount: (report as { staffCosts?: unknown[] })?.staffCosts?.length || 0,
      };
    })
  );

  const grandTotal = summary.reduce((acc, s) => acc + (s.totalCost || 0), 0);
  return c.json({ stores: summary, grandTotal });
});

// 管理者アカウント作成（本部管理者のみ）
authed.post('/hq/managers', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const body = await c.req.json<{
    email: string;
    password: string;
    name: string;
    role: 'headquarters_admin' | 'store_manager';
    storeId: number | null;
  }>();
  const result = await authService.registerManager(db, body.email, body.password, body.name, body.role, body.storeId);
  return c.json(result, result.ok ? 200 : 400);
});

// 管理者アカウント一覧（本部管理者のみ）
authed.get('/hq/managers', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const list = await dao.listManagers(db);
  return c.json(list);
});

// 店長のパスワードをリセット（本部管理者のみ）
authed.put('/hq/managers/:id/password', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const body = await c.req.json<{ password: string }>();
  if (!body.password || body.password.length < 8) {
    return c.json({ success: false, message: 'パスワードは8文字以上にしてください' }, 400);
  }
  const { hashPassword } = await import('./utils');
  const newHash = await hashPassword(body.password);
  const ok = await dao.updateManagerPassword(db, c.req.param('id')!, newHash);
  if (!ok) return c.json({ success: false, message: '店長アカウントが見つかりません' }, 404);
  await dao.addLog(db, null, c.get('name') || '本部管理者', '店長パスワードリセット', c.req.param('id')!);
  return c.json({ success: true, message: 'パスワードをリセットしました' });
});

// 店長アカウントを更新（名前・有効/無効）
authed.put('/hq/managers/:id', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const body = await c.req.json<{ name?: string; isActive?: boolean }>();
  const ok = await dao.updateManagerInfo(db, c.req.param('id')!, body);
  if (!ok) return c.json({ success: false, message: '更新に失敗しました' }, 404);
  return c.json({ success: true, message: '更新しました' });
});

// 店長アカウントを削除
authed.delete('/hq/managers/:id', hqOnly, async (c) => {
  const db = getSupabase(c.env);
  const target = await dao.getManagerById(db, c.req.param('id')!);
  if (!target) return c.json({ success: false, message: '店長アカウントが見つかりません' }, 404);
  // 本部管理者の自分自身は削除できない
  if (target.role === 'headquarters_admin' && target.id === c.get('managerId')) {
    return c.json({ success: false, message: '自分自身のアカウントは削除できません' }, 400);
  }
  const ok = await dao.deleteManager(db, c.req.param('id')!);
  if (!ok) return c.json({ success: false, message: '削除に失敗しました' }, 500);
  await dao.addLog(db, target.storeId, c.get('name') || '本部管理者', '管理者削除', target.email);
  return c.json({ success: true, message: '削除しました' });
});

// 店長がスタッフのPINを直接設定する（新機能: 自己設定を廃止してここに寄せる）
authed.post('/admin/staff/:staffId/set-pin', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const body = await c.req.json<{ pin: string; adminPassword: string }>();
  const storeId = c.get('storeId') ?? 0;

  // 誤操作防止のため管理者パスワードも要求する
  const passOk = await authService.verifyAdminPassword(db, storeId, body.adminPassword);
  if (!passOk) {
    return c.json({ success: false, message: '管理者パスワードが正しくありません' }, 403);
  }

  if (!/^\d{4}$/.test(body.pin)) {
    return c.json({ success: false, message: 'PINは4桁の数字で設定してください' }, 400);
  }

  // スタッフが自店舗に所属しているか確認
  const staff = await dao.getStaffDataById(db, c.req.param('staffId')!);
  if (!staff) return c.json({ success: false, message: 'スタッフが見つかりません' }, 404);

  const result = await authService.setStaffPin(db, c.req.param('staffId')!, body.pin);
  if (result.success) {
    await dao.addLog(db, storeId, c.get('name') || '管理者', 'スタッフPIN設定', staff.name + ' (' + c.req.param('staffId')! + ')');
  }
  return c.json(result, result.success ? 200 : 400);
});

// ========================================
// 5-3 給与明細（社労士CSV取込）
// ========================================

// 管理者・本部: その月の店舗内全員の給与明細を取得
authed.get('/admin/payslips/:yearMonth', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const list = await payslipService.getStorePayslips(db, storeId, c.req.param('yearMonth')!);
  return c.json(list);
});

// 管理者・本部: CSV取込（CSVは text として送る）
authed.post('/admin/payslips/:yearMonth/upload', managerOnly, async (c) => {
  const db = getSupabase(c.env);
  const storeId = c.get('storeId') ?? 0;
  const operator = c.get('name') || c.get('managerId') || 'manager';
  const body = await c.req.json<{ csvText: string }>();
  if (!body || !body.csvText) {
    return c.json({ success: false, message: 'CSV本文が空です' }, 400);
  }
  const result = await payslipService.uploadPayslipCsv(db, storeId, c.req.param('yearMonth')!, body.csvText, operator);
  return c.json(result, result.success ? 200 : 400);
});

// スタッフ自身: 自分の給与明細がある月一覧
authed.get('/staff/me/payslips', async (c) => {
  const role = c.get('role');
  const myStaffId = c.get('staffId');
  if (role !== 'staff' || !myStaffId) {
    return c.json({ success: false, message: 'スタッフとしてログインしてください' }, 403);
  }
  const db = getSupabase(c.env);
  const months = await payslipService.listMyMonths(db, myStaffId);
  return c.json({ success: true, months });
});

// スタッフ自身: 指定月の給与明細
authed.get('/staff/me/payslips/:yearMonth', async (c) => {
  const role = c.get('role');
  const myStaffId = c.get('staffId');
  if (role !== 'staff' || !myStaffId) {
    return c.json({ success: false, message: 'スタッフとしてログインしてください' }, 403);
  }
  const db = getSupabase(c.env);
  const slip = await payslipService.getMyPayslip(db, myStaffId, c.req.param('yearMonth')!);
  if (!slip) {
    return c.json({ success: false, message: 'その月の給与明細はまだ登録されていません' }, 404);
  }
  return c.json({ success: true, payslip: slip });
});

// 認証付きルートをマウント
app.route('/api', authed);

export default app;
