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

  // 管理者ログイン
  verifyAdminPassword: function(password) {
    return this._fetch('POST', '/stores/' + this._storeCode + '/admin/login', { password: password });
  },

  // スタッフログイン
  staffLogin: function(staffId) {
    return this._fetch('POST', '/stores/' + this._storeCode + '/staff/login', { staffId: staffId });
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

  retireStaff: function(staffId) {
    return this._fetch('POST', '/admin/staff/' + staffId + '/retire');
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
  }
};
