// ぎゅう丸シフト管理システム - Honoルーター（Code.gs の移植）

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { createToken, verifyToken, authMiddleware } from './middleware/auth';
import { generateTimeSlots } from './utils';

// サービス
import * as authService from './services/auth';
import * as staffService from './services/staff';
import * as shiftRequestService from './services/shift-request';
import * as shiftScheduleService from './services/shift-schedule';
import * as laborCostService from './services/labor-cost';
import * as lineNotifyService from './services/line-notify';
import * as dao from './db/dao';

type Variables = {
  storeId: number;
  role: string;
  staffId?: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS設定
app.use('/api/*', cors());

// ========================================
// 公開API（認証不要）
// ========================================

// 店舗一覧を取得
app.get('/api/stores', async (c) => {
  const { getAllStores } = await import('./db/dao');
  const stores = await getAllStores(c.env.DB);
  return c.json(stores);
});

// スタッフ選択用の一覧を取得（店舗コード指定）
app.get('/api/stores/:storeCode/staff-list', async (c) => {
  const { getStoreByCode } = await import('./db/dao');
  const store = await getStoreByCode(c.env.DB, c.req.param('storeCode'));
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);

  const list = await authService.getStaffList(c.env.DB, store.id);
  return c.json(list);
});

// 店舗情報を取得
app.get('/api/stores/:storeCode/info', async (c) => {
  const { getStoreByCode } = await import('./db/dao');
  const store = await getStoreByCode(c.env.DB, c.req.param('storeCode'));
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);

  const info = await authService.getCurrentStoreInfo(c.env.DB, store.id);
  return c.json(info);
});

// 時間選択肢を取得
app.get('/api/time-slots', (c) => {
  return c.json(generateTimeSlots());
});

// 管理者ログイン
app.post('/api/stores/:storeCode/admin/login', async (c) => {
  const { getStoreByCode } = await import('./db/dao');
  const store = await getStoreByCode(c.env.DB, c.req.param('storeCode'));
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);

  const body = await c.req.json<{ password: string }>();

  // パスワード未設定の場合は初回セットアップとして保存する
  const { getSetting } = await import('./db/dao');
  const storedHash = await getSetting(c.env.DB, store.id, '管理者パスワード');
  if (!storedHash) {
    await authService.setAdminPassword(c.env.DB, store.id, body.password);
    const token = await createToken(c.env.JWT_SECRET, { storeId: store.id, role: 'admin' });
    return c.json({ success: true, token, storeName: store.name, firstTime: true });
  }

  const valid = await authService.verifyAdminPassword(c.env.DB, store.id, body.password);
  if (!valid) {
    return c.json({ success: false, message: 'パスワードが正しくありません' }, 401);
  }

  const token = await createToken(c.env.JWT_SECRET, { storeId: store.id, role: 'admin' });
  return c.json({ success: true, token, storeName: store.name });
});

// スタッフログイン（スタッフ選択）
app.post('/api/stores/:storeCode/staff/login', async (c) => {
  const { getStoreByCode } = await import('./db/dao');
  const store = await getStoreByCode(c.env.DB, c.req.param('storeCode'));
  if (!store) return c.json({ success: false, message: '店舗が見つかりません' }, 404);

  const body = await c.req.json<{ staffId: string }>();
  const staff = await staffService.getStaffById(c.env.DB, body.staffId);
  if (!staff) {
    return c.json({ success: false, message: 'スタッフが見つかりません' }, 404);
  }

  const token = await createToken(c.env.JWT_SECRET, { storeId: store.id, role: 'staff', staffId: staff.id });
  return c.json({ success: true, token, staffName: staff.name, staffId: staff.id });
});

// ========================================
// 認証必要なAPI
// ========================================

const authed = new Hono<{ Bindings: Env; Variables: Variables }>();
authed.use('*', authMiddleware());

// --- スタッフ用API ---

// シフト希望を提出する
authed.post('/shift-requests', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ staffId: string; yearMonth: string; requests: Array<{ date: string; type: string; startTime?: string; endTime?: string; note?: string }> }>();
  const result = await shiftRequestService.submitShiftRequests(c.env.DB, storeId, body.staffId, body.yearMonth, body.requests);
  return c.json(result);
});

// 自分のシフト希望を取得する
authed.get('/shift-requests/:staffId/:yearMonth', async (c) => {
  const requests = await shiftRequestService.getMyRequests(c.env.DB, c.req.param('staffId'), c.req.param('yearMonth'));
  return c.json(requests);
});

// 自分の確定シフトを取得する
authed.get('/my-shifts/:staffId/:yearMonth', async (c) => {
  const storeId = c.get('storeId');
  const shifts = await shiftScheduleService.getMyShift(c.env.DB, storeId, c.req.param('staffId'), c.req.param('yearMonth'));
  return c.json(shifts);
});

// シフト希望受付期間のチェック
authed.get('/request-period/:yearMonth', async (c) => {
  const storeId = c.get('storeId');
  const info = await authService.getCurrentStoreInfo(c.env.DB, storeId);
  const open = authService.isRequestPeriodOpen(c.req.param('yearMonth'), info.requestDeadlineDay);
  return c.json({ open });
});

// --- 管理者用API ---

// 全スタッフのシフト希望を取得する
authed.get('/admin/shift-requests/:yearMonth', async (c) => {
  const storeId = c.get('storeId');
  const requests = await shiftRequestService.getAllRequests(c.env.DB, storeId, c.req.param('yearMonth'));
  return c.json(requests);
});

