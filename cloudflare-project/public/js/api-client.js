// ぎゅう丸シフト管理システム - API クライアント（fetch版）
// google.script.run の代わりに REST API を呼び出す

var API = {
  // 現在のトークン
  _token: '',
  // 店舗コード
  _storeCode: '',

  // トークンを設定する
  setToken: function(token) {
    this._token = token;
  },

  // 店舗コードを設定する
  setStoreCode: function(code) {
    this._storeCode = code;
  },

  // 汎用のfetch呼び出し
  _fetch: function(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (this._token) {
      headers['Authorization'] = 'Bearer ' + this._token;
    }
    var opts = { method: method, headers: headers };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    return fetch('/api' + path, opts).then(function(res) {
      if (!res.ok && res.status === 401) {
        // 認証切れ → ログイン画面に戻す
        App.showToast('セッションが切れました。再ログインしてください。', 'error');
        setTimeout(function() { location.reload(); }, 1500);
        throw new Error('認証切れ');
      }
      return res.json();
    });
  },

  // ========================================
  // 公開API（認証不要）
  // ========================================

  // 店舗一覧
  getStores: function() {
    return this._fetch('GET', '/stores');
  },

  // スタッフ一覧
  getStaffList: function() {
    return this._fetch('GET', '/stores/' + this._storeCode + '/staff-list');
  },

  // 店舗情報
  getCurrentStoreInfo: function() {
    return this._fetch('GET', '/stores/' + this._storeCode + '/info');
  },

  // 時間選択肢
  getTimeSlots: function() {
    return this._fetch('GET', '/time-slots');
  },

  // 管理者ログイン（店舗パスワード方式・後方互換）
  verifyAdminPassword: function(password) {
    return this._fetch('POST', '/stores/' + this._storeCode + '/admin/login', { password: password });
  },

  // スタッフPINログイン（新機能1）
  staffLogin: function(staffId, pin) {
    return this._fetch('POST', '/stores/' + this._storeCode + '/staff/login', { staffId: staffId, pin: pin });
  },

  // PIN設定済みかチェック（スタッフ選択画面用）
  staffHasPin: function(staffId) {
    return this._fetch('GET', '/stores/' + this._storeCode + '/staff/' + staffId + '/has-pin');
  },

  // 初回PIN設定（未設定スタッフ用）
  setupStaffPin: function(staffId, pin) {
    return this._fetch('POST', '/stores/' + this._storeCode + '/staff/' + staffId + '/setup-pin', { pin: pin });
  },

  // 管理者によるPINリセット（ハッシュ空にして、次回は再発行が必要）
  resetStaffPin: function(staffId, adminPassword) {
    return this._fetch('POST', '/admin/staff/' + staffId + '/reset-pin', { adminPassword: adminPassword });
  },

  // 店長がスタッフのPINを直接発行する
  setStaffPin: function(staffId, pin, adminPassword) {
    return this._fetch('POST', '/admin/staff/' + staffId + '/set-pin', { pin: pin, adminPassword: adminPassword });
  },

  // 本部管理者・店長のメール＋パスワードログイン（新機能4）
  managerLogin: function(email, password) {
    return this._fetch('POST', '/managers/login', { email: email, password: password });
  },

  // 自分のログイン情報を取得
  getMe: function() {
    return this._fetch('GET', '/me');
  },

  // ========================================
  // 本部管理者API（新機能4）
  // ========================================

  hqGetStores: function() {
    return this._fetch('GET', '/hq/stores');
  },

  // 店舗を新規追加（ベトナム店・台湾店など）
  // data: { code, name, type }
  hqCreateStore: function(data) {
    return this._fetch('POST', '/hq/stores', data);
  },

  hqGetStoreStaff: function(storeId) {
    return this._fetch('GET', '/hq/stores/' + storeId + '/staff');
  },

  hqGetStoreLaborCost: function(storeId, yearMonth) {
    return this._fetch('GET', '/hq/stores/' + storeId + '/labor-cost/' + yearMonth);
  },

  hqGetSummary: function(yearMonth) {
    return this._fetch('GET', '/hq/summary/' + yearMonth);
  },

  hqCreateManager: function(data) {
    return this._fetch('POST', '/hq/managers', data);
  },

  hqListManagers: function() {
    return this._fetch('GET', '/hq/managers');
  },

  hqUpdateManager: function(id, data) {
    return this._fetch('PUT', '/hq/managers/' + id, data);
  },

  hqResetManagerPassword: function(id, newPassword) {
    return this._fetch('PUT', '/hq/managers/' + id + '/password', { password: newPassword });
  },

  hqDeleteManager: function(id) {
    return this._fetch('DELETE', '/hq/managers/' + id);
  },

  // ========================================
  // シフト希望
  // ========================================

  submitShiftRequests: function(staffId, yearMonth, requests) {
    return this._fetch('POST', '/shift-requests', { staffId: staffId, yearMonth: yearMonth, requests: requests });
  },

  getMyRequests: function(staffId, yearMonth) {
    return this._fetch('GET', '/shift-requests/' + staffId + '/' + yearMonth);
  },

  getAllRequests: function(yearMonth) {
    return this._fetch('GET', '/admin/shift-requests/' + yearMonth);
  },

  getRequestSummary: function(yearMonth) {
    return this._fetch('GET', '/admin/request-summary/' + yearMonth);
  },

  isRequestPeriodOpen: function(yearMonth) {
    return this._fetch('GET', '/request-period/' + yearMonth);
  },

  // ========================================
  // 確定シフト
  // ========================================

  generateAutoShift: function(yearMonth) {
    return this._fetch('POST', '/admin/schedules/auto-generate', { yearMonth: yearMonth });
  },

  getShiftSchedule: function(yearMonth) {
    return this._fetch('GET', '/admin/schedules/' + yearMonth);
  },

  getMyShift: function(staffId, yearMonth) {
    return this._fetch('GET', '/my-shifts/' + staffId + '/' + yearMonth);
  },

  updateShiftEntry: function(shiftId, data) {
    return this._fetch('PUT', '/admin/schedules/entry/' + shiftId, data);
  },

  addShiftEntry: function(data) {
    return this._fetch('POST', '/admin/schedules/entry', data);
  },

  deleteShiftEntry: function(shiftId) {
    return this._fetch('DELETE', '/admin/schedules/entry/' + shiftId);
  },

  resolveSurplus: function(yearMonth) {
    return this._fetch('POST', '/admin/schedules/resolve-surplus', { yearMonth: yearMonth });
  },

  generateShortageText: function(yearMonth) {
    return this._fetch('POST', '/admin/schedules/shortage-text', { yearMonth: yearMonth });
  },

  clearShift: function(yearMonth) {
    return this._fetch('POST', '/admin/schedules/clear', { yearMonth: yearMonth });
  },

  finalizeShift: function(yearMonth) {
    return this._fetch('POST', '/admin/schedules/finalize', { yearMonth: yearMonth });
  },

  // ========================================
  // スタッフ管理
  // ========================================

  getAllStaff: function() {
    return this._fetch('GET', '/admin/staff');
  },

  getStaffById: function(staffId) {
    return this._fetch('GET', '/admin/staff/' + staffId);
  },

  addStaff: function(staffData) {
    return this._fetch('POST', '/admin/staff', staffData);
  },

  updateStaff: function(staffId, staffData) {
    return this._fetch('PUT', '/admin/staff/' + staffId, staffData);
  },

  retireStaff: function(staffId, adminPassword, reason) {
    return this._fetch('POST', '/admin/staff/' + staffId + '/retire', {
      adminPassword: adminPassword,
      reason: reason || ''
    });
  },

  // ========================================
  // 人件費
  // ========================================

  calculateLaborCost: function(yearMonth) {
    return this._fetch('POST', '/admin/labor-cost/calculate', { yearMonth: yearMonth });
  },

  getLaborCostReport: function(yearMonth) {
    return this._fetch('GET', '/admin/labor-cost/' + yearMonth);
  },

  // ========================================
  // LINE通知
  // ========================================

  sendShiftConfirmNotification: function(yearMonth) {
    return this._fetch('POST', '/admin/line/notify-shift', { yearMonth: yearMonth });
  },

  sendReminderNotification: function(yearMonth) {
    return this._fetch('POST', '/admin/line/notify-reminder', { yearMonth: yearMonth });
  },

  testLineNotification: function() {
    return this._fetch('POST', '/admin/line/test');
  },

  // ========================================
  // 店舗設定
  // ========================================

  getStoreSettings: function() {
    return this._fetch('GET', '/admin/settings');
  },

  updateStoreSettings: function(settings) {
    return this._fetch('POST', '/admin/settings', settings);
  },

  // ========================================
  // 5-3 給与明細（社労士CSV取込）
  // ========================================

  // 管理者: その月の店舗内全員の給与明細を取得
  getStorePayslips: function(yearMonth) {
    return this._fetch('GET', '/admin/payslips/' + yearMonth);
  },
  // 管理者: CSV取込
  uploadPayslipCsv: function(yearMonth, csvText) {
    return this._fetch('POST', '/admin/payslips/' + yearMonth + '/upload', { csvText: csvText });
  },
  // スタッフ自身: 給与明細がある月一覧
  listMyPayslipMonths: function() {
    return this._fetch('GET', '/staff/me/payslips');
  },
  // スタッフ自身: 指定月の給与明細
  getMyPayslip: function(yearMonth) {
    return this._fetch('GET', '/staff/me/payslips/' + yearMonth);
  },

  // ========================================
  // ヘルプ募集URL（管理者用）
  // ========================================

  // 募集一覧
  listHelpCampaigns: function() {
    return this._fetch('GET', '/admin/help-campaigns');
  },

  // 新規募集を作成
  createHelpCampaign: function(yearMonth, title, message, expiresAt) {
    return this._fetch('POST', '/admin/help-campaigns', {
      yearMonth: yearMonth,
      title: title || 'ヘルプ募集',
      message: message || '',
      expiresAt: expiresAt || null
    });
  },

  // 募集を停止
  deactivateHelpCampaign: function(id) {
    return this._fetch('POST', '/admin/help-campaigns/' + id + '/deactivate');
  },

  // 応募一覧
  listHelpApplications: function(params) {
    var q = '';
    if (params && params.campaignId) q += (q ? '&' : '?') + 'campaignId=' + encodeURIComponent(params.campaignId);
    if (params && params.status) q += (q ? '&' : '?') + 'status=' + encodeURIComponent(params.status);
    return this._fetch('GET', '/admin/help-applications' + q);
  },

  // 応募を承認
  approveHelpApplication: function(id) {
    return this._fetch('POST', '/admin/help-applications/' + id + '/approve');
  },

  // 応募を却下
  rejectHelpApplication: function(id, reason) {
    return this._fetch('POST', '/admin/help-applications/' + id + '/reject', { reason: reason || '' });
  }
};