// シフト希望の提出サマリーを取得する
authed.get('/admin/request-summary/:yearMonth', async (c) => {
  const storeId = c.get('storeId');
  const summary = await shiftRequestService.getRequestSummary(c.env.DB, storeId, c.req.param('yearMonth'));
  return c.json(summary);
});

// 確定シフト表を取得する
authed.get('/admin/schedules/:yearMonth', async (c) => {
  const storeId = c.get('storeId');
  const schedules = await shiftScheduleService.getShiftSchedule(c.env.DB, storeId, c.req.param('yearMonth'));
  return c.json(schedules);
});

// シフト自動作成
authed.post('/admin/schedules/auto-generate', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.generateAutoShift(c.env.DB, storeId, body.yearMonth);
  return c.json(result);
});

// シフト1件追加
authed.post('/admin/schedules/entry', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ staffId: string; yearMonth: string; date: string; startTime: string; endTime: string }>();
  const result = await shiftScheduleService.addShiftEntry(c.env.DB, storeId, body);
  return c.json(result);
});

// シフト1件更新
authed.put('/admin/schedules/entry/:shiftId', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ startTime?: string; endTime?: string }>();
  const result = await shiftScheduleService.updateShiftEntry(c.env.DB, storeId, c.req.param('shiftId'), body);
  return c.json(result);
});

// シフト1件削除
authed.delete('/admin/schedules/entry/:shiftId', async (c) => {
  const storeId = c.get('storeId');
  const result = await shiftScheduleService.deleteShiftEntry(c.env.DB, storeId, c.req.param('shiftId'));
  return c.json(result);
});

// シフト全クリア
authed.post('/admin/schedules/clear', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.clearShift(c.env.DB, storeId, body.yearMonth);
  return c.json(result);
});

// シフト確定
authed.post('/admin/schedules/finalize', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await shiftScheduleService.finalizeShift(c.env.DB, storeId, body.yearMonth);
  return c.json(result);
});

// --- スタッフ管理 ---

// 全スタッフ取得
authed.get('/admin/staff', async (c) => {
  const storeId = c.get('storeId');
  const staff = await staffService.getAllStaff(c.env.DB, storeId);
  return c.json(staff);
});

// スタッフ1人取得
authed.get('/admin/staff/:staffId', async (c) => {
  const staff = await staffService.getStaffById(c.env.DB, c.req.param('staffId'));
  if (!staff) return c.json({ success: false, message: 'スタッフが見つかりません' }, 404);
  return c.json(staff);
});

// スタッフ追加
authed.post('/admin/staff', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json();
  const result = await staffService.addStaff(c.env.DB, storeId, body);
  return c.json(result);
});

// スタッフ更新
authed.put('/admin/staff/:staffId', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json();
  const result = await staffService.updateStaff(c.env.DB, storeId, c.req.param('staffId'), body);
  return c.json(result);
});

// スタッフ退職処理
authed.post('/admin/staff/:staffId/retire', async (c) => {
  const storeId = c.get('storeId');
  const result = await staffService.retireStaff(c.env.DB, storeId, c.req.param('staffId'));
  return c.json(result);
});

// --- 人件費 ---

// 人件費計算
authed.post('/admin/labor-cost/calculate', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ yearMonth: string }>();
  const result = await laborCostService.calculateLaborCost(c.env.DB, storeId, body.yearMonth);
  return c.json(result);
});

// 人件費レポート取得
authed.get('/admin/labor-cost/:yearMonth', async (c) => {
  const storeId = c.get('storeId');
  const report = await laborCostService.getLaborCostReport(c.env.DB, storeId, c.req.param('yearMonth'));
  return c.json(report);
});

// --- LINE通知 ---

// シフト確定通知
authed.post('/admin/line/notify-shift', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ yearMonth: string }>();
  const baseUrl = new URL(c.req.url).origin;
  const result = await lineNotifyService.sendShiftConfirmNotification(c.env.DB, storeId, body.yearMonth, baseUrl);
  return c.json(result);
});

// リマインド通知
authed.post('/admin/line/notify-reminder', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ yearMonth: string }>();
  const baseUrl = new URL(c.req.url).origin;
  const result = await lineNotifyService.sendReminderNotification(c.env.DB, storeId, body.yearMonth, baseUrl);
  return c.json(result);
});

// LINE通知テスト
authed.post('/admin/line/test', async (c) => {
  const storeId = c.get('storeId');
  const result = await lineNotifyService.testLineNotification(c.env.DB, storeId);
  return c.json(result);
});

// --- 管理者パスワード設定 ---

authed.post('/admin/set-password', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<{ password: string }>();
  await authService.setAdminPassword(c.env.DB, storeId, body.password);
  return c.json({ success: true, message: 'パスワードを設定しました' });
});

// --- 店舗設定 ---

// 店舗設定を取得
authed.get('/admin/settings', async (c) => {
  const storeId = c.get('storeId');
  const settings = await dao.getSettings(c.env.DB, storeId);
  return c.json(settings);
});

// 店舗設定を更新
authed.post('/admin/settings', async (c) => {
  const storeId = c.get('storeId');
  const body = await c.req.json<Record<string, string>>();
  for (const [key, value] of Object.entries(body)) {
    await dao.updateSetting(c.env.DB, storeId, key, value);
  }
  return c.json({ success: true, message: '設定を保存しました' });
});

// 認証付きルートをマウント
app.route('/api', authed);

export default app;
