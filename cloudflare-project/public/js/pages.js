// ぎゅう丸シフト管理システム - 各画面のロジック（GAS版HTMLから移植）

// ========================================
// ヘルパー関数
// ========================================
// HTMLエスケープ（XSS対策）
// スタッフ名や備考など、ユーザー入力を innerHTML に入れる前に必ず通す
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// エイリアス（短く書きたいとき用）
var esc = escapeHtml;

function getNextMonthStr() {
  var d = new Date(); d.setMonth(d.getMonth() + 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}

function getCurrentMonthStr() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}

// ========================================
// 店舗選択画面
// ========================================
// 見栄え用の海外店舗ダミー（DBに無いがUIには表示する）
// クリックされても本番DBに該当店舗が無いため、「準備中」のメッセージを出す。
var DUMMY_OVERSEAS_STORES = [
  { code: 'VIETNAM', name: 'ベトナム店', type: '海外', flag: '🇻🇳', _coming: true },
  { code: 'TAIWAN',  name: '台湾店',    type: '海外', flag: '🇹🇼', _coming: true }
];

function onShow_store_select() {
  API.getStores().then(function(stores) {
    var container = document.getElementById('store-list');
    // 既にダミーcodeで本物が登録されていた場合は重複させない
    var existingCodes = {};
    for (var k = 0; k < stores.length; k++) existingCodes[stores[k].code] = true;
    var merged = stores.slice();
    for (var d = 0; d < DUMMY_OVERSEAS_STORES.length; d++) {
      if (!existingCodes[DUMMY_OVERSEAS_STORES[d].code]) merged.push(DUMMY_OVERSEAS_STORES[d]);
    }

    if (merged.length === 0) {
      container.innerHTML = '<div class="alert alert-warning">店舗が登録されていません</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < merged.length; i++) {
      var s = merged[i];
      var flag = s.flag ? esc(s.flag) + ' ' : '';
      if (s._coming) {
        // ダミー：見栄えだけのカード（クリックしたら準備中アラート）
        html += '<div class="store-card store-card--coming" onclick="selectComingSoonStore(\'' + esc(s.name) + '\')" style="opacity:0.85;border:2px dashed #BE2828;background:linear-gradient(135deg,#FFF8E1,#FFEBEE)">';
        html += '<div class="store-card-name">' + flag + esc(s.name) + '</div>';
        html += '<div class="store-card-type" style="color:#BE2828;font-weight:bold">準備中（Coming Soon）</div>';
        html += '</div>';
      } else {
        html += '<div class="store-card" onclick="selectStore(\'' + esc(s.code) + '\', \'' + esc(s.name) + '\')">';
        html += '<div class="store-card-name">' + esc(s.name) + '</div>';
        html += '<div class="store-card-type">' + esc(s.type) + '</div>';
        html += '</div>';
      }
    }
    container.innerHTML = html;
  }).catch(function() {
    document.getElementById('store-list').innerHTML = '<div class="alert alert-error">店舗情報の読み込みに失敗しました</div>';
  });
}

// ダミー店舗（ベトナム店・台湾店）クリック時の表示
function selectComingSoonStore(name) {
  alert(name + 'は近日オープン予定です。\n（多言語対応UIは準備中ですが、ヘッダーの言語切替で表示確認はできます）');
}

function selectStore(code, name) {
  API.setStoreCode(code);
  App.loadStoreInfo();
  document.getElementById('mode-select-store-name').textContent = name;
  App.showScreen('mode-select');
}

function startStaffMode() {
  App.mode = 'staff';
  App.showScreen('staff-select');
}

function startAdminMode() {
  App.mode = 'admin';
  App.showScreen('admin-login');
}

// ========================================
// スタッフ選択画面
// ========================================
function onShow_staff_select() {
  API.getStaffList().then(function(staffList) {
    var container = document.getElementById('staff-list-container');
    if (staffList.length === 0) {
      container.innerHTML = '<div class="alert alert-warning">スタッフが登録されていません。管理者に連絡してください。</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < staffList.length; i++) {
      var s = staffList[i];
      html += '<div class="staff-item" onclick="App.selectStaff(\'' + esc(s.id) + '\', \'' + esc(s.name) + '\')">' + esc(s.name) + '</div>';
    }
    container.innerHTML = html;
  }).catch(function() {
    document.getElementById('staff-list-container').innerHTML = '<div class="alert alert-error">スタッフ情報の読み込みに失敗しました。ページを再読み込みしてください。</div>';
  });
}

// ========================================
// スタッフPIN入力画面
// ========================================
function onShow_staff_pin_login() {
  if (App._pendingStaff) {
    var el = document.getElementById('pin-login-staff-name');
    if (el) el.textContent = App._pendingStaff.name + ' さん';
  }
  var inp = document.getElementById('pin-login-input');
  if (inp) {
    inp.value = '';
    setTimeout(function() { inp.focus(); }, 100);
    inp.onkeypress = function(e) {
      if (e.key === 'Enter') App.submitStaffPin(inp.value);
    };
  }
}

// ========================================
// スタッフPIN初回設定画面
// ========================================
function onShow_staff_pin_setup() {
  if (App._pendingStaff) {
    var el = document.getElementById('pin-setup-staff-name');
    if (el) el.textContent = App._pendingStaff.name + ' さん・はじめまして！';
  }
  var a = document.getElementById('pin-setup-input');
  var b = document.getElementById('pin-setup-confirm');
  if (a) { a.value = ''; setTimeout(function() { a.focus(); }, 100); }
  if (b) b.value = '';
}

// ========================================
// スタッフメニュー
// ========================================
function onShow_staff_menu() {
  if (App.currentStaff) {
    document.getElementById('staff-greeting').textContent = 'こんにちは、' + App.currentStaff.name + 'さん';
  }
}

// ========================================
// 管理者ログイン
// ========================================
function adminLogin() {
  var password = document.getElementById('admin-password').value;
  var errorEl = document.getElementById('admin-login-error');
  if (!password) { errorEl.textContent = 'パスワードを入力してください'; errorEl.classList.remove('hidden'); return; }

  App.showLoading('認証中...');
  API.verifyAdminPassword(password).then(function(result) {
    App.hideLoading();
    if (result.success) {
      API.setToken(result.token);
      sessionStorage.setItem('gyuumaru_token', result.token);
      errorEl.classList.add('hidden');
      App.showScreen('admin-dashboard');
    } else {
      errorEl.textContent = result.message || 'パスワードが正しくありません';
      errorEl.classList.remove('hidden');
    }
  }).catch(function(err) {
    App.hideLoading();
    errorEl.textContent = 'エラーが発生しました';
    errorEl.classList.remove('hidden');
  });
}

// ========================================
// 管理者ダッシュボード
// ========================================
function onShow_admin_dashboard() {
  if (App.storeInfo) {
    document.getElementById('admin-store-name').textContent = App.storeInfo.storeName;
  }
  var yearMonth = getNextMonthStr();
  API.getRequestSummary(yearMonth).then(function(summary) {
    var parts = yearMonth.split('-');
    var month = parseInt(parts[1]);
    var html = '<div class="text-bold mb-8">' + month + '月分</div>';
    html += '<div class="flex-between mb-8"><span>提出済み</span><span class="text-bold">' + summary.submittedCount + ' / ' + summary.totalStaff + '人</span></div>';
    var pct = summary.totalStaff > 0 ? Math.round(summary.submittedCount / summary.totalStaff * 100) : 0;
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
    if (summary.notSubmitted.length > 0) {
      html += '<div class="mt-16"><div class="text-sm text-muted mb-8">未提出のスタッフ:</div>';
      var names = summary.notSubmitted.map(function(s) { return esc(s.name); });
      html += '<div class="text-sm text-accent">' + names.join('、') + '</div></div>';
    }
    document.getElementById('admin-summary-content').innerHTML = html;
  }).catch(function() {
    document.getElementById('admin-summary-content').innerHTML = '<div class="text-muted">情報の取得に失敗しました</div>';
  });
}

// ========================================
// 提出済み希望確認画面
// ========================================
function onShow_shift_request_view() {
  if (!App.currentStaff) return;
  var yearMonth = getNextMonthStr();
  Calendar.renderHeader('request-view-header', yearMonth, function(newYM) { yearMonth = newYM; loadRequestView(newYM); });
  loadRequestView(yearMonth);
}

function loadRequestView(yearMonth) {
  App.showLoading('希望を読み込み中...');
  API.getMyRequests(App.currentStaff.id, yearMonth).then(function(requests) {
    App.hideLoading();
    var data = {};
    for (var i = 0; i < requests.length; i++) { data[requests[i].date] = requests[i]; }
    Calendar.render('request-view-calendar', yearMonth, { data: data });
    var msgEl = document.getElementById('request-view-message');
    if (requests.length === 0) {
      msgEl.innerHTML = '<div class="alert alert-info">この月の希望はまだ提出されていません。</div>';
    } else {
      msgEl.innerHTML = '<div class="alert alert-success">' + requests.length + '日分の希望が提出済みです。</div>';
    }
  }).catch(function() { App.hideLoading(); App.showToast('読み込みに失敗しました', 'error'); });
}

// ========================================
// 管理者シフト希望一覧
// ========================================
function onShow_admin_shift_requests(params) {
  var yearMonth = (params && params.yearMonth) || getNextMonthStr();
  Calendar.renderHeader('request-list-header', yearMonth, function(newYM) { yearMonth = newYM; loadRequestList(newYM); });
  loadRequestList(yearMonth);
}

function loadRequestList(yearMonth) {
  App.showLoading('希望を読み込み中...');
  Promise.all([API.getAllRequests(yearMonth), API.getStaffList()]).then(function(results) {
    App.hideLoading();
    var requests = results[0]; var staffList = results[1];
    var staffMap = {};
    for (var i = 0; i < staffList.length; i++) { staffMap[staffList[i].id] = staffList[i].name; }
    var tableHtml = '<div class="table-wrapper"><table class="data-table">';
    tableHtml += '<tr><th>スタッフ</th><th>日付</th><th>区分</th><th>時間</th><th>備考</th></tr>';
    if (requests.length === 0) {
      tableHtml += '<tr><td colspan="5" class="text-center text-muted">希望はまだ提出されていません</td></tr>';
    } else {
      requests.sort(function(a, b) { return a.date.localeCompare(b.date); });
      for (var j = 0; j < requests.length; j++) {
        var r = requests[j]; var name = staffMap[r.staffId] || r.staffId;
        var timeStr = r.startTime && r.endTime ? r.startTime + '-' + r.endTime : '-';
        tableHtml += '<tr><td>' + esc(name) + '</td><td>' + esc(r.date) + '</td><td>' + esc(r.type) + '</td><td>' + esc(timeStr) + '</td><td>' + esc(r.note || '') + '</td></tr>';
      }
    }
    tableHtml += '</table></div>';
    document.getElementById('request-list-table').innerHTML = tableHtml;
  }).catch(function() { App.hideLoading(); App.showToast('読み込みに失敗しました', 'error'); });
}

// ========================================
// シフト希望入力
// ========================================
var ShiftRequest = {
  yearMonth: '', data: {}, editingDate: '', selectedType: '',

  init: function() {
    this.yearMonth = getNextMonthStr(); this.data = {}; this.selectedType = '';
    this.populateTimeSelects(); this.updateDeadlineInfo();
    var self = this;
    Calendar.renderHeader('sr-calendar-header', this.yearMonth, function(newYM) { self.yearMonth = newYM; self.loadExisting(); });
    this.loadExisting();
  },

  loadExisting: function() {
    var self = this; App.showLoading('読み込み中...');
    API.getMyRequests(App.currentStaff.id, this.yearMonth).then(function(requests) {
      App.hideLoading(); self.data = {};
      for (var i = 0; i < requests.length; i++) { var r = requests[i]; self.data[r.date] = { type: r.type, startTime: r.startTime, endTime: r.endTime, note: r.note }; }
      self.renderCalendar(); self.updateDeadlineInfo();
      Calendar.renderHeader('sr-calendar-header', self.yearMonth, function(newYM) { self.yearMonth = newYM; self.loadExisting(); });
    }).catch(function() { App.hideLoading(); App.showToast('読み込みに失敗しました', 'error'); self.renderCalendar(); });
  },

  renderCalendar: function() {
    var self = this;
    Calendar.render('sr-calendar', this.yearMonth, { data: this.data, onCellClick: function(dateStr) { self.openDayModal(dateStr); } });
  },

  populateTimeSelects: function() {
    var wait = function() {
      if (!App.timeSlots) { setTimeout(wait, 100); return; }
      var selects = ['sr-start-time', 'sr-end-time', 'sr-bulk-start', 'sr-bulk-end'];
      for (var s = 0; s < selects.length; s++) {
        var el = document.getElementById(selects[s]); if (!el) continue; el.innerHTML = '';
        for (var i = 0; i < App.timeSlots.length; i++) { var opt = document.createElement('option'); opt.value = App.timeSlots[i]; opt.textContent = App.timeSlots[i]; el.appendChild(opt); }
        if (selects[s].indexOf('start') >= 0) el.value = '11:00';
        if (selects[s].indexOf('end') >= 0) el.value = '17:00';
      }
    }; wait();
  },

  updateDeadlineInfo: function() {
    var el = document.getElementById('sr-deadline-info');
    if (!el || !App.storeInfo) return;
    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var prevMonth = month - 1;
    var prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear--; }
    var deadline = new Date(prevYear, prevMonth - 1, App.storeInfo.requestDeadlineDay, 23, 59, 59);
    var now = new Date();
    this.deadlinePassed = now > deadline;
    var role = sessionStorage.getItem('gyuumaru_role') || 'staff';
    this.canBypass = (role === 'store_manager' || role === 'headquarters_admin');

    if (this.deadlinePassed && !this.canBypass) {
      el.className = 'alert alert-warning mb-16';
      el.innerHTML = '<strong>締切を過ぎています。</strong><br>' +
        month + '月のシフト希望の提出期限は ' + prevMonth + '月' + App.storeInfo.requestDeadlineDay + '日 でした。<br>' +
        '変更が必要な場合は <strong>店長に直接ご連絡ください</strong>。システム上からの変更はできません。';
      // 提出ボタンを無効化
      var submitBtn = document.querySelector('#screen-shift-request button.btn-primary.btn-block');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '締切終了のため提出できません';
        submitBtn.style.opacity = '0.5';
      }
    } else if (this.deadlinePassed && this.canBypass) {
      el.className = 'alert alert-info mb-16';
      el.textContent = '締切を過ぎていますが、店長/本部権限で変更可能です。慎重に操作してください。';
      var submitBtn2 = document.querySelector('#screen-shift-request button.btn-primary.btn-block');
      if (submitBtn2) { submitBtn2.disabled = false; submitBtn2.style.opacity = '1'; submitBtn2.textContent = 'シフト希望を提出する（店長権限）'; }
    } else {
      el.className = 'alert alert-info mb-16';
      el.textContent = month + '月のシフト希望は、' + prevMonth + '月' + App.storeInfo.requestDeadlineDay + '日までに提出してください';
      var submitBtn3 = document.querySelector('#screen-shift-request button.btn-primary.btn-block');
      if (submitBtn3) { submitBtn3.disabled = false; submitBtn3.style.opacity = '1'; submitBtn3.textContent = 'シフト希望を提出する'; }
    }
  },

  openDayModal: function(dateStr) {
    this.editingDate = dateStr;
    var parts = dateStr.split('-'); var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    document.getElementById('sr-modal-date-label').textContent = parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日(' + dayNames[d.getDay()] + ')';
    var existing = this.data[dateStr];
    if (existing) {
      this.selectType(existing.type);
      if (existing.startTime) document.getElementById('sr-start-time').value = existing.startTime;
      if (existing.endTime) document.getElementById('sr-end-time').value = existing.endTime;
      document.getElementById('sr-note').value = existing.note || '';
    } else {
      this.selectType(''); document.getElementById('sr-start-time').value = '11:00';
      document.getElementById('sr-end-time').value = '17:00'; document.getElementById('sr-note').value = '';
    }
    App.showModal('sr-day-modal');
  },

  selectType: function(type) {
    this.selectedType = type;
    document.getElementById('sr-type-work').className = 'request-type-btn';
    document.getElementById('sr-type-off').className = 'request-type-btn';
    document.getElementById('sr-type-either').className = 'request-type-btn';
    var timeSection = document.getElementById('sr-time-section');
    if (type === '出勤希望') { document.getElementById('sr-type-work').className = 'request-type-btn selected-work'; timeSection.style.display = 'block'; }
    else if (type === '休み希望') { document.getElementById('sr-type-off').className = 'request-type-btn selected-off'; timeSection.style.display = 'none'; }
    else if (type === 'どちらでも') { document.getElementById('sr-type-either').className = 'request-type-btn selected-either'; timeSection.style.display = 'block'; }
    else { timeSection.style.display = 'block'; }
  },

  saveDay: function() {
    if (!this.selectedType) { App.showToast('希望の種類を選んでください', 'error'); return; }
    var entry = { type: this.selectedType, startTime: '', endTime: '', note: document.getElementById('sr-note').value };
    if (this.selectedType !== '休み希望') {
      entry.startTime = document.getElementById('sr-start-time').value;
      entry.endTime = document.getElementById('sr-end-time').value;
      if (entry.startTime >= entry.endTime) { App.showToast('終了時間は開始時間より後にしてください', 'error'); return; }
    }
    this.data[this.editingDate] = entry; App.hideModal('sr-day-modal'); this.renderCalendar(); App.showToast('保存しました', 'success');
  },

  clearDay: function() { delete this.data[this.editingDate]; App.hideModal('sr-day-modal'); this.renderCalendar(); },

  clearAll: function() {
    if (!App.confirm('全ての希望をクリアしますか？')) return;
    this.data = {}; this.renderCalendar(); App.showToast('全てクリアしました');
  },

  showBulkModal: function() {
    var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    for (var i = 0; i < days.length; i++) { document.getElementById('sr-bulk-' + days[i]).checked = false; }
    document.getElementById('sr-bulk-type').value = '出勤希望'; this.toggleBulkTime(); App.showModal('sr-bulk-modal');
  },

  toggleBulkTime: function() {
    var type = document.getElementById('sr-bulk-type').value;
    document.getElementById('sr-bulk-time-section').style.display = type === '休み希望' ? 'none' : 'block';
  },

  applyBulk: function() {
    var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; var selectedDays = [];
    for (var i = 0; i < days.length; i++) { if (document.getElementById('sr-bulk-' + days[i]).checked) selectedDays.push(i); }
    if (selectedDays.length === 0) { App.showToast('曜日を選択してください', 'error'); return; }
    var type = document.getElementById('sr-bulk-type').value;
    var startTime = document.getElementById('sr-bulk-start').value;
    var endTime = document.getElementById('sr-bulk-end').value;
    var parts = this.yearMonth.split('-'); var year = parseInt(parts[0]); var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate(); var count = 0;
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month - 1, d);
      if (selectedDays.indexOf(date.getDay()) >= 0) {
        var dateStr = this.yearMonth + '-' + ('0' + d).slice(-2);
        this.data[dateStr] = { type: type, startTime: type !== '休み希望' ? startTime : '', endTime: type !== '休み希望' ? endTime : '', note: '' };
        count++;
      }
    }
    App.hideModal('sr-bulk-modal'); this.renderCalendar(); App.showToast(count + '日分を設定しました', 'success');
  },

  submit: function() {
    var dates = Object.keys(this.data);
    if (dates.length === 0) { App.showToast('1日以上の希望を入力してください', 'error'); return; }
    if (!App.confirm(dates.length + '日分のシフト希望を提出しますか？')) return;
    var requests = dates.map(function(date) { var d = ShiftRequest.data[date]; return { date: date, type: d.type, startTime: d.startTime || '', endTime: d.endTime || '', note: d.note || '' }; });
    App.showLoading('提出中...');
    API.submitShiftRequests(App.currentStaff.id, this.yearMonth, requests).then(function(result) {
      App.hideLoading();
      if (result.success) { App.showToast(result.message, 'success'); setTimeout(function() { App.showScreen('staff-menu'); }, 1500); }
      else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('提出に失敗しました', 'error'); });
  }
};

function onShow_shift_request() { ShiftRequest.init(); }

// ========================================
// 確定シフト確認
// ========================================
var ShiftView = {
  yearMonth: '', shifts: [], listVisible: false,

  init: function() {
    this.yearMonth = getNextMonthStr(); this.listVisible = false;
    document.getElementById('sv-list').classList.add('hidden');
    document.getElementById('sv-list-toggle-text').textContent = 'リスト表示に切り替え';
    var self = this;
    Calendar.renderHeader('sv-calendar-header', this.yearMonth, function(newYM) { self.yearMonth = newYM; self.load(); });
    this.load();
  },

  load: function() {
    var self = this; App.showLoading('シフトを読み込み中...');
    API.getMyShift(App.currentStaff.id, this.yearMonth).then(function(shifts) {
      App.hideLoading(); self.shifts = shifts;
      Calendar.renderHeader('sv-calendar-header', self.yearMonth, function(newYM) { self.yearMonth = newYM; self.load(); });
      self.renderCalendar(); self.renderSummary(); self.renderList();
    }).catch(function() { App.hideLoading(); App.showToast('読み込みに失敗しました', 'error'); });
  },

  renderCalendar: function() {
    var data = {};
    for (var i = 0; i < this.shifts.length; i++) { var s = this.shifts[i]; data[s.date] = { confirmed: true, startTime: s.startTime, endTime: s.endTime }; }
    Calendar.render('sv-calendar', this.yearMonth, {
      data: data,
      renderCell: function(dateStr, dayData) { if (!dayData) return ''; return '<div class="shift-info">' + dayData.startTime + '<br>' + dayData.endTime + '</div>'; }
    });
  },

  renderSummary: function() {
    var summaryEl = document.getElementById('sv-summary');
    if (this.shifts.length === 0) { summaryEl.classList.add('hidden'); return; }
    summaryEl.classList.remove('hidden');
    var totalHours = 0;
    for (var i = 0; i < this.shifts.length; i++) { totalHours += this.shifts[i].workHours || 0; }
    document.getElementById('sv-total-hours').textContent = App.formatHours(totalHours) + '時間';
    document.getElementById('sv-total-days').textContent = this.shifts.length + '日';
  },

  renderList: function() {
    var tbody = document.getElementById('sv-list-body');
    if (this.shifts.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">この月の確定シフトはありません</td></tr>'; return; }
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    var sorted = this.shifts.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i]; var parts = s.date.split('-');
      var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      var isHol = (window.Holidays && window.Holidays.isHoliday(s.date));
      // 祝日も日曜と同じ赤色
      var dayClass = (d.getDay() === 0 || isHol) ? ' class="text-accent"' : (d.getDay() === 6 ? ' style="color:#1976D2"' : '');
      html += '<tr><td>' + parseInt(parts[1]) + '/' + parseInt(parts[2]) + '</td><td' + dayClass + '>' + dayNames[d.getDay()] + '</td><td>' + s.startTime + '</td><td>' + s.endTime + '</td><td>' + App.formatHours(s.workHours) + 'h</td></tr>';
    }
    tbody.innerHTML = html;
  },

  toggleList: function() {
    this.listVisible = !this.listVisible;
    document.getElementById('sv-list').classList.toggle('hidden', !this.listVisible);
    document.getElementById('sv-list-toggle-text').textContent = this.listVisible ? 'カレンダー表示に戻す' : 'リスト表示に切り替え';
  }
};

function onShow_shift_view() { ShiftView.init(); }

// ========================================
// シフト表作成・編集（管理者）
// ========================================
var AdminShiftEdit = {
  yearMonth: '', schedules: [], staffList: [], requests: [], editingShiftId: null, editingDate: '',
  settings: {},
  currentView: 'gantt',
  weekOffset: 0,
  selectedDay: '',
  currentStep: 1,

  init: function() {
    this.yearMonth = getNextMonthStr(); this.populateTimeSelects();
    this.currentView = 'gantt'; this.weekOffset = 0; this.selectedDay = '';
    this.currentStep = 1;
    this.renderWorkflow();
    // Step1パネルを表示（データなしの状態で先に見せる）
    for (var i = 1; i <= 4; i++) {
      var panel = document.getElementById('ase-step-' + i);
      if (panel) panel.classList.toggle('hidden', i !== 1);
    }
    var self = this;
    Calendar.renderHeader('ase-month-header', this.yearMonth, function(newYM) { self.yearMonth = newYM; self.weekOffset = 0; self.load(); });
    // loadがStep1も描画するので、loadだけ呼ぶ
    this.load();
    // 応募件数バッジを更新
    if (typeof AdminHelpCampaign !== 'undefined') AdminHelpCampaign.refreshPendingCount();
  },

  // ステップ型ワークフロー（4ステップ）
  goToStep: function(step) {
    this.currentStep = step;
    this.renderWorkflow();
    for (var i = 1; i <= 4; i++) {
      var panel = document.getElementById('ase-step-' + i);
      if (panel) panel.classList.toggle('hidden', i !== step);
    }
    if (step === 1) { this.renderStep1(); }
    else if (step === 2) { this.load(); }
    else if (step === 3) { this.load(); }
    else if (step === 4) { this.load(); }
    window.scrollTo(0, 0);
  },

  renderWorkflow: function() {
    for (var i = 1; i <= 4; i++) {
      var el = document.getElementById('wf-step-' + i);
      if (!el) continue;
      el.className = 'workflow-step';
      if (i === this.currentStep) el.classList.add('active');
      else if (i < this.currentStep) el.classList.add('done');
    }
  },

  // 全スタッフの希望をクリアする
  clearAllRequests: function() {
    if (!App.confirm('全スタッフのシフト希望をクリアしますか？')) return;
    App.showLoading('希望をクリア中...');
    var self = this;
    var promises = [];
    for (var si = 0; si < this.staffList.length; si++) {
      promises.push(API.submitShiftRequests(this.staffList[si].id, this.yearMonth, []));
    }
    Promise.all(promises).then(function() {
      App.hideLoading();
      App.showToast('全スタッフの希望をクリアしました', 'success');
      self.load();
    }).catch(function() { App.hideLoading(); App.showToast('クリアに失敗しました', 'error'); });
  },

  // ダミーのシフト希望を投入する
  insertDummyRequests: function() {
    if (!App.confirm('テスト用のダミー希望データを全スタッフ分投入しますか？')) return;
    App.showLoading('ダミー希望を投入中...');
    var self = this;
    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]); var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    // 完全ランダムなダミーデータ生成
    var timeOptions = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00'];
    var endOptions = ['14:00','14:30','15:00','16:00','17:00','18:00','19:00','20:00','21:00','21:30','22:00','22:00','22:00'];
    var promises = [];
    for (var si = 0; si < this.staffList.length; si++) {
      var staff = this.staffList[si];
      var requests = [];
      // スタッフごとの出勤率をランダムに（50%〜90%）
      var workRate = 0.5 + Math.random() * 0.4;

      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = this.yearMonth + '-' + ('0' + d).slice(-2);

        // この日に出勤するかどうか
        if (Math.random() > workRate) continue;

        // 開始・終了を完全にランダム
        var startTime, endTime;
        if (staff.employmentType === '正社員') {
          // 正社員は通し希望が多いが、たまに短め
          if (Math.random() < 0.7) {
            startTime = '10:00'; endTime = '22:00';
          } else {
            startTime = Math.random() < 0.5 ? '10:00' : '14:00';
            endTime = Math.random() < 0.5 ? '17:00' : '22:00';
          }
        } else {
          // アルバイトは完全ランダム
          startTime = timeOptions[Math.floor(Math.random() * timeOptions.length)];
          endTime = endOptions[Math.floor(Math.random() * endOptions.length)];
          // 開始 < 終了を保証、最低2時間
          var sMin = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
          var eMin = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
          if (eMin - sMin < 120) endTime = '22:00';
        }
        requests.push({ date: dateStr, type: '出勤希望', startTime: startTime, endTime: endTime });
      }
      promises.push(API.submitShiftRequests(staff.id, this.yearMonth, requests));
    }
    Promise.all(promises).then(function() {
      App.hideLoading();
      App.showToast(self.staffList.length + '名分のダミー希望を投入しました！ Step2に進んで自動配置してください', 'success');
      self.currentStep = 1;
      self.load();
    }).catch(function() {
      App.hideLoading();
      App.showToast('ダミー投入に失敗しました', 'error');
    });
  },

  renderStep1: function() {
    // 希望確認: カレンダーに提出状況を表示
    var container = document.getElementById('ase-step1-calendar');
    if (!container) return;
    if (this.requests.length === 0 && this.staffList.length === 0) {
      container.innerHTML = '<div class="alert alert-info">データを読み込み中...</div>';
      return;
    }
    // 日別の希望集計
    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]); var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // 必要人数を取得
    var timeSlots = [];
    try { timeSlots = JSON.parse(this.settings['時間帯別必要人数'] || '[]'); } catch(e) {}
    var maxNeeded = 0;
    for (var ti = 0; ti < timeSlots.length; ti++) {
      var s = timeSlots[ti];
      var need = (s.weekdayHall || s.hall || 0) + (s.weekdayKitchen || s.kitchen || 0);
      if (need > maxNeeded) maxNeeded = need;
    }

    var html = '<div class="table-wrapper"><table class="data-table"><tr><th>日付</th><th>曜日</th><th>出勤希望</th><th>状況</th></tr>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = this.yearMonth + '-' + ('0' + d).slice(-2);
      var dow = new Date(year, month - 1, d).getDay();
      var work = 0;
      for (var ri = 0; ri < this.requests.length; ri++) {
        if (this.requests[ri].date === dateStr && this.requests[ri].type !== '休み希望') work++;
      }
      var dayClass = dow === 0 ? ' style="color:#C62828"' : (dow === 6 ? ' style="color:#1565C0"' : '');
      // 必要人数との比較
      var statusHtml = '';
      if (maxNeeded > 0) {
        if (work >= maxNeeded) statusHtml = '<span style="color:#2E7D32">充足</span>';
        else if (work >= maxNeeded * 0.7) statusHtml = '<span style="color:#E65100">やや少なめ</span>';
        else statusHtml = '<span style="color:#C62828;font-weight:bold">不足!</span>';
      }
      html += '<tr><td>' + d + '日</td><td' + dayClass + '>' + dayNames[dow] + '</td>';
      html += '<td style="color:#2E7D32;font-weight:bold;font-size:16px">' + work + '名</td>';
      html += '<td>' + statusHtml + '</td></tr>';
    }
    html += '</table></div>';
    container.innerHTML = html;
  },

  renderShortageSummary: function() {
    // Step 4: 時間帯別の過不足を可視化
    var container = document.getElementById('ase-shortage-summary');
    if (!container) return;

    var timeSlots = [];
    try { timeSlots = JSON.parse(this.settings['時間帯別必要人数'] || '[]'); } catch(e) {}
    if (timeSlots.length === 0) {
      container.innerHTML = '<div class="alert alert-info">時間帯設定がありません。店舗設定から設定してください。</div>';
      return;
    }

    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]); var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // スタッフマップ
    var staffMap = {};
    for (var si = 0; si < this.staffList.length; si++) staffMap[this.staffList[si].id] = this.staffList[si];

    // スケジュールマップ
    var schedByDate = {};
    for (var i = 0; i < this.schedules.length; i++) {
      var s = this.schedules[i];
      if (!schedByDate[s.date]) schedByDate[s.date] = [];
      schedByDate[s.date].push(s);
    }

    var html = '';
    var totalShort = 0;

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = this.yearMonth + '-' + ('0' + d).slice(-2);
      var dow = new Date(year, month - 1, d).getDay();
      // 祝日も土日扱い
      var isWeekend = (window.Holidays ? window.Holidays.isWeekendOrHoliday(dateStr) : (dow === 0 || dow === 6));
      var dayLabel = d + '日(' + dayNames[dow] + ')';
      var dayShifts = schedByDate[dateStr] || [];
      var dayHasShortage = false;
      var slotsHtml = '';

      for (var ts = 0; ts < timeSlots.length; ts++) {
        var slot = timeSlots[ts];
        // slot.label は店舗設定の任意文字列なので HTML に入れる前にエスケープ
      var slotLabel = esc((slot.label || '') + ' ' + slot.start + '-' + slot.end);
        var hallNeeded = isWeekend ? (slot.weekendHall || slot.hall || 0) : (slot.weekdayHall || slot.hall || 0);
        var kitchenNeeded = isWeekend ? (slot.weekendKitchen || slot.kitchen || 0) : (slot.weekdayKitchen || slot.kitchen || 0);

        var slotStartMin = parseInt(slot.start.split(':')[0]) * 60 + parseInt(slot.start.split(':')[1]);
        var slotEndMin = parseInt(slot.end.split(':')[0]) * 60 + parseInt(slot.end.split(':')[1]);

        var hallActual = 0, kitchenActual = 0;
        for (var di = 0; di < dayShifts.length; di++) {
          var sh = dayShifts[di];
          var shStart = parseInt(sh.startTime.split(':')[0]) * 60 + parseInt(sh.startTime.split(':')[1]);
          var shEnd = parseInt(sh.endTime.split(':')[0]) * 60 + parseInt(sh.endTime.split(':')[1]);
          if (shStart <= slotStartMin && shEnd >= slotEndMin) {
            var st = staffMap[sh.staffId];
            if (st && st.position === 'キッチン') kitchenActual++;
            else hallActual++;
          }
        }

        var hallOk = hallActual >= hallNeeded;
        var kitchenOk = kitchenActual >= kitchenNeeded;
        if (!hallOk || !kitchenOk) dayHasShortage = true;
        if (!hallOk) totalShort++;
        if (!kitchenOk) totalShort++;

        // ホール
        var hPct = hallNeeded > 0 ? Math.min(Math.round(hallActual / hallNeeded * 100), 100) : 100;
        slotsHtml += '<div class="shortage-slot ' + (hallOk ? 'ok' : 'short') + '">';
        slotsHtml += '<div class="shortage-slot-time">' + slotLabel + '</div>';
        slotsHtml += '<div style="min-width:50px;font-size:11px">ホール</div>';
        slotsHtml += '<div class="shortage-slot-bar"><div class="shortage-slot-fill ' + (hallOk ? 'ok' : 'short') + '" style="width:' + hPct + '%"></div></div>';
        slotsHtml += '<div class="shortage-slot-label" style="color:' + (hallOk ? '#2E7D32' : '#C62828') + '">' + hallActual + ' / ' + hallNeeded + '人</div>';
        slotsHtml += '</div>';
        // キッチン
        var kPct = kitchenNeeded > 0 ? Math.min(Math.round(kitchenActual / kitchenNeeded * 100), 100) : 100;
        slotsHtml += '<div class="shortage-slot ' + (kitchenOk ? 'ok' : 'short') + '">';
        slotsHtml += '<div class="shortage-slot-time"></div>';
        slotsHtml += '<div style="min-width:50px;font-size:11px">キッチン</div>';
        slotsHtml += '<div class="shortage-slot-bar"><div class="shortage-slot-fill ' + (kitchenOk ? 'ok' : 'short') + '" style="width:' + kPct + '%"></div></div>';
        slotsHtml += '<div class="shortage-slot-label" style="color:' + (kitchenOk ? '#2E7D32' : '#C62828') + '">' + kitchenActual + ' / ' + kitchenNeeded + '人</div>';
        slotsHtml += '</div>';
      }

      if (dayHasShortage) {
        var dayStyle = dow === 0 ? 'color:#C62828' : (dow === 6 ? 'color:#1565C0' : '');
        html += '<div class="shortage-card">';
        html += '<div class="shortage-card-header"><span style="' + dayStyle + '">' + month + '/' + dayLabel + '</span><span style="color:#C62828;font-size:12px">不足あり</span></div>';
        html += slotsHtml;
        html += '</div>';
      }
    }

    if (totalShort === 0) {
      html = '<div class="alert alert-success" style="text-align:center;font-size:16px;padding:24px">全ての日・全ての時間帯で人員が充足しています！</div>';
    } else {
      html = '<div class="alert alert-warning mb-16" style="text-align:center">' + totalShort + '件の不足があります（不足のある日だけ表示）</div>' + html;
    }
    container.innerHTML = html;
  },

  renderFinalSummary: function() {
    var container = document.getElementById('ase-final-summary');
    if (!container) return;
    var totalStaff = this.staffList.length;
    var scheduledStaff = {};
    var totalShifts = this.schedules.length;
    for (var i = 0; i < this.schedules.length; i++) scheduledStaff[this.schedules[i].staffId] = true;
    var uniqueStaff = Object.keys(scheduledStaff).length;

    var html = '<div class="card" style="text-align:center;padding:24px">';
    html += '<div style="font-size:48px;margin-bottom:16px">&#9989;</div>';
    html += '<div style="font-size:18px;font-weight:bold;color:#4A3323;margin-bottom:16px">シフト確定の準備ができました</div>';
    html += '<div class="flex gap-16" style="justify-content:center;flex-wrap:wrap">';
    html += '<div><div class="text-muted text-sm">シフト件数</div><div class="text-lg text-bold">' + totalShifts + '件</div></div>';
    html += '<div><div class="text-muted text-sm">配置スタッフ</div><div class="text-lg text-bold">' + uniqueStaff + ' / ' + totalStaff + '人</div></div>';
    html += '</div></div>';
    container.innerHTML = html;
  },

  setView: function() {
    this.renderGanttWeekView();
  },

  updateViewButtons: function() {},

  renderCurrentView: function() {
    this.renderGanttWeekView();
  },

  populateTimeSelects: function() {
    var wait = function() {
      if (!App.timeSlots) { setTimeout(wait, 100); return; }
      var selects = ['ase-modal-start', 'ase-modal-end'];
      for (var s = 0; s < selects.length; s++) {
        var el = document.getElementById(selects[s]); if (!el) continue; el.innerHTML = '';
        for (var i = 0; i < App.timeSlots.length; i++) { var opt = document.createElement('option'); opt.value = App.timeSlots[i]; opt.textContent = App.timeSlots[i]; el.appendChild(opt); }
      }
    }; wait();
  },

  load: function() {
    var self = this; App.showLoading('シフトを読み込み中...');
    // getAllStaffを使ってposition情報を含むスタッフ一覧を取得する
    Promise.all([API.getShiftSchedule(this.yearMonth), API.getAllStaff(), API.getAllRequests(this.yearMonth), API.getStoreSettings(), API.getRequestSummary(this.yearMonth)]).then(function(results) {
      App.hideLoading(); self.schedules = results[0]; self.staffList = results[1]; self.requests = results[2]; self.settings = results[3] || {};
      var summary = results[4];
      Calendar.renderHeader('ase-month-header', self.yearMonth, function(newYM) { self.yearMonth = newYM; self.load(); });
      self.renderRequestSummary(summary);
      // ステップに応じた描画
      if (self.currentStep === 1) {
        self.renderStep1();
      } else if (self.currentStep === 2) {
        if (self.schedules.length === 0) {
          var m = document.getElementById('ase-matrix');
          if (m) m.innerHTML = '<div style="text-align:center;padding:40px;color:#888"><div style="font-size:48px;margin-bottom:16px">&#9757;</div><div style="font-size:16px">まだシフトがありません。<br>上の「<b>自動配置する</b>」ボタンを押してください。</div></div>';
          var h = document.getElementById('ase-staff-hours');
          if (h) h.innerHTML = '';
        } else {
          self.renderGanttWeekView();
          self.renderStaffHours();
        }
      } else if (self.currentStep === 3) {
        self.renderShortageSummary();
      } else if (self.currentStep === 4) {
        self.renderFinalSummary();
      }
    }).catch(function() { App.hideLoading(); App.showToast('読み込みに失敗しました', 'error'); });
  },

  renderMatrix: function() {
    var container = document.getElementById('ase-matrix');
    var parts = this.yearMonth.split('-'); var year = parseInt(parts[0]); var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate(); var dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // 確定シフトをマップ化
    var schedMap = {};
    for (var i = 0; i < this.schedules.length; i++) { var s = this.schedules[i]; if (!schedMap[s.staffId]) schedMap[s.staffId] = {}; schedMap[s.staffId][s.date] = s; }

    // シフト希望をマップ化（staffId -> date -> request）
    var reqMap = {};
    for (var ri = 0; ri < this.requests.length; ri++) { var r = this.requests[ri]; if (!reqMap[r.staffId]) reqMap[r.staffId] = {}; reqMap[r.staffId][r.date] = r; }

    // 正社員を先にソート
    function sortStaffPriority(a, b) {
      var aFt = a.employmentType === '正社員' ? 0 : 1;
      var bFt = b.employmentType === '正社員' ? 0 : 1;
      if (aFt !== bFt) return aFt - bFt;
      return (a.kana || a.name).localeCompare(b.kana || b.name);
    }

    // ポジション別にスタッフをグループ化
    var hallStaff = [];
    var kitchenStaff = [];
    for (var pi = 0; pi < this.staffList.length; pi++) {
      var pos = this.staffList[pi].position || 'ホール';
      if (pos === 'キッチン') {
        kitchenStaff.push(this.staffList[pi]);
      } else {
        hallStaff.push(this.staffList[pi]);
      }
    }
    hallStaff.sort(sortStaffPriority);
    kitchenStaff.sort(sortStaffPriority);

    // ポジション別の日ごと出勤人数を集計
    var dailyHallCount = {};
    var dailyKitchenCount = {};
    for (var dc = 1; dc <= daysInMonth; dc++) {
      var dcDate = this.yearMonth + '-' + ('0' + dc).slice(-2);
      dailyHallCount[dcDate] = 0;
      dailyKitchenCount[dcDate] = 0;
    }
    // スタッフIDからポジションを引くためのマップ
    var staffPosMap = {};
    for (var spm = 0; spm < this.staffList.length; spm++) {
      staffPosMap[this.staffList[spm].id] = this.staffList[spm].position || 'ホール';
    }
    for (var j = 0; j < this.schedules.length; j++) {
      var sched = this.schedules[j];
      var schedPos = staffPosMap[sched.staffId] || 'ホール';
      if (schedPos === 'キッチン') {
        if (dailyKitchenCount[sched.date] !== undefined) dailyKitchenCount[sched.date]++;
      } else {
        if (dailyHallCount[sched.date] !== undefined) dailyHallCount[sched.date]++;
      }
    }

    // 各スタッフの月間合計時間を計算
    var staffHoursMap = {};
    for (var sh = 0; sh < this.schedules.length; sh++) {
      var sc = this.schedules[sh];
      if (!staffHoursMap[sc.staffId]) staffHoursMap[sc.staffId] = 0;
      staffHoursMap[sc.staffId] += (sc.workHours || 0);
    }

    // ヘッダー行
    var html = '<table class="shift-matrix"><tr><th class="staff-name-col">スタッフ</th>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dow = new Date(year, month - 1, d).getDay();
      var dayStyle = dow === 0 ? ' style="color:#FFCDD2"' : (dow === 6 ? ' style="color:#90CAF9"' : '');
      html += '<th' + dayStyle + '>' + d + '<br><span style="font-size:9px">' + dayNames[dow] + '</span></th>';
    }
    // 月間合計列のヘッダー
    html += '<th>合計h</th>';
    html += '</tr>';

    // スタッフの行を描画する関数（ポジション別に再利用）
    var self = this;
    // 5-2: 月内の最大連勤数を計算（月初/月末で連続している場合は月またぎの可能性をマーク）
    function calcMaxConsecutive(staffId) {
      var maxRun = 0; var curRun = 0;
      var startsAtFirst = false; var endsAtLast = false;
      for (var dC = 1; dC <= daysInMonth; dC++) {
        var dCStr = self.yearMonth + '-' + ('0' + dC).slice(-2);
        if (schedMap[staffId] && schedMap[staffId][dCStr]) {
          curRun++;
          if (curRun > maxRun) maxRun = curRun;
          if (dC === 1) startsAtFirst = true;
          if (dC === daysInMonth) endsAtLast = true;
        } else {
          curRun = 0;
        }
      }
      return { maxRun: maxRun, startsAtFirst: startsAtFirst, endsAtLast: endsAtLast };
    }
    function renderStaffRows(staffGroup) {
      var rowsHtml = '';
      for (var si = 0; si < staffGroup.length; si++) {
        var staff = staffGroup[si];
        rowsHtml += '<tr><td class="staff-name-col">' + esc(staff.name) + '</td>';
        for (var day = 1; day <= daysInMonth; day++) {
          var dateStr = self.yearMonth + '-' + ('0' + day).slice(-2);
          var shift = (schedMap[staff.id] || {})[dateStr];
          var req = (reqMap[staff.id] || {})[dateStr];
          if (shift) {
            // 確定シフトがある場合
            rowsHtml += '<td class="shift-cell has-shift" onclick="AdminShiftEdit.editShift(\'' + esc(shift.id) + '\', \'' + dateStr + '\', \'' + esc(staff.id) + '\')" title="' + esc(staff.name + ' ' + shift.startTime + '-' + shift.endTime) + '">' + esc(shift.startTime) + '<br>' + esc(shift.endTime) + '</td>';
          } else if (req) {
            // シフト希望がある場合（薄い色で表示）
            var reqClass = 'shift-cell has-request';
            var reqLabel = '';
            var reqTitle = staff.name + ' ';
            if (req.type === '出勤希望') {
              reqClass += ' req-work';
              reqLabel = esc(req.startTime) + '<br>' + esc(req.endTime);
              reqTitle += '出勤希望 ' + req.startTime + '-' + req.endTime;
            } else if (req.type === '休み希望') {
              reqClass += ' req-off';
              reqLabel = '休';
              reqTitle += '休み希望';
            } else if (req.type === 'どちらでも') {
              reqClass += ' req-either';
              reqLabel = req.startTime ? esc(req.startTime) + '<br>' + esc(req.endTime) : 'OK';
              reqTitle += 'どちらでも' + (req.startTime ? ' ' + req.startTime + '-' + req.endTime : '');
            }
            rowsHtml += '<td class="' + reqClass + '" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\', \'' + esc(staff.id) + '\')" title="' + esc(reqTitle) + '">' + reqLabel + '</td>';
          } else {
            rowsHtml += '<td class="shift-cell" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\', \'' + esc(staff.id) + '\')"></td>';
          }
        }
        // 月間合計時間セル
        var totalH = staffHoursMap[staff.id] || 0;
        var hoursClass = 'hours-cell';
        if (staff.employmentType === '正社員') {
          if (totalH > 280) {
            hoursClass += ' hours-danger';
          } else if (totalH > 240) {
            hoursClass += ' hours-warning';
          } else {
            hoursClass += ' hours-ok';
          }
        }
        var hoursLabel = (Math.round(totalH * 10) / 10) + 'h';
        // 正社員で残業60h超（月300h超）の場合は1.3倍の印を追加
        if (staff.employmentType === '正社員' && totalH > 300) {
          hoursLabel += ' x1.3';
        }
        // 5-2: 連勤数を表示（5連勤以上を可視化、6連勤=オレンジ、7連勤以上=赤）
        var conn = calcMaxConsecutive(staff.id);
        var connSuffix = '';
        if (conn.startsAtFirst) connSuffix += '+';
        if (conn.endsAtLast) connSuffix += '+';
        var connTitle = '月内の最大連勤: ' + conn.maxRun + '日' + (connSuffix ? '（月またぎ可能性あり）' : '');
        if (conn.maxRun >= 5) {
          var connColor = conn.maxRun >= 7 ? '#C62828' : (conn.maxRun >= 6 ? '#E65100' : '#1976D2');
          hoursLabel += '<br><span class="consecutive-badge" style="color:' + connColor + '" title="' + connTitle + '">⛓ ' + conn.maxRun + '連勤' + connSuffix + '</span>';
        }
        rowsHtml += '<td class="' + hoursClass + '" title="' + connTitle + '">' + hoursLabel + '</td>';
        rowsHtml += '</tr>';
      }
      return rowsHtml;
    }

    // ホールセクション
    html += '<tr class="position-header"><td colspan="' + (daysInMonth + 2) + '">ホール (' + hallStaff.length + '名)</td></tr>';
    html += renderStaffRows(hallStaff);

    // ホール／キッチン間に空行を入れて視覚的に区切る
    html += '<tr class="position-spacer"><td colspan="' + (daysInMonth + 2) + '"></td></tr>';

    // キッチンセクション
    html += '<tr class="position-header"><td colspan="' + (daysInMonth + 2) + '">キッチン (' + kitchenStaff.length + '名)</td></tr>';
    html += renderStaffRows(kitchenStaff);

    // 最低人数の定義（店舗設定から取得、未設定時はデフォルト値）
    var hallMinWeekday = parseInt(this.settings['平日ホール最低人数']) || 3;
    var hallMinWeekend = parseInt(this.settings['土日ホール最低人数']) || 5;
    var kitchenMinWeekday = parseInt(this.settings['平日キッチン最低人数']) || 2;
    var kitchenMinWeekend = parseInt(this.settings['土日キッチン最低人数']) || 4;

    // ホール出勤人数のサマリー行
    html += '<tr class="summary-row"><td class="staff-name-col">ホール出勤</td>';
    for (var dd = 1; dd <= daysInMonth; dd++) {
      var ddDate = this.yearMonth + '-' + ('0' + dd).slice(-2);
      var ddDow = new Date(year, month - 1, dd).getDay();
      // 祝日も土日扱い
      var isWeekend = (window.Holidays ? window.Holidays.isWeekendOrHoliday(ddDate) : (ddDow === 0 || ddDow === 6));
      var hallMin = isWeekend ? hallMinWeekend : hallMinWeekday;
      var hallCount = dailyHallCount[ddDate] || 0;
      html += '<td class="' + (hallCount < hallMin ? 'shortage' : '') + '" title="最低' + hallMin + '人">' + hallCount + '</td>';
    }
    html += '<td></td></tr>';

    // キッチン出勤人数のサマリー行
    html += '<tr class="summary-row"><td class="staff-name-col">キッチン出勤</td>';
    for (var dk = 1; dk <= daysInMonth; dk++) {
      var dkDate = this.yearMonth + '-' + ('0' + dk).slice(-2);
      var dkDow = new Date(year, month - 1, dk).getDay();
      // 祝日も土日扱い
      var isWeekendK = (window.Holidays ? window.Holidays.isWeekendOrHoliday(dkDate) : (dkDow === 0 || dkDow === 6));
      var kitchenMin = isWeekendK ? kitchenMinWeekend : kitchenMinWeekday;
      var kitchenCount = dailyKitchenCount[dkDate] || 0;
      html += '<td class="' + (kitchenCount < kitchenMin ? 'shortage' : '') + '" title="最低' + kitchenMin + '人">' + kitchenCount + '</td>';
    }
    html += '<td></td></tr>';

    html += '</table>';
    container.innerHTML = html;
  },

  editShift: function(shiftId, dateStr, staffId) {
    // ドラッグ直後のクリックではモーダルを開かない
    if (this._dragJustFinished) return;
    this.editingShiftId = shiftId; this.editingDate = dateStr;
    var shift = null;
    for (var i = 0; i < this.schedules.length; i++) { if (this.schedules[i].id === shiftId) { shift = this.schedules[i]; break; } }
    var parts = dateStr.split('-'); var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    document.getElementById('ase-modal-title').textContent = parseInt(parts[1]) + '/' + parseInt(parts[2]) + '(' + dayNames[d.getDay()] + ') シフト編集';
    this.populateStaffSelect(staffId);
    if (shift) { document.getElementById('ase-modal-start').value = shift.startTime; document.getElementById('ase-modal-end').value = shift.endTime; }
    document.getElementById('ase-delete-btn').classList.remove('hidden'); this.updateWorkHoursPreview(); App.showModal('ase-edit-modal');
  },

  addShift: function(dateStr, staffId) {
    this.editingShiftId = null; this.editingDate = dateStr;
    var parts = dateStr.split('-'); var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    document.getElementById('ase-modal-title').textContent = parseInt(parts[1]) + '/' + parseInt(parts[2]) + '(' + dayNames[d.getDay()] + ') シフト追加';
    this.populateStaffSelect(staffId);
    document.getElementById('ase-modal-start').value = '11:00'; document.getElementById('ase-modal-end').value = '17:00';
    document.getElementById('ase-delete-btn').classList.add('hidden'); this.updateWorkHoursPreview(); App.showModal('ase-edit-modal');
  },

  populateStaffSelect: function(selectedId) {
    var el = document.getElementById('ase-modal-staff'); el.innerHTML = '';
    for (var i = 0; i < this.staffList.length; i++) { var opt = document.createElement('option'); opt.value = this.staffList[i].id; opt.textContent = this.staffList[i].name; el.appendChild(opt); }
    if (selectedId) el.value = selectedId;
  },

  // クイック時間設定
  setQuickTime: function(start, end) {
    document.getElementById('ase-modal-start').value = start;
    document.getElementById('ase-modal-end').value = end;
    this.updateWorkHoursPreview();
  },

  // 労働時間プレビュー＋労基法アラート
  updateWorkHoursPreview: function() {
    var startEl = document.getElementById('ase-modal-start');
    var endEl = document.getElementById('ase-modal-end');
    var previewEl = document.getElementById('ase-work-hours-preview');
    if (!startEl || !endEl || !previewEl) return;
    var start = startEl.value;
    var end = endEl.value;
    if (!start || !end) { previewEl.textContent = ''; return; }
    var sParts = start.split(':'); var eParts = end.split(':');
    var startMin = parseInt(sParts[0]) * 60 + parseInt(sParts[1]);
    var endMin = parseInt(eParts[0]) * 60 + parseInt(eParts[1]);
    if (endMin <= startMin) endMin += 24 * 60;
    var totalMin = endMin - startMin;
    var totalH = totalMin / 60;
    // 休憩計算（労基法: 6h超45分、8h超60分）
    var requiredBreak = 0;
    if (totalH > 8) requiredBreak = 60;
    else if (totalH > 6) requiredBreak = 45;
    var actualH = Math.round((totalMin - requiredBreak) / 60 * 10) / 10;
    var html = '勤務: ' + totalH.toFixed(1) + 'h - 休憩: ' + requiredBreak + '分 = <span style="font-weight:bold;color:#4A3323">実働 ' + actualH + 'h</span>';
    // 労基法アラート（自動で休憩を組み込んでいることをユーザーに明示）
    if (requiredBreak > 0) {
      var msg = totalH > 8 ? '8時間を超える勤務には1時間以上の休憩が必要です' : '6時間を超える勤務には45分以上の休憩が必要です';
      html += '<div class="labor-law-alert">⚠ 労基法: ' + msg + '（自動で組み込み済み）</div>';
    }
    previewEl.innerHTML = html;
  },

  saveEntry: function() {
    var staffId = document.getElementById('ase-modal-staff').value;
    var startTime = document.getElementById('ase-modal-start').value;
    var endTime = document.getElementById('ase-modal-end').value;
    if (startTime >= endTime) { App.showToast('終了時間は開始時間より後にしてください', 'error'); return; }
    App.showLoading('保存中...'); var self = this;
    if (this.editingShiftId) {
      API.updateShiftEntry(this.editingShiftId, { startTime: startTime, endTime: endTime }).then(function(result) {
        App.hideLoading(); App.hideModal('ase-edit-modal');
        if (result.success) { App.showToast('更新しました', 'success'); self.load(); } else { App.showToast(result.message, 'error'); }
      }).catch(function() { App.hideLoading(); App.showToast('更新に失敗しました', 'error'); });
    } else {
      API.addShiftEntry({ staffId: staffId, yearMonth: this.yearMonth, date: this.editingDate, startTime: startTime, endTime: endTime }).then(function(result) {
        App.hideLoading(); App.hideModal('ase-edit-modal');
        if (result.success) { App.showToast('追加しました', 'success'); self.load(); } else { App.showToast(result.message, 'error'); }
      }).catch(function() { App.hideLoading(); App.showToast('追加に失敗しました', 'error'); });
    }
  },

  deleteEntry: function() {
    if (!this.editingShiftId) return;
    if (!App.confirm('このシフトを削除しますか？')) return;
    App.showLoading('削除中...'); var self = this;
    API.deleteShiftEntry(this.editingShiftId).then(function(result) {
      App.hideLoading(); App.hideModal('ase-edit-modal');
      if (result.success) { App.showToast('削除しました', 'success'); self.load(); } else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('削除に失敗しました', 'error'); });
  },

  // シフト希望の提出状況を表示
  renderRequestSummary: function(summary) {
    var el = document.getElementById('ase-request-summary');
    if (!el || !summary) return;
    var parts = this.yearMonth.split('-');
    var month = parseInt(parts[1]);
    var submitted = summary.submittedCount || 0;
    var total = summary.totalStaff || 0;
    var pct = total > 0 ? Math.round(submitted / total * 100) : 0;
    var color = pct >= 100 ? '#2E7D32' : (pct >= 50 ? '#E65100' : '#C62828');
    var html = '<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:#FFF8E1;border-radius:8px;border:1px solid #FFE082">';
    html += '<span style="font-size:13px">' + month + '月 シフト希望提出:</span>';
    html += '<span style="font-weight:bold;color:' + color + ';font-size:15px">' + submitted + ' / ' + total + '人</span>';
    html += '<span style="font-size:12px;color:#888">(' + pct + '%)</span>';
    if (summary.notSubmitted && summary.notSubmitted.length > 0) {
      var names = summary.notSubmitted.map(function(s) { return esc(s.name); }).join(', ');
      html += '<span style="font-size:11px;color:#C62828;margin-left:8px">未提出: ' + names + '</span>';
    }
    html += '</div>';
    el.innerHTML = html;
  },

  // シフトを全クリア
  clearShift: function() {
    if (this.schedules.length === 0) {
      App.showToast('クリアするシフトがありません', 'error');
      return;
    }
    if (!App.confirm(this.yearMonth + 'のシフトを全てクリアしますか？\nこの操作は元に戻せません。')) return;
    App.showLoading('クリア中...'); var self = this;
    API.clearShift(this.yearMonth).then(function(result) {
      App.hideLoading();
      if (result.success) {
        App.showToast(result.message, 'success');
        document.getElementById('ase-warnings').innerHTML = '';
        self.load();
      } else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('クリアに失敗しました', 'error'); });
  },

  autoGenerate: function() {
    if (!App.confirm(this.yearMonth + 'のシフトを自動作成しますか？\n(既存のシフトは上書きされます)')) return;
    App.showLoading('シフトを自動作成中...'); var self = this;
    API.generateAutoShift(this.yearMonth).then(function(result) {
      App.hideLoading();
      if (result.success) {
        App.showToast(result.message, 'success');
        var warnEl = document.getElementById('ase-warnings');
        if (result.warnings && result.warnings.length > 0) {
          var summaryMsg = '<div class="alert alert-info mb-8">人員不足の日が ' + result.warnings.length + ' 件あります（テスト環境ではスタッフが少ないため正常です）</div>';
          warnEl.innerHTML = summaryMsg;
        } else { warnEl.innerHTML = ''; }
        self.load();
      } else { App.showToast(result.message || '自動作成に失敗しました', 'error'); }
    }).catch(function(err) {
      App.hideLoading();
      console.error('自動作成エラー:', err);
      App.showToast('自動作成に失敗しました: ' + (err.message || 'ネットワークエラー'), 'error');
    });
  },

  resolveSurplus: function() {
    if (this.schedules.length === 0) {
      App.showToast('先に自動配置を実行してください', 'error');
      return;
    }
    App.showLoading('余剰を解消中...'); var self = this;
    API.resolveSurplus(this.yearMonth).then(function(result) {
      App.hideLoading();
      if (result.success) {
        var msg = result.message;
        if (result.changes && result.changes.length > 0) {
          msg += '\n\n変更内容:\n' + result.changes.slice(0, 5).join('\n');
          if (result.changes.length > 5) msg += '\n... 他' + (result.changes.length - 5) + '件';
        }
        App.showToast(result.message, 'success');
        // 強制的にデータ再読み込み＆再描画
        self.goToStep(2);
      } else { App.showToast(result.message || '失敗しました', 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('余剰解消に失敗しました', 'error'); });
  },

  finalizeShift: function() {
    if (this.schedules.length === 0) {
      App.showToast('シフトがまだ作成されていません。先に「自動作成」ボタンを押してください。', 'error');
      return;
    }
    if (!App.confirm(this.yearMonth + 'のシフトを確定しますか？')) return;
    App.showLoading('確定処理中...'); var self = this;
    API.finalizeShift(this.yearMonth).then(function(result) {
      App.hideLoading(); if (result.success) { App.showToast(result.message, 'success'); self.load(); } else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('確定処理に失敗しました', 'error'); });
  },

  sendNotification: function() {
    if (!App.confirm('シフト確定の通知をLINEに送信しますか？')) return;
    App.showLoading('LINE通知を送信中...');
    API.sendShiftConfirmNotification(this.yearMonth).then(function(result) {
      App.hideLoading(); if (result.success) { App.showToast('LINE通知を送信しました', 'success'); } else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('通知の送信に失敗しました', 'error'); });
  },

  // 正社員の月間労働時間サマリーを描画する
  renderStaffHours: function() {
    var container = document.getElementById('ase-staff-hours');
    if (!container) return;

    var staffHoursMap = {};
    var staffDaysMap = {};
    for (var i = 0; i < this.schedules.length; i++) {
      var sc = this.schedules[i];
      if (!staffHoursMap[sc.staffId]) { staffHoursMap[sc.staffId] = 0; staffDaysMap[sc.staffId] = 0; }
      staffHoursMap[sc.staffId] += (sc.workHours || 0);
      staffDaysMap[sc.staffId]++;
    }

    var ftStaff = [];
    var ptStaff = [];
    for (var fi = 0; fi < this.staffList.length; fi++) {
      if (this.staffList[fi].employmentType === '正社員') ftStaff.push(this.staffList[fi]);
      else ptStaff.push(this.staffList[fi]);
    }

    var html = '<div style="background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:12px;font-size:12px">';
    html += '<div style="font-weight:bold;font-size:14px;color:#4A3323;margin-bottom:8px;text-align:center">月間稼働時間</div>';

    function renderStaffGroup(group, label) {
      var h = '<div style="font-weight:bold;color:#8D6E63;font-size:11px;margin:8px 0 4px;border-bottom:1px solid #E8E0D8;padding-bottom:2px">' + label + '</div>';
      for (var si = 0; si < group.length; si++) {
        var s = group[si];
        var totalH = Math.round((staffHoursMap[s.id] || 0) * 10) / 10;
        var days = staffDaysMap[s.id] || 0;
        var posL = s.position === 'キッチン' ? 'K' : 'H';
        var color = '#4A3323';
        var warn = '';
        if (s.employmentType === '正社員') {
          if (totalH > 280) { color = '#C62828'; warn = ' !!'; }
          else if (totalH > 240) { color = '#E65100'; warn = ' !'; }
        }
        h += '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted #F0E8DC">';
        h += '<span>' + esc(s.name) + '<span style="color:#888;font-size:9px"> ' + posL + '</span></span>';
        h += '<span style="font-weight:bold;color:' + color + '">' + totalH + 'h' + warn + ' <span style="color:#888;font-size:9px">' + days + '日</span></span>';
        h += '</div>';
      }
      return h;
    }

    if (ftStaff.length > 0) html += renderStaffGroup(ftStaff, '正社員');
    if (ptStaff.length > 0) html += renderStaffGroup(ptStaff, 'アルバイト');

    html += '</div>';
    // 以下は不要（旧プログレスバーコード互換）
    container.innerHTML = html;
    return; // 早期リターン

    var fulltimeStaff = ftStaff;
    var maxHours = 320;
    var fakeHtml = '';
    for (var ssi = 0; ssi < fulltimeStaff.length; ssi++) {
      var staff = fulltimeStaff[ssi];
      var totalH2 = staffHoursMap[staff.id] || 0;
      var roundedH = Math.round(totalH2 * 10) / 10;
      var pos = staff.position || 'ホール';
      var barClass = 'ok'; var valueColor = '#2E7D32'; var statusLabel = '';
      var widthPct = 0;
      var line240 = 0; var line280 = 0;
      // プログレスバーの���りつぶし
      html += '<div class="hours-bar-fill ' + barClass + '" style="width:' + widthPct + '%"></div>';
      html += '</div>';
      html += '<div class="hours-value" style="color:' + valueColor + '">' + roundedH + 'h' + statusLabel + '</div>';
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  },

  // 週表示
  renderWeekView: function() {
    var container = document.getElementById('ase-matrix');
    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]); var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // 週の開始日を計算（月曜始まり）
    var firstDay = new Date(year, month - 1, 1);
    var startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    var weekStart = 1 - startOffset + (this.weekOffset * 7);
    if (weekStart < 1) weekStart = 1;
    var weekEnd = Math.min(weekStart + 6, daysInMonth);

    // スタッフマップ
    var schedMap = {};
    for (var i = 0; i < this.schedules.length; i++) {
      var s = this.schedules[i];
      if (!schedMap[s.staffId]) schedMap[s.staffId] = {};
      schedMap[s.staffId][s.date] = s;
    }
    var reqMap = {};
    for (var ri = 0; ri < this.requests.length; ri++) {
      var r = this.requests[ri];
      if (!reqMap[r.staffId]) reqMap[r.staffId] = {};
      reqMap[r.staffId][r.date] = r;
    }

    // 正社員ソート
    function sortPriority(a, b) {
      var aFt = a.employmentType === '正社員' ? 0 : 1;
      var bFt = b.employmentType === '正社員' ? 0 : 1;
      if (aFt !== bFt) return aFt - bFt;
      return (a.kana || a.name).localeCompare(b.kana || b.name);
    }
    var sortedStaff = this.staffList.slice().sort(sortPriority);

    // ナビゲーション
    var self = this;
    var html = '<div class="week-nav">';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.weekOffset--;AdminShiftEdit.renderWeekView()">&#9664;</button>';
    html += '<span class="week-nav-label">' + month + '/' + weekStart + ' ~ ' + month + '/' + weekEnd + '</span>';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.weekOffset++;AdminShiftEdit.renderWeekView()">&#9654;</button>';
    html += '</div>';

    // テーブル
    html += '<table class="week-view-table"><tr><th>スタッフ</th>';
    for (var d = weekStart; d <= weekEnd; d++) {
      if (d < 1 || d > daysInMonth) continue;
      var dow = new Date(year, month - 1, d).getDay();
      var dayStyle = dow === 0 ? ' style="color:#FFCDD2"' : (dow === 6 ? ' style="color:#90CAF9"' : '');
      html += '<th' + dayStyle + '>' + d + '(' + dayNames[dow] + ')</th>';
    }
    html += '</tr>';

    for (var si = 0; si < sortedStaff.length; si++) {
      var staff = sortedStaff[si];
      var nameLabel = (staff.employmentType === '正社員' ? '[社] ' : '') + staff.name;
      html += '<tr><td class="time-col" style="text-align:left;font-size:12px">' + esc(nameLabel) + '</td>';
      for (var day = weekStart; day <= weekEnd; day++) {
        if (day < 1 || day > daysInMonth) { html += '<td></td>'; continue; }
        var dateStr = this.yearMonth + '-' + ('0' + day).slice(-2);
        var shift = (schedMap[staff.id] || {})[dateStr];
        var req = (reqMap[staff.id] || {})[dateStr];
        if (shift) {
          html += '<td class="has-shift" onclick="AdminShiftEdit.editShift(\'' + esc(shift.id) + '\',\'' + dateStr + '\',\'' + esc(staff.id) + '\')" title="' + esc(shift.startTime + '-' + shift.endTime) + '">';
          html += '<div style="font-size:12px;font-weight:bold">' + esc(shift.startTime) + '</div>';
          html += '<div style="font-size:11px;color:#666">~' + esc(shift.endTime) + '</div>';
          html += '<div style="font-size:10px;color:#888">' + (shift.workHours || 0) + 'h</div>';
          html += '</td>';
        } else if (req) {
          var bgColor = req.type === '出勤希望' ? '#E3F2FD' : (req.type === '休み希望' ? '#FFEBEE' : '#FFF8E1');
          html += '<td style="background:' + bgColor + ';cursor:pointer;font-size:11px" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\',\'' + esc(staff.id) + '\')">';
          html += req.type === '休み希望' ? '休' : esc(req.startTime || 'OK');
          html += '</td>';
        } else {
          html += '<td style="cursor:pointer" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\',\'' + esc(staff.id) + '\')"></td>';
        }
      }
      html += '</tr>';
    }
    html += '</table>';
    container.innerHTML = html;
  },

  // 日表示
  renderDayView: function() {
    var container = document.getElementById('ase-matrix');
    if (!this.selectedDay) { this.selectedDay = this.yearMonth + '-01'; }
    var parts = this.selectedDay.split('-');
    var year = parseInt(parts[0]); var month = parseInt(parts[1]); var day = parseInt(parts[2]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dateObj = new Date(year, month - 1, day);
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // ナビゲーション
    var html = '<div class="week-nav">';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.prevDay()">&#9664;</button>';
    html += '<span class="week-nav-label">' + month + '/' + day + '(' + dayNames[dateObj.getDay()] + ')</span>';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.nextDay()">&#9654;</button>';
    html += '</div>';

    // この日のシフト
    var dayShifts = [];
    for (var i = 0; i < this.schedules.length; i++) {
      if (this.schedules[i].date === this.selectedDay) dayShifts.push(this.schedules[i]);
    }

    // スタッフマップ
    var staffMap = {};
    for (var si = 0; si < this.staffList.length; si++) { staffMap[this.staffList[si].id] = this.staffList[si]; }

    // タイムライン（6時〜24時）
    html += '<div class="day-view-timeline">';
    for (var h = 6; h <= 23; h++) {
      html += '<div class="day-view-hour">';
      html += '<div class="day-view-hour-label">' + ('0' + h).slice(-2) + ':00</div>';
      html += '<div class="day-view-slots">';
      for (var si2 = 0; si2 < dayShifts.length; si2++) {
        var shift = dayShifts[si2];
        var shiftStart = parseInt(shift.startTime.split(':')[0]);
        var shiftEnd = parseInt(shift.endTime.split(':')[0]);
        if (shiftStart <= h && h < shiftEnd) {
          var st = staffMap[shift.staffId];
          var chipClass = 'day-view-chip' + ((st && st.position === 'キッチン') ? ' kitchen' : '');
          var label = st ? st.name : shift.staffId;
          if (h === shiftStart) {
            label += ' ' + shift.startTime + '-' + shift.endTime;
          }
          html += '<span class="' + chipClass + '" onclick="AdminShiftEdit.editShift(\'' + esc(shift.id) + '\',\'' + this.selectedDay + '\',\'' + esc(shift.staffId) + '\')">' + esc(label) + '</span>';
        }
      }
      html += '</div></div>';
    }
    html += '</div>';

    // この日にシフトがないスタッフ（追加用）
    var assignedIds = {};
    for (var ai = 0; ai < dayShifts.length; ai++) { assignedIds[dayShifts[ai].staffId] = true; }
    var unassigned = this.staffList.filter(function(s) { return !assignedIds[s.id]; });
    if (unassigned.length > 0) {
      html += '<div style="margin-top:12px;padding:8px;background:#FFF8E1;border-radius:8px">';
      html += '<div style="font-size:12px;color:#888;margin-bottom:4px">未配置のスタッフ（クリックで追加）:</div>';
      for (var ui = 0; ui < unassigned.length; ui++) {
        html += '<span class="day-view-chip" style="margin:2px" onclick="AdminShiftEdit.addShift(\'' + this.selectedDay + '\',\'' + esc(unassigned[ui].id) + '\')">' + esc(unassigned[ui].name) + '</span>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
  },

  prevDay: function() {
    var parts = this.selectedDay.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() - 1);
    if (d.getMonth() + 1 === parseInt(parts[1])) {
      this.selectedDay = this.yearMonth + '-' + ('0' + d.getDate()).slice(-2);
      this.renderCurrentView();
    }
  },

  nextDay: function() {
    var parts = this.selectedDay.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() + 1);
    if (d.getMonth() + 1 === parseInt(parts[1])) {
      this.selectedDay = this.yearMonth + '-' + ('0' + d.getDate()).slice(-2);
      this.renderCurrentView();
    }
  },

  // ガントチャートビュー
  renderGanttView: function() {
    var container = document.getElementById('ase-matrix');
    if (!this.selectedDay) {
      var today = new Date();
      var todayStr = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
      this.selectedDay = todayStr.substring(0, 7) === this.yearMonth ? todayStr : this.yearMonth + '-01';
    }
    var parts = this.selectedDay.split('-');
    var year = parseInt(parts[0]); var month = parseInt(parts[1]); var day = parseInt(parts[2]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dateObj = new Date(year, month - 1, day);
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    // 祝日も土日扱い
    var isWeekend = (window.Holidays ? window.Holidays.isWeekendOrHoliday(date) : (dateObj.getDay() === 0 || dateObj.getDay() === 6));

    // 時間帯設定を取得
    var timeSlotStaffing = [];
    try { timeSlotStaffing = JSON.parse(this.settings['時間帯別必要人数'] || '[]'); } catch(e) {}

    // この日のシフト
    var dayShifts = [];
    for (var i = 0; i < this.schedules.length; i++) {
      if (this.schedules[i].date === this.selectedDay) dayShifts.push(this.schedules[i]);
    }
    var staffMap = {};
    for (var si = 0; si < this.staffList.length; si++) { staffMap[this.staffList[si].id] = this.staffList[si]; }

    // 表示する時間の範囲（6時〜24時）
    var startHour = 6; var endHour = 24;
    var totalSlots = (endHour - startHour) * 2; // 30分刻み

    // ナビゲーション
    var html = '<div class="week-nav">';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.prevDay()">&#9664;</button>';
    html += '<span class="week-nav-label">' + month + '/' + day + '(' + dayNames[dateObj.getDay()] + ')' + (isWeekend ? ' [土日]' : ' [平日]') + '</span>';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.nextDay()">&#9654;</button>';
    html += '</div>';
    // 凡例：色の意味を上部に明示
    html += '<div class="gantt-legend">';
    html += '<span class="legend-item"><span class="legend-swatch" style="background:#90A4AE"></span>勤務（ホール）</span>';
    html += '<span class="legend-item"><span class="legend-swatch" style="background:#78909C"></span>勤務（キッチン）</span>';
    html += '<span class="legend-item"><span class="legend-swatch" style="background:#FFE082;border:1px solid #FBC02D"></span>休憩</span>';
    html += '</div>';

    // ポジション別にスタッフを分ける
    var hallStaff = []; var kitchenStaff = [];
    for (var pi = 0; pi < this.staffList.length; pi++) {
      var pos = this.staffList[pi].position || 'ホール';
      if (pos === 'キッチン') kitchenStaff.push(this.staffList[pi]);
      else hallStaff.push(this.staffList[pi]);
    }

    // ガントチャートのテーブル
    html += '<div class="gantt-container"><table class="gantt-table">';

    // ヘッダー: 時間軸
    html += '<tr><th class="gantt-name-col">スタッフ</th>';
    for (var h = startHour; h < endHour; h++) {
      html += '<th colspan="2">' + ('0' + h).slice(-2) + ':00</th>';
    }
    html += '</tr>';

    // シフトバーを描画する関数
    var self = this;
    function renderGanttRows(staffGroup, posLabel) {
      // ポジションヘッダー
      var rowHtml = '<tr class="gantt-position-header"><td colspan="' + (totalSlots + 1) + '">' + posLabel + ' (' + staffGroup.length + '名)</td></tr>';

      for (var si = 0; si < staffGroup.length; si++) {
        var staff = staffGroup[si];
        var empBadge = staff.employmentType === '正社員' ? '<span class="emp-badge fulltime">社</span>' : '<span class="emp-badge parttime">AP</span>';
        rowHtml += '<tr class="gantt-row"><td class="gantt-name-cell">' + esc(staff.name) + empBadge + '</td>';

        // この人のこの日のシフトを探す
        var shift = null;
        for (var di = 0; di < dayShifts.length; di++) {
          if (dayShifts[di].staffId === staff.id) { shift = dayShifts[di]; break; }
        }

        // セル描画
        for (var slot = 0; slot < totalSlots; slot++) {
          rowHtml += '<td class="gantt-cell" data-slot="' + slot + '" data-staff="' + esc(staff.id) + '">';

          // シフトバーは開始スロットにのみ描画
          if (shift) {
            var shiftStartMin = parseInt(shift.startTime.split(':')[0]) * 60 + parseInt(shift.startTime.split(':')[1]);
            var shiftEndMin = parseInt(shift.endTime.split(':')[0]) * 60 + parseInt(shift.endTime.split(':')[1]);
            var slotMin = (startHour + Math.floor(slot / 2)) * 60 + (slot % 2) * 30;

            if (slotMin === shiftStartMin) {
              var barWidth = Math.round((shiftEndMin - shiftStartMin) / 30);
              // 自動配置=灰色系、手動編集済み=緑/青
              var barClass = 'gantt-bar';
              var barStyle = '';
              if (shift.creationMethod === '手動') {
                barClass += ' ' + (staff.position === 'キッチン' ? 'kitchen' : 'hall');
              } else {
                barStyle = staff.position === 'キッチン' ? 'background:#78909C;' : 'background:#90A4AE;';
              }
              // 休憩時間の確認（労基法に対する不足を判定）
              var totalH2 = (shiftEndMin - shiftStartMin) / 60;
              var requiredBreak2 = totalH2 > 8 ? 60 : (totalH2 > 6 ? 45 : 0);
              // 保存値が無い・不足する場合は労基法基準で自動表示する（実体上の休憩を可視化）
              var savedBreak2 = (shift.breakMinutes != null) ? shift.breakMinutes : 0;
              var actualBreak2 = Math.max(savedBreak2, requiredBreak2);
              var laborViolation = (requiredBreak2 > 0 && savedBreak2 > 0 && savedBreak2 < requiredBreak2);
              // ラベルは「開始-終了」のみ（休憩文字は黄色四角に書くので重複させない）
              var barLabel = shift.startTime + '-' + shift.endTime;
              var barTitle = staff.name + ' ' + shift.startTime + '-' + shift.endTime + ' (' + (shift.creationMethod === '手動' ? '手動' : 'AI提案') + ')';
              if (actualBreak2 > 0) {
                var brkSrc = savedBreak2 > 0 ? '' : '（労基法による自動表示）';
                barTitle += ' / 休憩' + actualBreak2 + '分' + brkSrc;
              }
              if (laborViolation) barTitle += ' ⚠ 労基法: 必要な休憩が不足（必要' + requiredBreak2 + '分 / 実際' + savedBreak2 + '分）';
              // 休憩がある場合はバーを「グレー｜透明｜グレー」のlinear-gradientで分割表現
              var barColorPick = (staff.position === 'キッチン') ? '#78909C' : '#90A4AE';
              if (shift.creationMethod === '手動') {
                barColorPick = (staff.position === 'キッチン') ? '#1E88E5' : '#5D6D7E';
              }
              var bgStyle = '';
              var brkLeftPct = 0, brkWidthPct = 0;
              if (actualBreak2 > 0) {
                var midM = (shiftStartMin + shiftEndMin) / 2;
                var brkS = midM - actualBreak2 / 2;
                var brkE = midM + actualBreak2 / 2;
                var spanMin = shiftEndMin - shiftStartMin;
                brkLeftPct = ((brkS - shiftStartMin) / spanMin) * 100;
                brkWidthPct = (actualBreak2 / spanMin) * 100;
                var brkRightPct = brkLeftPct + brkWidthPct;
                bgStyle = 'background:linear-gradient(to right,' + barColorPick + ' 0%,' + barColorPick + ' ' + brkLeftPct + '%,transparent ' + brkLeftPct + '%,transparent ' + brkRightPct + '%,' + barColorPick + ' ' + brkRightPct + '%,' + barColorPick + ' 100%);';
              } else {
                bgStyle = 'background:' + barColorPick + ';';
              }
              // 棒の幅は data-bar-width に持たせて、描画後に DOM 実測で px 直接指定する
              rowHtml += '<div class="gantt-bar' + (laborViolation ? ' labor-violation' : '') + (actualBreak2 > 0 ? ' has-break' : '') + '" data-bar-width="' + barWidth + '" style="width:calc(' + barWidth + ' * 100%);left:0;' + bgStyle + '" onclick="AdminShiftEdit.editShift(\'' + esc(shift.id) + '\',\'' + self.selectedDay + '\',\'' + esc(staff.id) + '\')" title="' + esc(barTitle) + '">';
              rowHtml += '<span class="bar-handle left" onmousedown="AdminShiftEdit.startGanttDrag(event,\'' + esc(shift.id) + '\',\'left\')"></span>';
              // ラベルは左半分（休憩前）の中央に表示
              if (barWidth >= 4) {
                var labelLeft = actualBreak2 > 0 ? brkLeftPct / 2 : 50;
                rowHtml += '<span class="bar-label" style="left:' + labelLeft + '%">' + esc(barLabel) + '</span>';
              }
              // 休憩ゾーン：勤務時間の中央に黄色の四角を絶対配置
              if (actualBreak2 > 0) {
                rowHtml += '<span class="break-zone" style="left:' + brkLeftPct + '%;width:' + brkWidthPct + '%;">' + (barWidth >= 6 ? '休' + actualBreak2 + '分' : '休') + '</span>';
              }
              if (laborViolation) {
                rowHtml += '<span class="violation-badge" title="労基法違反">!</span>';
              }
              rowHtml += '<span class="bar-handle right" onmousedown="AdminShiftEdit.startGanttDrag(event,\'' + esc(shift.id) + '\',\'right\')"></span>';
              rowHtml += '</div>';
            }
          }

          // シフトなし & 空セルクリックで追加
          if (!shift) {
            rowHtml = rowHtml.replace(/<td class="gantt-cell"/, '<td class="gantt-cell" style="cursor:pointer" onclick="AdminShiftEdit.addShift(\'' + self.selectedDay + '\',\'' + esc(staff.id) + '\')"');
          }
          rowHtml += '</td>';
        }
        rowHtml += '</tr>';
      }
      return rowHtml;
    }

    html += renderGanttRows(hallStaff, 'ホール');
    // ホール／キッチン間に空行を入れて視覚的に区切る
    html += '<tr class="gantt-position-spacer"><td colspan="' + (totalSlots + 1) + '"></td></tr>';
    html += renderGanttRows(kitchenStaff, 'キッチン');

    // 時間帯別の必要人数/実人数サマリー
    if (timeSlotStaffing.length > 0) {
      html += '<tr class="gantt-summary-row"><td class="gantt-name-cell" style="font-size:11px">ホール過不足</td>';
      for (var slot2 = 0; slot2 < totalSlots; slot2++) {
        var slotMin2 = (startHour + Math.floor(slot2 / 2)) * 60 + (slot2 % 2) * 30;
        var needed = 0; var actual = 0;
        for (var ts = 0; ts < timeSlotStaffing.length; ts++) {
          var tsStart = parseInt(timeSlotStaffing[ts].start.split(':')[0]) * 60 + parseInt(timeSlotStaffing[ts].start.split(':')[1]);
          var tsEnd = parseInt(timeSlotStaffing[ts].end.split(':')[0]) * 60 + parseInt(timeSlotStaffing[ts].end.split(':')[1]);
          if (slotMin2 >= tsStart && slotMin2 < tsEnd) {
            needed = isWeekend ? (timeSlotStaffing[ts].weekendHall || timeSlotStaffing[ts].hall || 0) : (timeSlotStaffing[ts].weekdayHall || timeSlotStaffing[ts].hall || 0);
          }
        }
        for (var ds = 0; ds < dayShifts.length; ds++) {
          var st = staffMap[dayShifts[ds].staffId];
          if (!st || st.position === 'キッチン') continue;
          var dsStart = parseInt(dayShifts[ds].startTime.split(':')[0]) * 60 + parseInt(dayShifts[ds].startTime.split(':')[1]);
          var dsEnd = parseInt(dayShifts[ds].endTime.split(':')[0]) * 60 + parseInt(dayShifts[ds].endTime.split(':')[1]);
          if (slotMin2 >= dsStart && slotMin2 < dsEnd) actual++;
        }
        var diff = actual - needed;
        var cls = needed === 0 ? '' : (diff >= 0 ? 'ok' : 'shortage');
        html += '<td class="' + cls + '">' + (needed > 0 ? actual + '/' + needed : '') + '</td>';
      }
      html += '</tr>';

      html += '<tr class="gantt-summary-row"><td class="gantt-name-cell" style="font-size:11px">キッチン過不足</td>';
      for (var slot3 = 0; slot3 < totalSlots; slot3++) {
        var slotMin3 = (startHour + Math.floor(slot3 / 2)) * 60 + (slot3 % 2) * 30;
        var needed3 = 0; var actual3 = 0;
        for (var ts3 = 0; ts3 < timeSlotStaffing.length; ts3++) {
          var ts3Start = parseInt(timeSlotStaffing[ts3].start.split(':')[0]) * 60 + parseInt(timeSlotStaffing[ts3].start.split(':')[1]);
          var ts3End = parseInt(timeSlotStaffing[ts3].end.split(':')[0]) * 60 + parseInt(timeSlotStaffing[ts3].end.split(':')[1]);
          if (slotMin3 >= ts3Start && slotMin3 < ts3End) {
            needed3 = isWeekend ? (timeSlotStaffing[ts3].weekendKitchen || timeSlotStaffing[ts3].kitchen || 0) : (timeSlotStaffing[ts3].weekdayKitchen || timeSlotStaffing[ts3].kitchen || 0);
          }
        }
        for (var ds3 = 0; ds3 < dayShifts.length; ds3++) {
          var st3 = staffMap[dayShifts[ds3].staffId];
          if (!st3 || st3.position !== 'キッチン') continue;
          var ds3Start = parseInt(dayShifts[ds3].startTime.split(':')[0]) * 60 + parseInt(dayShifts[ds3].startTime.split(':')[1]);
          var ds3End = parseInt(dayShifts[ds3].endTime.split(':')[0]) * 60 + parseInt(dayShifts[ds3].endTime.split(':')[1]);
          if (slotMin3 >= ds3Start && slotMin3 < ds3End) actual3++;
        }
        var diff3 = actual3 - needed3;
        var cls3 = needed3 === 0 ? '' : (diff3 >= 0 ? 'ok' : 'shortage');
        html += '<td class="' + cls3 + '">' + (needed3 > 0 ? actual3 + '/' + needed3 : '') + '</td>';
      }
      html += '</tr>';
    }

    html += '</table></div>';

    // 時間帯別の不足サマリーをカード形式で表示
    if (timeSlotStaffing.length > 0) {
      html += '<div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">';
      for (var tsi = 0; tsi < timeSlotStaffing.length; tsi++) {
        var ts = timeSlotStaffing[tsi];
        var hallNeed = isWeekend ? (ts.weekendHall || ts.hall || 0) : (ts.weekdayHall || ts.hall || 0);
        var kitchenNeed = isWeekend ? (ts.weekendKitchen || ts.kitchen || 0) : (ts.weekdayKitchen || ts.kitchen || 0);
        var tsStartMin = parseInt(ts.start.split(':')[0]) * 60 + parseInt(ts.start.split(':')[1]);
        var tsEndMin = parseInt(ts.end.split(':')[0]) * 60 + parseInt(ts.end.split(':')[1]);
        var hActual = 0, kActual = 0;
        for (var dsi = 0; dsi < dayShifts.length; dsi++) {
          var dsh = dayShifts[dsi];
          var dshS = parseInt(dsh.startTime.split(':')[0]) * 60 + parseInt(dsh.startTime.split(':')[1]);
          var dshE = parseInt(dsh.endTime.split(':')[0]) * 60 + parseInt(dsh.endTime.split(':')[1]);
          if (dshS <= tsStartMin && dshE >= tsEndMin) {
            var dst = staffMap[dsh.staffId];
            if (dst && dst.position === 'キッチン') kActual++;
            else hActual++;
          }
        }
        var hDiff = hActual - hallNeed;
        var kDiff = kActual - kitchenNeed;
        var allOk = hDiff >= 0 && kDiff >= 0;
        var cardBg = allOk ? '#E8F5E9' : '#FFEBEE';
        var cardBorder = allOk ? '#A5D6A7' : '#EF9A9A';
        html += '<div style="flex:1;min-width:200px;background:' + cardBg + ';border:2px solid ' + cardBorder + ';border-radius:12px;padding:12px;text-align:center">';
        html += '<div style="font-weight:bold;font-size:14px;color:#4A3323;margin-bottom:8px">' + esc((ts.label || '') + ' ' + ts.start + ' - ' + ts.end) + '</div>';
        // ホール
        var hColor = hDiff >= 0 ? '#2E7D32' : '#C62828';
        html += '<div style="display:flex;justify-content:space-between;padding:4px 8px"><span>ホール</span><span style="font-weight:bold;color:' + hColor + '">' + hActual + ' / ' + hallNeed + '人';
        if (hDiff < 0) html += ' (' + Math.abs(hDiff) + '名不足!)';
        else if (hDiff > 0) html += ' (+' + hDiff + ')';
        html += '</span></div>';
        // キッチン
        var kColor = kDiff >= 0 ? '#2E7D32' : '#C62828';
        html += '<div style="display:flex;justify-content:space-between;padding:4px 8px"><span>キッチン</span><span style="font-weight:bold;color:' + kColor + '">' + kActual + ' / ' + kitchenNeed + '人';
        if (kDiff < 0) html += ' (' + Math.abs(kDiff) + '名不足!)';
        else if (kDiff > 0) html += ' (+' + kDiff + ')';
        html += '</span></div>';
        html += '</div>';
      }
      html += '</div>';
    }

    // 未配置スタッフ
    var assignedIds = {};
    for (var ai = 0; ai < dayShifts.length; ai++) { assignedIds[dayShifts[ai].staffId] = true; }
    var unassigned = this.staffList.filter(function(s) { return !assignedIds[s.id]; });
    if (unassigned.length > 0) {
      html += '<div style="margin-top:12px;padding:8px;background:#FFF8E1;border-radius:8px">';
      html += '<div style="font-size:12px;color:#888;margin-bottom:4px">未配置スタッフ（クリックで追加）:</div>';
      for (var ui = 0; ui < unassigned.length; ui++) {
        var uBadge = unassigned[ui].employmentType === '正社員' ? '[社]' : '';
        var uPos = unassigned[ui].position === 'キッチン' ? 'K' : 'H';
        html += '<span class="day-view-chip' + (unassigned[ui].position === 'キッチン' ? ' kitchen' : '') + '" style="margin:2px" onclick="AdminShiftEdit.addShift(\'' + this.selectedDay + '\',\'' + esc(unassigned[ui].id) + '\')">' + uBadge + esc(unassigned[ui].name) + '(' + uPos + ')</span>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
    // 描画完了後に、ガントバーの幅をDOMの実セル幅に基づいてpxで直接指定する
    // （ブラウザによっては calc(N * 100%) が border 計算の影響で1〜数ピクセルずれるため、確実に治す）
    setTimeout(function() { AdminShiftEdit.fixGanttBars(); }, 30);
  },

  // 描画後に呼ぶ：ガントバーをDOM実測のセル幅で正確に再配置する
  fixGanttBars: function() {
    var container = document.getElementById('ase-matrix');
    if (!container) return;
    var cells = container.querySelectorAll('.gantt-cell');
    if (cells.length < 2) return;
    // セルの実描画幅を取得（境界線分は getBoundingClientRect で正確に）
    var rect0 = cells[0].getBoundingClientRect();
    var rect1 = cells[1].getBoundingClientRect();
    var cellW = rect1.left - rect0.left; // 隣接セル左端間距離 = 実セル幅 (border 込み)
    if (cellW <= 0) cellW = rect0.width;
    var bars = container.querySelectorAll('.gantt-bar[data-bar-width]');
    for (var i = 0; i < bars.length; i++) {
      var bw = parseInt(bars[i].getAttribute('data-bar-width'), 10);
      if (bw > 0) {
        // N個分の実幅 = N * cellW、最終セルの右borderは1px重なるので-1px補正
        bars[i].style.width = (bw * cellW - 1) + 'px';
      }
    }
  },

  // ガントバーのドラッグ操作（30分刻みで調整）
  // - ドラッグ中はバー要素を直接動かして60fpsで追従させる（requestAnimationFrameでスロットリング）
  // - ドロップ時はローカルstateを楽観更新→バックグラウンドAPI送信→失敗時のみロールバック
  // - 全画面再ロード(load())を廃止。該当ビューのみ部分再描画する。
  _dragState: null,
  _dragJustFinished: false,
  startGanttDrag: function(e, shiftId, side) {
    e.preventDefault(); e.stopPropagation();
    var shift = null;
    for (var i = 0; i < this.schedules.length; i++) {
      if (this.schedules[i].id === shiftId) { shift = this.schedules[i]; break; }
    }
    if (!shift) return;

    // バー要素とそのセル幅（30分=1コマ）を実測
    var handleEl = e.target;
    var barEl = handleEl.closest ? handleEl.closest('.gantt-bar') : null;
    if (!barEl) {
      // closest非対応環境用フォールバック
      barEl = handleEl;
      while (barEl && !(barEl.classList && barEl.classList.contains('gantt-bar'))) barEl = barEl.parentNode;
    }
    if (!barEl) return;

    // 同じ行の最初の .gantt-cell からセル幅を実測（CSSの28px固定と一致するはずだが念のため）
    var cellEl = barEl.parentNode;
    while (cellEl && !(cellEl.classList && cellEl.classList.contains('gantt-cell'))) cellEl = cellEl.parentNode;
    var cellWidth = cellEl ? cellEl.getBoundingClientRect().width : 28;
    if (!cellWidth || cellWidth < 4) cellWidth = 28;

    // ドラッグ前の見た目を記録（pxで保持し、ドラッグ中は直接書き換える）
    var initialBarRect = barEl.getBoundingClientRect();
    var initialCellRect = cellEl ? cellEl.getBoundingClientRect() : initialBarRect;
    var initialLeftPx = initialBarRect.left - initialCellRect.left;
    var initialWidthPx = initialBarRect.width;

    // GPU合成のヒント
    barEl.style.willChange = 'left, width';
    barEl.classList.add('dragging');

    this._dragState = {
      shiftId: shiftId, side: side,
      startX: e.clientX,
      origStart: shift.startTime, origEnd: shift.endTime,
      newStart: shift.startTime, newEnd: shift.endTime,
      barEl: barEl, cellWidth: cellWidth,
      initialLeftPx: initialLeftPx, initialWidthPx: initialWidthPx,
      lastClientX: e.clientX,
      rafId: null
    };

    var self = this;
    var onMove = function(ev) {
      ev.preventDefault();
      if (!self._dragState) return;
      self._dragState.lastClientX = ev.clientX;
      // requestAnimationFrameで間引き（マウス座標は連続的に来るがDOM更新は1フレーム1回）
      if (self._dragState.rafId) return;
      self._dragState.rafId = requestAnimationFrame(function() {
        if (!self._dragState) return;
        self._dragState.rafId = null;
        self._onGanttDrag(self._dragState.lastClientX);
      });
    };
    var onUp = function(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (self._dragState && self._dragState.rafId) {
        cancelAnimationFrame(self._dragState.rafId);
      }
      // 後始末
      if (self._dragState) {
        var st = self._dragState;
        if (st.barEl) {
          st.barEl.style.willChange = '';
          st.barEl.classList.remove('dragging');
        }
      }
      self._finishGanttDrag();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  },

  _onGanttDrag: function(clientX) {
    var state = this._dragState;
    if (!state) return;
    var dx = clientX - state.startX;
    var slotDelta = Math.round(dx / state.cellWidth);
    var minutesDelta = slotDelta * 30;

    var origStartMin = parseInt(state.origStart.split(':')[0]) * 60 + parseInt(state.origStart.split(':')[1]);
    var origEndMin = parseInt(state.origEnd.split(':')[0]) * 60 + parseInt(state.origEnd.split(':')[1]);

    var newStartMin = origStartMin;
    var newEndMin = origEndMin;
    if (state.side === 'left') {
      newStartMin = Math.max(360, Math.min(origStartMin + minutesDelta, origEndMin - 30));
    } else {
      newEndMin = Math.min(1440, Math.max(origEndMin + minutesDelta, origStartMin + 30));
    }

    state.newStart = ('0' + Math.floor(newStartMin / 60)).slice(-2) + ':' + ('0' + (newStartMin % 60)).slice(-2);
    state.newEnd = ('0' + Math.floor(newEndMin / 60)).slice(-2) + ':' + ('0' + (newEndMin % 60)).slice(-2);

    // バーを実際に動かす（pxで直接書き換え。CSS calc()よりも軽い）
    if (state.barEl) {
      var leftDeltaSlots = (newStartMin - origStartMin) / 30; // 左ハンドルなら変化、右ハンドルなら0
      var widthDeltaSlots = (newEndMin - origEndMin) / 30 - leftDeltaSlots;
      var newLeftPx = state.initialLeftPx + leftDeltaSlots * state.cellWidth;
      var newWidthPx = state.initialWidthPx + widthDeltaSlots * state.cellWidth;
      // 右ハンドルの場合は left は変えない、widthのみ
      if (state.side === 'right') {
        state.barEl.style.width = (state.initialWidthPx + ((newEndMin - origEndMin) / 30) * state.cellWidth) + 'px';
      } else {
        state.barEl.style.left = newLeftPx + 'px';
        state.barEl.style.width = (state.initialWidthPx + ((origStartMin - newStartMin) / 30) * state.cellWidth) + 'px';
      }
      // ツールチップに新時刻を反映（マウスホバー時にすぐ確認できる）
      state.barEl.setAttribute('title', state.newStart + '-' + state.newEnd);
    }
  },

  _finishGanttDrag: function() {
    if (!this._dragState) return;
    var state = this._dragState; this._dragState = null;

    // 変化がなければそのまま終了
    if (state.newStart === state.origStart && state.newEnd === state.origEnd) return;

    // ドラッグ直後のクリックでモーダルが開かないようフラグ設定
    this._dragJustFinished = true;
    var self = this;
    setTimeout(function() { self._dragJustFinished = false; }, 300);

    // 楽観的更新：ローカルschedulesを即座に書き換え
    var target = null;
    for (var i = 0; i < this.schedules.length; i++) {
      if (this.schedules[i].id === state.shiftId) { target = this.schedules[i]; break; }
    }
    if (target) {
      target.startTime = state.newStart;
      target.endTime = state.newEnd;
    }

    // 該当ビューのみ部分再描画（API再取得しない＝重い処理は走らない）
    // どちらのビューが現在描画されているかは selectedDay の有無では判定できないため、
    // ガント関連の描画関数を持っていればそれを呼ぶ。週ビューが基本。
    if (typeof this.renderGanttWeekView === 'function' && document.querySelector('.gantt-table')) {
      // 日ビューが描画されているなら日ビュー、そうでなければ週ビュー
      // ガントテーブル内に「日付列」があれば週ビュー、なければ日ビュー
      var hasDateHeader = document.querySelector('.gantt-table th[data-date]');
      if (hasDateHeader) {
        this.renderGanttWeekView();
      } else if (typeof this.renderGanttDayView === 'function') {
        this.renderGanttDayView();
      } else {
        this.renderGanttWeekView();
      }
    }
    if (typeof this.renderStaffHours === 'function') {
      this.renderStaffHours();
    }

    // 控えめに進行中トーストを出す（loading overlayは出さない）
    App.showToast(state.newStart + '-' + state.newEnd + ' に変更', 'info');

    // バックグラウンドAPI送信
    API.updateShiftEntry(state.shiftId, { startTime: state.newStart, endTime: state.newEnd }).then(function(result) {
      if (result && result.success) {
        // 成功時は何も追加表示しない（既に画面は反映済み）
      } else {
        // ロールバック
        if (target) { target.startTime = state.origStart; target.endTime = state.origEnd; }
        if (typeof self.renderGanttWeekView === 'function') self.renderGanttWeekView();
        if (typeof self.renderStaffHours === 'function') self.renderStaffHours();
        App.showToast((result && result.message) || '更新できませんでした（元に戻しました）', 'error');
      }
    }).catch(function() {
      if (target) { target.startTime = state.origStart; target.endTime = state.origEnd; }
      if (typeof self.renderGanttWeekView === 'function') self.renderGanttWeekView();
      if (typeof self.renderStaffHours === 'function') self.renderStaffHours();
      App.showToast('通信エラーで更新できませんでした（元に戻しました）', 'error');
    });
  },

  // ガント週表示
  renderGanttWeekView: function() {
    var container = document.getElementById('ase-matrix');
    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]); var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    var startHour = 9; var endHour = 23;
    var totalSlots = (endHour - startHour) * 2;

    var firstDay = new Date(year, month - 1, 1);
    var startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    var weekStart = 1 - startOffset + (this.weekOffset * 7);
    if (weekStart < 1) weekStart = 1;
    var weekEnd = Math.min(weekStart + 6, daysInMonth);

    var timeSlots = [];
    try { timeSlots = JSON.parse(this.settings['時間帯別必要人数'] || '[]'); } catch(e) {}

    var staffMap = {};
    for (var si = 0; si < this.staffList.length; si++) staffMap[this.staffList[si].id] = this.staffList[si];

    var schedByDate = {};
    for (var i = 0; i < this.schedules.length; i++) {
      var s = this.schedules[i];
      if (!schedByDate[s.date]) schedByDate[s.date] = [];
      schedByDate[s.date].push(s);
    }

    var self = this;
    var html = '<div class="week-nav">';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.weekOffset--;AdminShiftEdit.renderGanttWeekView()">&#9664;</button>';
    html += '<span class="week-nav-label">' + month + '/' + weekStart + ' ~ ' + month + '/' + weekEnd + '</span>';
    html += '<button class="week-nav-btn" onclick="AdminShiftEdit.weekOffset++;AdminShiftEdit.renderGanttWeekView()">&#9654;</button>';
    html += '</div>';
    // 凡例：色の意味を上部に明示
    html += '<div class="gantt-legend">';
    html += '<span class="legend-item"><span class="legend-swatch" style="background:#90A4AE"></span>勤務（ホール）</span>';
    html += '<span class="legend-item"><span class="legend-swatch" style="background:#78909C"></span>勤務（キッチン）</span>';
    html += '<span class="legend-item"><span class="legend-swatch" style="background:#FFE082;border:1px solid #FBC02D"></span>休憩</span>';
    html += '</div>';

    // ヘルパー: 時間帯の実人数を計算
    function calcSlotCounts(dayShifts, slot, isWknd) {
      var hallN = isWknd ? (slot.weekendHall || slot.hall || 0) : (slot.weekdayHall || slot.hall || 0);
      var kitchenN = isWknd ? (slot.weekendKitchen || slot.kitchen || 0) : (slot.weekdayKitchen || slot.kitchen || 0);
      var slotS = parseInt(slot.start.split(':')[0]) * 60 + parseInt(slot.start.split(':')[1]);
      var slotE = parseInt(slot.end.split(':')[0]) * 60 + parseInt(slot.end.split(':')[1]);
      var hC = 0, kC = 0;
      for (var di = 0; di < dayShifts.length; di++) {
        var sh = dayShifts[di]; var st = staffMap[sh.staffId]; if (!st) continue;
        var sS = parseInt(sh.startTime.split(':')[0]) * 60 + parseInt(sh.startTime.split(':')[1]);
        var sE = parseInt(sh.endTime.split(':')[0]) * 60 + parseInt(sh.endTime.split(':')[1]);
        if (sS <= slotS && sE >= slotE) { if (st.position === 'キッチン') kC++; else hC++; }
      }
      return { hallNeed: hallN, kitchenNeed: kitchenN, hallActual: hC, kitchenActual: kC };
    }

    // ヘルパー: 不足/オーバーの表示テキスト
    function statusText(actual, needed) {
      var diff = actual - needed;
      if (diff < 0) return '<span style="color:#C62828;font-weight:bold">' + actual + '/' + needed + ' (' + Math.abs(diff) + '名不足)</span>';
      if (diff > 0) return '<span style="color:#1565C0;font-weight:bold">' + actual + '/' + needed + ' (+' + diff + '名余剰)</span>';
      return '<span style="color:#2E7D32;font-weight:bold">' + actual + '/' + needed + ' OK</span>';
    }

    for (var d = weekStart; d <= weekEnd; d++) {
      if (d < 1 || d > daysInMonth) continue;
      var dateStr = this.yearMonth + '-' + ('0' + d).slice(-2);
      var dow = new Date(year, month - 1, d).getDay();
      // 祝日も土日扱い
      var isWeekend = (window.Holidays ? window.Holidays.isWeekendOrHoliday(dateStr) : (dow === 0 || dow === 6));
      var isHol = (window.Holidays && window.Holidays.isHoliday(dateStr));
      // 祝日も日曜と同じ赤色で表示
      var dayStyle = (dow === 0 || isHol) ? 'color:#C62828' : (dow === 6 ? 'color:#1565C0' : '');
      var dayShifts = schedByDate[dateStr] || [];

      // 日ヘッダー
      html += '<div style="margin-bottom:20px">';
      html += '<div style="padding:10px 12px;background:linear-gradient(135deg,#FAF7F2,#F0E8DC);border-radius:10px;border:1px solid #D4C5B5;margin-bottom:4px">';
      html += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
      html += '<span style="font-size:18px;font-weight:bold;' + dayStyle + '">' + month + '/' + d + '(' + dayNames[dow] + ')</span>';
      html += '<span style="font-size:13px;color:#888">' + dayShifts.length + '名配置</span>';

      // 時間帯別カード
      for (var ts = 0; ts < timeSlots.length; ts++) {
        var sc = calcSlotCounts(dayShifts, timeSlots[ts], isWeekend);
        var hasShortage = sc.hallActual < sc.hallNeed || sc.kitchenActual < sc.kitchenNeed;
        var hasSurplus = sc.hallActual > sc.hallNeed || sc.kitchenActual > sc.kitchenNeed;
        var cardBg, cardBorder;
        if (hasShortage) { cardBg = '#FFEBEE'; cardBorder = '#EF5350'; }
        else if (hasSurplus) { cardBg = '#E3F2FD'; cardBorder = '#42A5F5'; }
        else { cardBg = '#E8F5E9'; cardBorder = '#66BB6A'; }
        html += '<div style="display:inline-block;background:' + cardBg + ';border:2px solid ' + cardBorder + ';border-radius:6px;padding:4px 10px;font-size:11px">';
        html += '<b>' + esc(timeSlots[ts].label || timeSlots[ts].start) + '</b> ' + esc(timeSlots[ts].start + '-' + timeSlots[ts].end);
        if (hasShortage) html += ' <span style="color:#C62828;font-weight:bold">!不足!</span>';
        html += '<br>';
        html += 'H:' + statusText(sc.hallActual, sc.hallNeed) + ' K:' + statusText(sc.kitchenActual, sc.kitchenNeed);
        html += '</div>';
      }
      html += '</div></div>';

      // ガントチャートテーブル
      html += '<div class="gantt-container"><table class="gantt-table" style="margin-bottom:0"><tr><th class="gantt-name-col" style="font-size:9px">名前</th>';
      for (var h = startHour; h < endHour; h++) {
        html += '<th colspan="2" style="font-size:9px">' + h + '</th>';
      }
      html += '</tr>';

      // シフトをホール/キッチンに分離（既存スタッフリスト順 = 正社員→アルバイト順を尊重）
      var dayHallShifts = [];
      var dayKitchenShifts = [];
      for (var dsI = 0; dsI < dayShifts.length; dsI++) {
        var stCheck = staffMap[dayShifts[dsI].staffId];
        if (stCheck && stCheck.position === 'キッチン') {
          dayKitchenShifts.push(dayShifts[dsI]);
        } else {
          dayHallShifts.push(dayShifts[dsI]);
        }
      }
      var staffOrderMap = {};
      for (var soI = 0; soI < this.staffList.length; soI++) staffOrderMap[this.staffList[soI].id] = soI;
      function sortByStaff(arr) {
        return arr.slice().sort(function(a, b) { return (staffOrderMap[a.staffId] || 0) - (staffOrderMap[b.staffId] || 0); });
      }
      dayHallShifts = sortByStaff(dayHallShifts);
      dayKitchenShifts = sortByStaff(dayKitchenShifts);

      // 1シフト分の <tr> を生成
      function renderShiftRowLocal(shift) {
        var staff = staffMap[shift.staffId]; if (!staff) return '';
        var empBadge = staff.employmentType === '正社員' ? '<span class="emp-badge fulltime">社</span>' : '';
        var posLabel = staff.position === 'キッチン' ? '<span style="color:#1565C0;font-size:9px"> K</span>' : '<span style="color:#2E7D32;font-size:9px"> H</span>';
        var rowH = '<tr class="gantt-row"><td class="gantt-name-cell" style="font-size:10px">' + esc(staff.name) + posLabel + empBadge + '</td>';
        for (var slot2 = 0; slot2 < totalSlots; slot2++) {
          rowH += '<td class="gantt-cell">';
          var shSMin = parseInt(shift.startTime.split(':')[0]) * 60 + parseInt(shift.startTime.split(':')[1]);
          var shEMin = parseInt(shift.endTime.split(':')[0]) * 60 + parseInt(shift.endTime.split(':')[1]);
          var slMin = (startHour + Math.floor(slot2 / 2)) * 60 + (slot2 % 2) * 30;
          if (slMin === shSMin) {
            var bw = Math.round((shEMin - shSMin) / 30);
            // 休憩計算と労基法判定
            var totalH3 = (shEMin - shSMin) / 60;
            var requiredBreakW = totalH3 > 8 ? 60 : (totalH3 > 6 ? 45 : 0);
            var savedBreakW = (shift.breakMinutes != null) ? shift.breakMinutes : 0;
            var actualBreakW = Math.max(savedBreakW, requiredBreakW);
            var laborViolationW = (requiredBreakW > 0 && savedBreakW > 0 && savedBreakW < requiredBreakW);
            // バーラベル（休憩文字は黄色四角に書くので重複させない）
            var barLabelW = shift.startTime + '-' + shift.endTime;
            var barTitleW = staff.name + ' ' + shift.startTime + '-' + shift.endTime;
            if (actualBreakW > 0) barTitleW += ' / 休憩' + actualBreakW + '分' + (savedBreakW > 0 ? '' : '（自動）');
            if (laborViolationW) barTitleW += ' ⚠ 労基法違反';
            // 休憩がある場合はバーを「グレー｜透明｜グレー」のlinear-gradientで分割表現
            var barColorW = (staff.position === 'キッチン') ? '#78909C' : '#90A4AE';
            if (shift.creationMethod === '手動') {
              barColorW = (staff.position === 'キッチン') ? '#1E88E5' : '#5D6D7E';
            }
            var bgStyleW = '';
            var brkLeftPct2 = 0, brkWidthPct2 = 0;
            if (actualBreakW > 0) {
              var midM2 = (shEMin + shSMin) / 2;
              var brkS2 = midM2 - actualBreakW / 2;
              var brkE2 = midM2 + actualBreakW / 2;
              var spanMin2 = shEMin - shSMin;
              brkLeftPct2 = ((brkS2 - shSMin) / spanMin2) * 100;
              brkWidthPct2 = (actualBreakW / spanMin2) * 100;
              var brkRightPct2 = brkLeftPct2 + brkWidthPct2;
              bgStyleW = 'background:linear-gradient(to right,' + barColorW + ' 0%,' + barColorW + ' ' + brkLeftPct2 + '%,transparent ' + brkLeftPct2 + '%,transparent ' + brkRightPct2 + '%,' + barColorW + ' ' + brkRightPct2 + '%,' + barColorW + ' 100%);';
            } else {
              bgStyleW = 'background:' + barColorW + ';';
            }
            rowH += '<div class="gantt-bar' + (laborViolationW ? ' labor-violation' : '') + (actualBreakW > 0 ? ' has-break' : '') + '" data-bar-width="' + bw + '" style="width:calc(' + bw + ' * 100%);left:0;' + bgStyleW + '" onclick="AdminShiftEdit.editShift(\'' + esc(shift.id) + '\',\'' + dateStr + '\',\'' + esc(shift.staffId) + '\')" title="' + esc(barTitleW) + '">';
            rowH += '<span class="bar-handle left" onmousedown="AdminShiftEdit.startGanttDrag(event,\'' + esc(shift.id) + '\',\'left\')"></span>';
            // ラベルは左半分（休憩前）の中央に表示
            if (bw >= 3) {
              var labelLeftW = actualBreakW > 0 ? brkLeftPct2 / 2 : 50;
              rowH += '<span class="bar-label" style="left:' + labelLeftW + '%">' + esc(barLabelW) + '</span>';
            }
            // 休憩ゾーン：勤務時間の中央に黄色の四角を絶対配置
            if (actualBreakW > 0) {
              rowH += '<span class="break-zone" style="left:' + brkLeftPct2 + '%;width:' + brkWidthPct2 + '%;">' + (bw >= 6 ? '休' + actualBreakW + '分' : '休') + '</span>';
            }
            if (laborViolationW) rowH += '<span class="violation-badge" title="労基法違反">!</span>';
            rowH += '<span class="bar-handle right" onmousedown="AdminShiftEdit.startGanttDrag(event,\'' + esc(shift.id) + '\',\'right\')"></span>';
            rowH += '</div>';
          }
          rowH += '</td>';
        }
        rowH += '</tr>';
        return rowH;
      }

      // ホールセクション
      if (dayHallShifts.length > 0) {
        html += '<tr class="gantt-position-header"><td colspan="' + (totalSlots + 1) + '">ホール (' + dayHallShifts.length + '名)</td></tr>';
        for (var dsh = 0; dsh < dayHallShifts.length; dsh++) {
          html += renderShiftRowLocal(dayHallShifts[dsh]);
        }
      }
      // 区切り空行（両方ある場合のみ）
      if (dayHallShifts.length > 0 && dayKitchenShifts.length > 0) {
        html += '<tr class="gantt-position-spacer"><td colspan="' + (totalSlots + 1) + '"></td></tr>';
      }
      // キッチンセクション
      if (dayKitchenShifts.length > 0) {
        html += '<tr class="gantt-position-header"><td colspan="' + (totalSlots + 1) + '">キッチン (' + dayKitchenShifts.length + '名)</td></tr>';
        for (var dsk = 0; dsk < dayKitchenShifts.length; dsk++) {
          html += renderShiftRowLocal(dayKitchenShifts[dsk]);
        }
      }

      // 未配置スタッフ（この日にシフトなし）
      var assignedIds = {};
      for (var ai = 0; ai < dayShifts.length; ai++) assignedIds[dayShifts[ai].staffId] = true;
      var unassigned = this.staffList.filter(function(s) { return !assignedIds[s.id]; });
      if (unassigned.length > 0) {
        html += '<tr><td colspan="' + (totalSlots + 1) + '" style="padding:4px 8px;background:#FFF8E1;font-size:10px">';
        html += '<span style="color:#888">未配置: </span>';
        for (var ui = 0; ui < unassigned.length; ui++) {
          html += '<span class="day-view-chip' + (unassigned[ui].position === 'キッチン' ? ' kitchen' : '') + '" style="margin:1px;font-size:9px;padding:1px 4px" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\',\'' + esc(unassigned[ui].id) + '\')">' + esc(unassigned[ui].name) + '</span>';
        }
        html += '</td></tr>';
      }

      html += '</table></div></div>';
    }

    container.innerHTML = html;
    // 描画後にガントバーを実測pxで再配置（複数の table を同時に処理）
    setTimeout(function() { AdminShiftEdit.fixGanttBars(); }, 30);
  },

  // 不足文面を自動生成する
  generateShortageText: function() {
    App.showLoading('不足箇所を分析中...');
    API.generateShortageText(this.yearMonth).then(function(result) {
      App.hideLoading();
      if (result.success && result.text) {
        document.getElementById('ase-shortage-text').value = result.text;
        App.showModal('ase-shortage-modal');
      } else {
        App.showToast(result.message || '生成に失敗しました', 'error');
      }
    }).catch(function() { App.hideLoading(); App.showToast('生成に失敗しました', 'error'); });
  },

  // 不足文面をクリップボードにコピー
  copyShortageText: function() {
    var textEl = document.getElementById('ase-shortage-text');
    if (textEl) {
      navigator.clipboard.writeText(textEl.value).then(function() {
        App.showToast('コピーしました', 'success');
      }).catch(function() {
        textEl.select();
        document.execCommand('copy');
        App.showToast('コピーしました', 'success');
      });
    }
  },

  // シフト表をExcelファイルとして出力する
  exportExcel: function() {
    if (this.schedules.length === 0 && this.staffList.length === 0) {
      App.showToast('シフトデータがありません', 'error');
      return;
    }

    App.showLoading('Excelを作成中...');

    var self = this;
    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    var storeName = (App.storeInfo && App.storeInfo.storeName) ? App.storeInfo.storeName : 'ぎゅう丸';

    // 色の定義（Webアプリのテーマに合わせる）
    var C_BROWN_DARK = 'FF4A3323';
    var C_BROWN_MED  = 'FF8D6E63';
    var C_CREAM      = 'FFFFF8E1';
    var C_BG_LIGHT   = 'FFF5F0EB';
    var C_WHITE      = 'FFFFFFFF';
    var C_GREEN_BG   = 'FFE8F5E9';
    var C_GREEN_TXT  = 'FF2E7D32';
    var C_RED_TXT    = 'FFE53935';
    var C_BLUE_TXT   = 'FF2196F3';
    var C_ORANGE_TXT = 'FFE65100';
    var C_ORANGE_BG  = 'FFFFF3E0';
    var C_RED_BG     = 'FFFFCDD2';
    var C_RED_DARK   = 'FFC62828';
    var C_BORDER     = 'FFD7CCC8';
    var C_GRAY_LIGHT = 'FFF5F5F5';

    // 共通の罫線スタイル
    var thinBorder = {style: 'thin', color: {argb: C_BORDER}};
    var defaultBorder = {top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder};

    // 確定シフトをマップ化
    var schedMap = {};
    for (var i = 0; i < this.schedules.length; i++) {
      var s = this.schedules[i];
      if (!schedMap[s.staffId]) schedMap[s.staffId] = {};
      schedMap[s.staffId][s.date] = s;
    }

    // スタッフの月間合計時間
    var staffHoursMap = {};
    for (var sh = 0; sh < this.schedules.length; sh++) {
      var sc = this.schedules[sh];
      if (!staffHoursMap[sc.staffId]) staffHoursMap[sc.staffId] = 0;
      staffHoursMap[sc.staffId] += (sc.workHours || 0);
    }

    // ポジション別にスタッフを分ける
    var hallStaff = [];
    var kitchenStaff = [];
    for (var pi = 0; pi < this.staffList.length; pi++) {
      var pos = this.staffList[pi].position || 'ホール';
      if (pos === 'キッチン') { kitchenStaff.push(this.staffList[pi]); }
      else { hallStaff.push(this.staffList[pi]); }
    }

    // スタッフIDからポジションを引くマップ
    var staffPosMap = {};
    for (var spm = 0; spm < this.staffList.length; spm++) {
      staffPosMap[this.staffList[spm].id] = this.staffList[spm].position || 'ホール';
    }

    // 日ごとのポジション別出勤人数
    var dailyHallCount = {};
    var dailyKitchenCount = {};
    for (var dc = 1; dc <= daysInMonth; dc++) {
      var dcDate = this.yearMonth + '-' + ('0' + dc).slice(-2);
      dailyHallCount[dcDate] = 0;
      dailyKitchenCount[dcDate] = 0;
    }
    for (var j = 0; j < this.schedules.length; j++) {
      var sched = this.schedules[j];
      var schedPos = staffPosMap[sched.staffId] || 'ホール';
      if (schedPos === 'キッチン') {
        if (dailyKitchenCount[sched.date] !== undefined) dailyKitchenCount[sched.date]++;
      } else {
        if (dailyHallCount[sched.date] !== undefined) dailyHallCount[sched.date]++;
      }
    }

    // --- ExcelJSでワークブック作成 ---
    var workbook = new ExcelJS.Workbook();
    workbook.creator = 'ぎゅう丸シフト管理システム';
    var ws = workbook.addWorksheet(month + '月シフト表', {
      properties: {defaultRowHeight: 22},
      views: [{state: 'frozen', xSplit: 1, ySplit: 3}]
    });

    // 列幅を設定
    var columns = [{width: 14}]; // A列: スタッフ名
    for (var cw = 0; cw < daysInMonth; cw++) { columns.push({width: 7}); }
    columns.push({width: 9}); // 合計列
    ws.columns = columns;

    var totalCols = daysInMonth + 2; // スタッフ名 + 日数 + 合計

    // ====== 1行目: タイトル ======
    var titleRow = ws.addRow([storeName + '  ' + year + '年' + month + '月 シフト表']);
    ws.mergeCells(1, 1, 1, totalCols);
    titleRow.height = 36;
    var titleCell = ws.getCell(1, 1);
    titleCell.font = {name: 'Yu Gothic', bold: true, size: 14, color: {argb: C_BROWN_DARK}};
    titleCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_CREAM}};
    titleCell.alignment = {horizontal: 'center', vertical: 'middle'};
    titleCell.border = {bottom: {style: 'medium', color: {argb: C_BROWN_DARK}}};

    // ====== 2行目: 日付ヘッダー ======
    var dateHeaderValues = ['スタッフ'];
    for (var d = 1; d <= daysInMonth; d++) { dateHeaderValues.push(d); }
    dateHeaderValues.push('合計');
    var dateRow = ws.addRow(dateHeaderValues);
    dateRow.height = 22;

    // ====== 3行目: 曜日ヘッダー ======
    var dowValues = [''];
    for (var dw = 1; dw <= daysInMonth; dw++) {
      var dow = new Date(year, month - 1, dw).getDay();
      dowValues.push(dayNames[dow]);
    }
    dowValues.push('');
    var dowRow = ws.addRow(dowValues);
    dowRow.height = 18;

    // 2-3行目のスタイル
    for (var hc = 1; hc <= totalCols; hc++) {
      for (var hr = 2; hr <= 3; hr++) {
        var hCell = ws.getCell(hr, hc);
        hCell.font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_WHITE}};
        hCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_BROWN_DARK}};
        hCell.alignment = {horizontal: 'center', vertical: 'middle'};
        hCell.border = defaultBorder;
      }
      // 土日の色分け
      if (hc >= 2 && hc <= daysInMonth + 1) {
        var colDay = hc - 1;
        var colDow = new Date(year, month - 1, colDay).getDay();
        if (colDow === 0) {
          ws.getCell(2, hc).font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_RED_TXT}};
          ws.getCell(3, hc).font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_RED_TXT}};
        } else if (colDow === 6) {
          ws.getCell(2, hc).font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_BLUE_TXT}};
          ws.getCell(3, hc).font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_BLUE_TXT}};
        }
      }
    }

    // スタッフ行を追加する関数
    function addPositionGroup(staffGroup, groupName) {
      // グループヘッダー行
      var groupValues = [groupName + ' (' + staffGroup.length + '名)'];
      for (var g = 1; g < totalCols; g++) { groupValues.push(''); }
      var gRow = ws.addRow(groupValues);
      var gRowNum = gRow.number;
      gRow.height = 24;
      ws.mergeCells(gRowNum, 1, gRowNum, totalCols);
      var gCell = ws.getCell(gRowNum, 1);
      gCell.font = {name: 'Yu Gothic', bold: true, size: 11, color: {argb: C_WHITE}};
      gCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_BROWN_MED}};
      gCell.alignment = {vertical: 'middle'};
      gCell.border = defaultBorder;

      // 各スタッフの行
      for (var si = 0; si < staffGroup.length; si++) {
        var staff = staffGroup[si];
        var rowValues = [staff.name];
        for (var day = 1; day <= daysInMonth; day++) {
          var dateStr = parts[0] + '-' + parts[1] + '-' + ('0' + day).slice(-2);
          var shift = (schedMap[staff.id] || {})[dateStr];
          if (shift) {
            rowValues.push(shift.startTime + '\n' + shift.endTime);
          } else {
            rowValues.push('');
          }
        }
        var totalH = staffHoursMap[staff.id] || 0;
        rowValues.push(Math.round(totalH * 10) / 10);
        var sRow = ws.addRow(rowValues);
        var sRowNum = sRow.number;
        sRow.height = 28;

        // 偶数行は薄い背景色
        var isEven = (si % 2 === 1);
        var rowBg = isEven ? C_BG_LIGHT : C_WHITE;

        for (var col = 1; col <= totalCols; col++) {
          var sCell = ws.getCell(sRowNum, col);
          sCell.border = defaultBorder;
          sCell.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true};

          if (col === 1) {
            // スタッフ名
            sCell.font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_BROWN_DARK}};
            sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_GRAY_LIGHT}};
            sCell.alignment = {horizontal: 'left', vertical: 'middle'};
          } else if (col === totalCols) {
            // 合計列
            sCell.font = {name: 'Yu Gothic', bold: true, size: 9};
            sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: rowBg}};
            if (typeof sCell.value === 'number' && sCell.value > 280) {
              sCell.font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_RED_DARK}};
              sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_RED_BG}};
            } else if (typeof sCell.value === 'number' && sCell.value > 240) {
              sCell.font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_ORANGE_TXT}};
              sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_ORANGE_BG}};
            }
          } else {
            // シフトセル
            var cellVal = sCell.value;
            if (cellVal && typeof cellVal === 'string' && cellVal.indexOf(':') !== -1) {
              sCell.font = {name: 'Yu Gothic', bold: true, size: 8, color: {argb: C_GREEN_TXT}};
              sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_GREEN_BG}};
            } else {
              sCell.font = {name: 'Yu Gothic', size: 8};
              sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: rowBg}};
            }
            // 土日の列は薄い色を付ける
            var dayNum = col - 1;
            var cellDow = new Date(year, month - 1, dayNum).getDay();
            if (!cellVal && cellDow === 0) {
              sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFFF5F5'}};
            } else if (!cellVal && cellDow === 6) {
              sCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF5F9FF'}};
            }
          }
        }
      }
    }

    addPositionGroup(hallStaff, 'ホール');
    addPositionGroup(kitchenStaff, 'キッチン');

    // ====== サマリー行 ======
    var hallMinWeekday = parseInt(self.settings['平日ホール最低人数']) || 3;
    var hallMinWeekend = parseInt(self.settings['土日ホール最低人数']) || 5;
    var kitchenMinWeekday = parseInt(self.settings['平日キッチン最低人数']) || 2;
    var kitchenMinWeekend = parseInt(self.settings['土日キッチン最低人数']) || 4;

    function addSummaryRow(label, dailyCount, minWeekday, minWeekend) {
      var vals = [label];
      for (var dd = 1; dd <= daysInMonth; dd++) {
        var ddDate = self.yearMonth + '-' + ('0' + dd).slice(-2);
        vals.push(dailyCount[ddDate] || 0);
      }
      vals.push('');
      var sumRow = ws.addRow(vals);
      var sumRowNum = sumRow.number;
      sumRow.height = 22;

      for (var sc2 = 1; sc2 <= totalCols; sc2++) {
        var sumCell = ws.getCell(sumRowNum, sc2);
        sumCell.font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_BROWN_DARK}};
        sumCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_CREAM}};
        sumCell.alignment = {horizontal: 'center', vertical: 'middle'};
        sumCell.border = {
          top: {style: 'medium', color: {argb: C_BROWN_DARK}},
          bottom: thinBorder, left: thinBorder, right: thinBorder
        };
        if (sc2 === 1) { sumCell.alignment = {horizontal: 'left', vertical: 'middle'}; }
        // 人員不足を赤く
        if (sc2 >= 2 && sc2 <= daysInMonth + 1 && typeof sumCell.value === 'number') {
          var sDow = new Date(year, month - 1, sc2 - 1).getDay();
          // 祝日も土日扱い
          var sDateStr = this.yearMonth + '-' + ('0' + (sc2 - 1)).slice(-2);
          var isWknd = (window.Holidays ? window.Holidays.isWeekendOrHoliday(sDateStr) : (sDow === 0 || sDow === 6));
          var minReq = isWknd ? minWeekend : minWeekday;
          if (sumCell.value < minReq) {
            sumCell.font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_RED_DARK}};
            sumCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_RED_BG}};
          }
        }
      }
    }

    addSummaryRow('ホール出勤', dailyHallCount, hallMinWeekday, hallMinWeekend);
    addSummaryRow('キッチン出勤', dailyKitchenCount, kitchenMinWeekday, kitchenMinWeekend);

    // ====== 5-1: 週別ガントチャートシート（週ごとに1シート、シート内に各日のガントチャート） ======
    // 月内を日曜始まりで週に分割
    var weeks = [];
    var firstDow = new Date(year, month - 1, 1).getDay();
    var wkStart = 1;
    var wkEnd = Math.min(7 - firstDow, daysInMonth);
    weeks.push({ start: wkStart, end: wkEnd });
    wkStart = wkEnd + 1;
    while (wkStart <= daysInMonth) {
      var we = Math.min(wkStart + 6, daysInMonth);
      weeks.push({ start: wkStart, end: we });
      wkStart = we + 1;
    }

    var ganttDayNames = ['日','月','火','水','木','金','土'];
    var GANT_START_H = 6;
    var GANT_END_H = 24;
    var GANT_SLOTS = (GANT_END_H - GANT_START_H) * 2; // 36 個（30分単位）
    var GANT_TOTAL_COLS = 1 + GANT_SLOTS + 1;          // 名前 + 36 + 実働

    // 1日分のガントチャートを描画（startRow から開始、使った行数を返す）
    function renderDayGantt(ws, startRow, dateStr) {
      var d = new Date(dateStr);
      var dayLabel = (d.getMonth() + 1) + '/' + d.getDate() + '（' + ganttDayNames[d.getDay()] + '）';

      // この日のシフト
      var dayShifts = [];
      for (var i = 0; i < self.schedules.length; i++) {
        if (self.schedules[i].date === dateStr) dayShifts.push(self.schedules[i]);
      }
      if (dayShifts.length === 0) {
        ws.mergeCells(startRow, 1, startRow, GANT_TOTAL_COLS);
        var noShiftCell = ws.getCell(startRow, 1);
        noShiftCell.value = dayLabel + ' - シフトなし';
        noShiftCell.font = {name: 'Yu Gothic', bold: true, size: 11, color: {argb: 'FF888888'}};
        noShiftCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_GRAY_LIGHT}};
        noShiftCell.alignment = {horizontal: 'left', vertical: 'middle', indent: 1};
        return 1;
      }

      // 行1: 日付ヘッダ
      ws.mergeCells(startRow, 1, startRow, GANT_TOTAL_COLS);
      var dateCell = ws.getCell(startRow, 1);
      dateCell.value = dayLabel + '  (' + dayShifts.length + '名配置)';
      dateCell.font = {name: 'Yu Gothic', bold: true, size: 12, color: {argb: C_WHITE}};
      dateCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_BROWN_DARK}};
      dateCell.alignment = {horizontal: 'left', vertical: 'middle', indent: 1};
      ws.getRow(startRow).height = 22;

      // 行2: 時間ヘッダ（1時間ごとに2列マージ）
      var hourRow = ws.getRow(startRow + 1);
      hourRow.getCell(1).value = '名前';
      for (var hh = GANT_START_H; hh < GANT_END_H; hh++) {
        var colIdx = 2 + (hh - GANT_START_H) * 2;
        ws.mergeCells(startRow + 1, colIdx, startRow + 1, colIdx + 1);
        hourRow.getCell(colIdx).value = hh;
      }
      hourRow.getCell(GANT_TOTAL_COLS).value = '実働';
      for (var hci = 1; hci <= GANT_TOTAL_COLS; hci++) {
        var hcCell = hourRow.getCell(hci);
        hcCell.font = {name: 'Yu Gothic', bold: true, size: 9, color: {argb: C_WHITE}};
        hcCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_BROWN_MED}};
        hcCell.alignment = {horizontal: 'left', vertical: 'middle', indent: 1};
        hcCell.border = defaultBorder;
      }
      hourRow.height = 18;

      // この日のシフトを「ホール→キッチン」の順に並べる
      var schX = {};
      for (var di = 0; di < dayShifts.length; di++) schX[dayShifts[di].staffId] = dayShifts[di];
      var orderedStaff = hallStaff.concat(kitchenStaff);
      var todayStaff = orderedStaff.filter(function(s) { return schX[s.id]; });

      var rowI = startRow + 2;
      for (var sI = 0; sI < todayStaff.length; sI++) {
        var st = todayStaff[sI];
        var sh = schX[st.id];
        var startMinX = parseInt(sh.startTime.split(':')[0]) * 60 + parseInt(sh.startTime.split(':')[1]);
        var endMinX = parseInt(sh.endTime.split(':')[0]) * 60 + parseInt(sh.endTime.split(':')[1]);
        var totalH = (endMinX - startMinX) / 60;
        var brkMin = (sh.breakMinutes != null && sh.breakMinutes > 0) ? sh.breakMinutes : (totalH > 8 ? 60 : (totalH > 6 ? 45 : 0));
        // 休憩位置（勤務時間の中央に配置）
        var midMin = (startMinX + endMinX) / 2;
        var brkStartMin = brkMin > 0 ? midMin - brkMin / 2 : -1;
        var brkEndMin = brkMin > 0 ? midMin + brkMin / 2 : -1;

        var rowR = ws.getRow(rowI);
        var posLabel = (st.position === 'キッチン') ? 'K' : 'H';
        rowR.getCell(1).value = st.name + ' [' + posLabel + ']';
        rowR.getCell(1).font = {name: 'Yu Gothic', bold: true, size: 10};
        rowR.getCell(1).alignment = {horizontal: 'left', vertical: 'middle', indent: 1};
        rowR.getCell(1).border = defaultBorder;
        rowR.getCell(1).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_GRAY_LIGHT}};

        // 時間スロットの色塗り
        var workColor = (st.position === 'キッチン') ? 'FF1E88E5' : 'FF8D6E63';
        var breakColor = 'FFFFE082'; // 休憩は薄めの黄色（Webアプリと統一）
        var breakLabelShown = false;
        for (var slotJ = 0; slotJ < GANT_SLOTS; slotJ++) {
          var slotS = (GANT_START_H + Math.floor(slotJ / 2)) * 60 + (slotJ % 2) * 30;
          var slotE = slotS + 30;
          var cellR = rowR.getCell(2 + slotJ);
          cellR.border = defaultBorder;
          if (slotS >= startMinX && slotE <= endMinX) {
            if (brkMin > 0 && slotS >= brkStartMin && slotE <= brkEndMin) {
              cellR.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: breakColor}};
              // 休憩開始セルに「休XX分」と表示する（白いラベルだと埋もれるので濃茶で）
              if (!breakLabelShown) {
                cellR.value = '休' + brkMin + '分';
                cellR.font = {name: 'Yu Gothic', bold: true, size: 8, color: {argb: 'FF5D4037'}};
                cellR.alignment = {horizontal: 'left', vertical: 'middle', indent: 1};
                breakLabelShown = true;
              }
            } else {
              cellR.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: workColor}};
            }
          }
        }

        // 開始セルにシフト時刻ラベルを上書き表示
        var startSlotIdx = Math.floor((startMinX - GANT_START_H * 60) / 30);
        if (startSlotIdx >= 0 && startSlotIdx < GANT_SLOTS) {
          var labelCell = rowR.getCell(2 + startSlotIdx);
          labelCell.value = sh.startTime + '-' + sh.endTime + (brkMin > 0 ? ' (休' + brkMin + ')' : '');
          labelCell.font = {name: 'Yu Gothic', bold: true, size: 8, color: {argb: C_WHITE}};
          labelCell.alignment = {horizontal: 'left', vertical: 'middle', indent: 1};
        }

        // 実働時間（休憩を引いた時間）
        var actualH = (endMinX - startMinX - brkMin) / 60;
        var totalCell = rowR.getCell(GANT_TOTAL_COLS);
        totalCell.value = Math.round(actualH * 10) / 10;
        totalCell.numFmt = '0.0"h"';
        totalCell.font = {name: 'Yu Gothic', bold: true, size: 10, color: {argb: C_BROWN_DARK}};
        totalCell.alignment = {horizontal: 'right', vertical: 'middle'};
        totalCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_CREAM}};
        totalCell.border = defaultBorder;
        rowR.height = 20;
        rowI++;
      }
      return rowI - startRow;
    }

    // 週ごとにシート作成
    for (var wIdx2 = 0; wIdx2 < weeks.length; wIdx2++) {
      var wEntry = weeks[wIdx2];
      var ganttWs = workbook.addWorksheet('第' + (wIdx2 + 1) + '週ガント', { properties: { defaultRowHeight: 18 } });

      // 列幅
      var ganttCols = [{ width: 14 }];
      for (var gci = 0; gci < GANT_SLOTS; gci++) ganttCols.push({ width: 2.6 });
      ganttCols.push({ width: 8 });
      ganttWs.columns = ganttCols;

      // 1列目を凍結
      ganttWs.views = [{ state: 'frozen', xSplit: 1, ySplit: 0 }];

      var rowCursor = 1;
      // 週タイトル
      ganttWs.mergeCells(rowCursor, 1, rowCursor, GANT_TOTAL_COLS);
      var weekTitle = ganttWs.getCell(rowCursor, 1);
      weekTitle.value = '第' + (wIdx2 + 1) + '週: ' + month + '/' + wEntry.start + '〜' + month + '/' + wEntry.end + '  ' + storeName;
      weekTitle.font = {name: 'Yu Gothic', bold: true, size: 14, color: {argb: C_WHITE}};
      weekTitle.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: C_BROWN_DARK}};
      weekTitle.alignment = {horizontal: 'center', vertical: 'middle'};
      ganttWs.getRow(rowCursor).height = 30;
      rowCursor += 2;

      // 各日のガントチャート
      for (var dayN = wEntry.start; dayN <= wEntry.end; dayN++) {
        var dStr = self.yearMonth + '-' + ('0' + dayN).slice(-2);
        var rowsUsed = renderDayGantt(ganttWs, rowCursor, dStr);
        rowCursor += rowsUsed + 1; // 1行スペース
      }
    }

    // ====== ダウンロード ======
    var fileName = year + '年' + month + '月_' + storeName + '_シフト表.xlsx';
    workbook.xlsx.writeBuffer().then(function(buffer) {
      var blob = new Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.hideLoading();
      App.showToast('Excelファイルをダウンロードしました', 'success');
    }).catch(function(err) {
      App.hideLoading();
      console.error('Excel出力エラー:', err);
      App.showToast('Excel出力に失敗しました', 'error');
    });
  }
};

function onShow_admin_shift_edit() { AdminShiftEdit.init(); }

// ========================================
// スタッフ管理（管理者）
// ========================================
var StaffManage = {
  staffList: [],

  init: function() { this.load(); },

  load: function() {
    var self = this; App.showLoading('スタッフ情報を読み込み中...');
    API.getAllStaff().then(function(staff) { App.hideLoading(); self.staffList = staff; self.renderList(); })
    .catch(function() { App.hideLoading(); App.showToast('読み込みに失敗しました', 'error'); });
  },

  renderList: function() {
    var container = document.getElementById('staff-manage-list');
    if (this.staffList.length === 0) { container.innerHTML = '<div class="alert alert-info">スタッフが登録されていません。「+ 新規追加」ボタンから追加してください。</div>'; return; }
    var html = '<div class="table-wrapper"><table class="data-table"><tr><th>氏名</th><th>ポジション/区分</th><th>時給/月給</th><th>操作</th></tr>';
    for (var i = 0; i < this.staffList.length; i++) {
      var s = this.staffList[i];
      var pos = s.position || 'ホール';
      var payInfo = s.employmentType === '正社員' ? App.formatCurrency(s.monthlySalary) + '円/月' : App.formatCurrency(s.hourlyRate) + '円/時';
      html += '<tr><td class="text-bold">' + esc(s.name) + ' <span class="text-sm text-muted">[' + esc(pos) + '/' + esc(s.employmentType) + ']</span></td><td><span class="badge badge-confirmed">' + esc(pos) + '</span> <span class="badge badge-draft">' + esc(s.employmentType) + '</span></td><td>' + esc(payInfo) + '</td>';
      html += '<td><button class="btn btn-outline btn-sm" onclick="StaffManage.edit(\'' + esc(s.id) + '\')" style="margin-right:4px">編集</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="StaffManage.setPin(\'' + esc(s.id) + '\', \'' + esc(s.name) + '\')" style="margin-right:4px">PIN発行</button>';
      html += '<button class="btn btn-danger btn-sm" onclick="StaffManage.retire(\'' + esc(s.id) + '\', \'' + esc(s.name) + '\')">退職</button></td></tr>';
    }
    html += '</table></div>';
    container.innerHTML = html;
  },

  showAddModal: function() {
    document.getElementById('staff-modal-title').textContent = 'スタッフ新規追加';
    document.getElementById('sm-editing-id').value = '';
    ['sm-name', 'sm-kana', 'sm-hourly-rate', 'sm-monthly-salary', 'sm-transport', 'sm-phone', 'sm-email', 'sm-fixed-off', 'sm-memo'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('sm-employment-type').value = 'アルバイト';
    document.getElementById('sm-position').value = 'ホール';
    document.getElementById('sm-weekly-limit').value = '40';
    App.showModal('staff-modal');
  },

  edit: function(staffId) {
    var staff = null;
    for (var i = 0; i < this.staffList.length; i++) { if (this.staffList[i].id === staffId) { staff = this.staffList[i]; break; } }
    if (!staff) return;
    document.getElementById('staff-modal-title').textContent = staff.name + ' - 編集';
    document.getElementById('sm-editing-id').value = staffId;
    document.getElementById('sm-name').value = staff.name || '';
    document.getElementById('sm-kana').value = staff.kana || '';
    document.getElementById('sm-employment-type').value = staff.employmentType || 'アルバイト';
    document.getElementById('sm-position').value = staff.position || 'ホール';
    document.getElementById('sm-hourly-rate').value = staff.hourlyRate || '';
    document.getElementById('sm-monthly-salary').value = staff.monthlySalary || '';
    document.getElementById('sm-transport').value = staff.transportDaily || '';
    document.getElementById('sm-phone').value = staff.phone || '';
    document.getElementById('sm-email').value = staff.email || '';
    document.getElementById('sm-weekly-limit').value = staff.weeklyLimit || 40;
    document.getElementById('sm-fixed-off').value = staff.fixedOff || '';
    document.getElementById('sm-memo').value = staff.memo || '';
    App.showModal('staff-modal');
  },

  save: function() {
    var name = document.getElementById('sm-name').value.trim();
    if (!name) { App.showToast('氏名を入力してください', 'error'); return; }
    var data = {
      name: name, kana: document.getElementById('sm-kana').value.trim(),
      employmentType: document.getElementById('sm-employment-type').value,
      position: document.getElementById('sm-position').value,
      hourlyRate: parseInt(document.getElementById('sm-hourly-rate').value) || 0,
      monthlySalary: parseInt(document.getElementById('sm-monthly-salary').value) || 0,
      transportDaily: parseInt(document.getElementById('sm-transport').value) || 0,
      phone: document.getElementById('sm-phone').value.trim(),
      email: document.getElementById('sm-email').value.trim(),
      weeklyLimit: parseInt(document.getElementById('sm-weekly-limit').value) || 40,
      fixedOff: document.getElementById('sm-fixed-off').value.trim(),
      memo: document.getElementById('sm-memo').value.trim()
    };
    var editingId = document.getElementById('sm-editing-id').value;
    var self = this; App.showLoading('保存中...');
    var promise = editingId ? API.updateStaff(editingId, data) : API.addStaff(data);
    promise.then(function(result) {
      App.hideLoading(); App.hideModal('staff-modal');
      if (result.success) { App.showToast(result.message, 'success'); self.load(); } else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('保存に失敗しました', 'error'); });
  },

  // 店長がスタッフのPINを直接発行する（新機能）
  setPin: function(staffId, staffName) {
    var pin = window.prompt(
      staffName + 'さんに発行する4桁のPINを入力してください。\n\n' +
      '・必ず4桁の数字にしてください\n' +
      '・このPINをスタッフに口頭で伝えてください\n' +
      '・簡単すぎる数字（0000, 1234など）は避けてください'
    );
    if (!pin) return;
    if (!/^\d{4}$/.test(pin)) {
      App.showToast('4桁の数字で入力してください', 'error');
      return;
    }
    var adminPassword = window.prompt('操作確認のため管理者パスワードを入力してください：');
    if (!adminPassword) return;

    App.showLoading('PINを発行中...');
    API.setStaffPin(staffId, pin, adminPassword).then(function(result) {
      App.hideLoading();
      if (result.success) {
        App.showToast(staffName + 'さんのPINを [' + pin + '] に設定しました', 'success');
      } else {
        App.showToast(result.message || 'PIN発行に失敗しました', 'error');
      }
    }).catch(function() {
      App.hideLoading();
      App.showToast('PIN発行に失敗しました', 'error');
    });
  },

  retire: function(staffId, staffName) {
    // 新機能3: 誤操作防止のため管理者パスワードと理由を入力させる
    var self = this;
    var warn = staffName + 'さんを退職処理します。\n\n' +
               '・シフト表やスタッフ選択画面に表示されなくなります\n' +
               '・過去のデータ（シフト希望・人件費履歴）は保持されます\n' +
               '・元に戻すには管理者による再登録が必要です\n\n' +
               '続行するには管理者パスワードの入力が必要です。';
    if (!App.confirm(warn)) return;

    var adminPassword = window.prompt('管理者パスワードを入力してください：');
    if (!adminPassword) return;
    var reason = window.prompt('退職理由（任意・記録用）：', '') || '';

    App.showLoading('退職処理中...');
    API.retireStaff(staffId, adminPassword, reason).then(function(result) {
      App.hideLoading();
      if (result.success) {
        App.showToast(result.message, 'success');
        self.load();
      } else {
        App.showToast(result.message || '退職処理に失敗しました', 'error');
      }
    }).catch(function() {
      App.hideLoading();
      App.showToast('退職処理に失敗しました', 'error');
    });
  }
};

function onShow_admin_staff_manage() { StaffManage.init(); }

// ========================================
// 人件費確認（管理者）
// ========================================
var LaborCost = {
  yearMonth: '',

  init: function() {
    this.yearMonth = getCurrentMonthStr(); var self = this;
    Calendar.renderHeader('alc-month-header', this.yearMonth, function(newYM) { self.yearMonth = newYM; self.loadExisting(); });
    this.loadExisting();
  },

  loadExisting: function() {
    var self = this; App.showLoading('読み込み中...');
    Calendar.renderHeader('alc-month-header', this.yearMonth, function(newYM) { self.yearMonth = newYM; self.loadExisting(); });
    API.getLaborCostReport(this.yearMonth).then(function(report) {
      App.hideLoading();
      if (report.staffCosts.length > 0) { self.renderReport(report); }
      else {
        document.getElementById('alc-summary').classList.add('hidden');
        document.getElementById('alc-table').innerHTML = '<div class="alert alert-info">この月の人件費データはまだありません。「計算実行」ボタンで計算してください。</div>';
      }
    }).catch(function() { App.hideLoading(); App.showToast('読み込みに失敗しました', 'error'); });
  },

  calculate: function() {
    App.showLoading('人件費を計算中...'); var self = this;
    API.calculateLaborCost(this.yearMonth).then(function(result) {
      App.hideLoading();
      if (result.success) { App.showToast(result.message, 'success'); self.renderReport(result); } else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('計算に失敗しました', 'error'); });
  },

  renderReport: function(report) {
    document.getElementById('alc-summary').classList.remove('hidden');
    document.getElementById('alc-total-cost').textContent = App.formatCurrency(report.totalCost) + '円';
    document.getElementById('alc-staff-count').textContent = report.staffCosts.length + '人';
    var costs = report.staffCosts;
    var html = '<div class="table-wrapper"><table class="data-table"><tr><th>スタッフ</th><th>区分</th><th>労働時間</th><th>基本給</th><th>深夜手当</th><th>残業手当</th><th>手当<br><span style="font-weight:normal;font-size:10px">(ピーク+土日祝)</span></th><th>交通費</th><th>合計</th></tr>';
    var totalHours = 0, totalBase = 0, totalLate = 0, totalOT = 0, totalBonus = 0, totalTrans = 0;
    for (var i = 0; i < costs.length; i++) {
      var c = costs[i];
      var bonusSum = (c.peakBonusPay || 0) + (c.weekendBonusPay || 0);
      var bonusTitle = 'ピーク手当: ' + App.formatCurrency(c.peakBonusPay || 0) + '円 / 土日祝手当: ' + App.formatCurrency(c.weekendBonusPay || 0) + '円';
      html += '<tr><td class="text-bold">' + esc(c.name) + '</td><td>' + esc(c.employmentType) + '</td><td class="text-right">' + App.formatHours(c.totalHours) + 'h</td><td class="text-right">' + App.formatCurrency(c.basePay) + '</td><td class="text-right">' + App.formatCurrency(c.lateNightPay) + '</td><td class="text-right">' + App.formatCurrency(c.overtimePay) + '</td><td class="text-right" title="' + esc(bonusTitle) + '">' + App.formatCurrency(bonusSum) + '</td><td class="text-right">' + App.formatCurrency(c.transportTotal) + '</td><td class="text-right text-bold">' + App.formatCurrency(c.totalCost) + '</td></tr>';
      totalHours += c.totalHours || 0; totalBase += c.basePay || 0; totalLate += c.lateNightPay || 0; totalOT += c.overtimePay || 0; totalBonus += bonusSum; totalTrans += c.transportTotal || 0;
    }
    html += '<tr style="background-color:#F0E8DC;font-weight:bold"><td colspan="2">合計</td><td class="text-right">' + App.formatHours(totalHours) + 'h</td><td class="text-right">' + App.formatCurrency(totalBase) + '</td><td class="text-right">' + App.formatCurrency(totalLate) + '</td><td class="text-right">' + App.formatCurrency(totalOT) + '</td><td class="text-right">' + App.formatCurrency(totalBonus) + '</td><td class="text-right">' + App.formatCurrency(totalTrans) + '</td><td class="text-right text-accent">' + App.formatCurrency(report.totalCost) + '</td></tr>';
    html += '</table></div>';
    document.getElementById('alc-table').innerHTML = html;
  }
};

function onShow_admin_labor_cost() { LaborCost.init(); }

// ========================================
// 店舗設定（管理者）
// ========================================

var StoreSettings = {
  settings: {},
  timeSlotStaffing: [],
  // 1-1: ピーク手当（時間帯別追加時給）。店舗ごとに保存
  peakHourBonuses: [],

  init: function() {
    var self = this;
    this.populateTimeSelects();
    App.showLoading('設定を読み込み中...');
    API.getStoreSettings().then(function(settings) {
      App.hideLoading();
      self.settings = settings || {};
      // 時間帯別人数のJSON読み込み
      try {
        self.timeSlotStaffing = JSON.parse(settings['時間帯別必要人数'] || '[]');
      } catch(e) { self.timeSlotStaffing = []; }
      // デフォルトがなければ初期値を設定
      if (self.timeSlotStaffing.length === 0) {
        self.timeSlotStaffing = [
          { start: '10:00', end: '14:00', weekdayHall: 5, weekdayKitchen: 3, weekendHall: 7, weekendKitchen: 4, label: 'ランチ' },
          { start: '14:00', end: '17:00', weekdayHall: 2, weekdayKitchen: 1, weekendHall: 3, weekendKitchen: 2, label: '休憩帯' },
          { start: '17:00', end: '22:00', weekdayHall: 5, weekdayKitchen: 3, weekendHall: 7, weekendKitchen: 4, label: 'ディナー' }
        ];
      }
      // 1-1 ピーク手当の読み込み
      try {
        self.peakHourBonuses = JSON.parse(settings['ピーク手当設定'] || '[]');
      } catch(e) { self.peakHourBonuses = []; }
      self.render();
    }).catch(function() {
      App.hideLoading();
      App.showToast('設定の読み込みに失敗しました', 'error');
    });
  },

  populateTimeSelects: function() {
    var wait = function() {
      if (!App.timeSlots) { setTimeout(wait, 100); return; }
      var selects = ['set-open-time', 'set-close-time'];
      for (var s = 0; s < selects.length; s++) {
        var el = document.getElementById(selects[s]);
        if (!el) continue;
        el.innerHTML = '';
        for (var i = 0; i < App.timeSlots.length; i++) {
          var opt = document.createElement('option');
          opt.value = App.timeSlots[i];
          opt.textContent = App.timeSlots[i];
          el.appendChild(opt);
        }
      }
    };
    wait();
  },

  render: function() {
    var s = this.settings;
    // 必要人数
    document.getElementById('set-weekday-hall').value = s['平日ホール最低人数'] || '3';
    document.getElementById('set-weekday-kitchen').value = s['平日キッチン最低人数'] || '2';
    document.getElementById('set-weekend-hall').value = s['土日ホール最低人数'] || '5';
    document.getElementById('set-weekend-kitchen').value = s['土日キッチン最低人数'] || '4';
    // 営業時間
    var openEl = document.getElementById('set-open-time');
    var closeEl = document.getElementById('set-close-time');
    if (openEl) openEl.value = s['営業開始'] || '11:00';
    if (closeEl) closeEl.value = s['営業終了'] || '23:00';
    // 締切日
    document.getElementById('set-deadline-day').value = s['希望提出締切日'] || '20';
    // 1-2 曜日手当（平日・土日祝の時給加算）
    var wbEl = document.getElementById('set-weekday-bonus');
    var hbEl = document.getElementById('set-weekend-bonus');
    if (wbEl) wbEl.value = s['平日時給加算'] || '0';
    if (hbEl) hbEl.value = s['土日祝時給加算'] || '0';
    // 時間帯別人数
    this.renderTimeSlots();
    // 1-1 ピーク手当
    this.renderPeakBonuses();
  },

  renderTimeSlots: function() {
    var container = document.getElementById('time-slot-staffing-container');
    if (!container) return;
    var html = '';
    for (var i = 0; i < this.timeSlotStaffing.length; i++) {
      var slot = this.timeSlotStaffing[i];
      html += '<div class="time-slot-row" style="border:1px solid #D7CCC8;border-radius:8px;padding:12px;margin-bottom:8px;background:#FAFAFA">';
      html += '<div class="flex gap-8 mb-8" style="align-items:center">';
      html += '<input type="text" class="form-input" style="width:80px;font-size:13px" value="' + esc(slot.label || '') + '" data-slot="' + i + '" data-field="label" placeholder="名前" onchange="StoreSettings.updateSlot(this)">';
      html += '<select class="form-select" style="width:80px;font-size:13px" data-slot="' + i + '" data-field="start" onchange="StoreSettings.updateSlot(this)">';
      html += StoreSettings.timeOptions(slot.start);
      html += '</select>';
      html += '<span>~</span>';
      html += '<select class="form-select" style="width:80px;font-size:13px" data-slot="' + i + '" data-field="end" onchange="StoreSettings.updateSlot(this)">';
      html += StoreSettings.timeOptions(slot.end);
      html += '</select>';
      html += '<button class="btn btn-outline btn-sm" style="color:#C62828;border-color:#C62828;padding:2px 8px;font-size:11px" onclick="StoreSettings.removeTimeSlot(' + i + ')">削除</button>';
      html += '</div>';
      html += '<div class="flex gap-8" style="flex-wrap:wrap">';
      html += '<div style="font-size:11px;color:#888;width:100%">平日</div>';
      html += '<div class="form-group" style="flex:1;margin:0"><label class="form-label" style="font-size:11px">ホール</label><input type="number" class="form-input" style="font-size:13px" min="0" max="30" value="' + (slot.weekdayHall || 0) + '" data-slot="' + i + '" data-field="weekdayHall" onchange="StoreSettings.updateSlot(this)"></div>';
      html += '<div class="form-group" style="flex:1;margin:0"><label class="form-label" style="font-size:11px">キッチン</label><input type="number" class="form-input" style="font-size:13px" min="0" max="30" value="' + (slot.weekdayKitchen || 0) + '" data-slot="' + i + '" data-field="weekdayKitchen" onchange="StoreSettings.updateSlot(this)"></div>';
      html += '<div style="font-size:11px;color:#888;width:100%;margin-top:4px">土日</div>';
      html += '<div class="form-group" style="flex:1;margin:0"><label class="form-label" style="font-size:11px">ホール</label><input type="number" class="form-input" style="font-size:13px" min="0" max="30" value="' + (slot.weekendHall || 0) + '" data-slot="' + i + '" data-field="weekendHall" onchange="StoreSettings.updateSlot(this)"></div>';
      html += '<div class="form-group" style="flex:1;margin:0"><label class="form-label" style="font-size:11px">キッチン</label><input type="number" class="form-input" style="font-size:13px" min="0" max="30" value="' + (slot.weekendKitchen || 0) + '" data-slot="' + i + '" data-field="weekendKitchen" onchange="StoreSettings.updateSlot(this)"></div>';
      html += '</div></div>';
    }
    container.innerHTML = html;
  },

  timeOptions: function(selected) {
    var html = '';
    if (!App.timeSlots) return html;
    for (var i = 0; i < App.timeSlots.length; i++) {
      var sel = App.timeSlots[i] === selected ? ' selected' : '';
      html += '<option value="' + App.timeSlots[i] + '"' + sel + '>' + App.timeSlots[i] + '</option>';
    }
    return html;
  },

  updateSlot: function(el) {
    var idx = parseInt(el.getAttribute('data-slot'));
    var field = el.getAttribute('data-field');
    var val = el.value;
    if (['weekdayHall','weekdayKitchen','weekendHall','weekendKitchen'].indexOf(field) >= 0) {
      val = parseInt(val) || 0;
    }
    this.timeSlotStaffing[idx][field] = val;
  },

  addTimeSlot: function() {
    this.timeSlotStaffing.push({ start: '11:00', end: '15:00', weekdayHall: 3, weekdayKitchen: 2, weekendHall: 5, weekendKitchen: 3, label: '' });
    this.renderTimeSlots();
  },

  removeTimeSlot: function(idx) {
    this.timeSlotStaffing.splice(idx, 1);
    this.renderTimeSlots();
  },

  // 1-1 ピーク手当の描画
  renderPeakBonuses: function() {
    var container = document.getElementById('peak-bonus-container');
    if (!container) return;
    if (this.peakHourBonuses.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm" style="margin:8px 0">ピーク手当は設定されていません。「+ ピーク手当を追加」から登録してください。</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < this.peakHourBonuses.length; i++) {
      var pb = this.peakHourBonuses[i];
      html += '<div class="time-slot-row" style="border:1px solid #D7CCC8;border-radius:8px;padding:12px;margin-bottom:8px;background:#FFF8E1">';
      html += '<div class="flex gap-8" style="align-items:center;flex-wrap:wrap">';
      html += '<input type="text" class="form-input" style="width:90px;font-size:13px" value="' + esc(pb.label || '') + '" data-pb="' + i + '" data-field="label" placeholder="名前" onchange="StoreSettings.updatePeakBonus(this)">';
      html += '<select class="form-select" style="width:80px;font-size:13px" data-pb="' + i + '" data-field="start" onchange="StoreSettings.updatePeakBonus(this)">';
      html += StoreSettings.timeOptions(pb.start);
      html += '</select>';
      html += '<span>~</span>';
      html += '<select class="form-select" style="width:80px;font-size:13px" data-pb="' + i + '" data-field="end" onchange="StoreSettings.updatePeakBonus(this)">';
      html += StoreSettings.timeOptions(pb.end);
      html += '</select>';
      html += '<span style="font-size:12px">+</span>';
      html += '<input type="number" class="form-input" style="width:80px;font-size:13px" value="' + (pb.bonus || 0) + '" min="0" max="2000" data-pb="' + i + '" data-field="bonus" onchange="StoreSettings.updatePeakBonus(this)">';
      html += '<span class="text-muted text-sm">円/時</span>';
      html += '<button class="btn btn-outline btn-sm" style="color:#C62828;border-color:#C62828;padding:2px 8px;font-size:11px" onclick="StoreSettings.removePeakBonus(' + i + ')">削除</button>';
      html += '</div></div>';
    }
    container.innerHTML = html;
  },

  updatePeakBonus: function(el) {
    var idx = parseInt(el.getAttribute('data-pb'));
    var field = el.getAttribute('data-field');
    var val = el.value;
    if (field === 'bonus') val = parseInt(val) || 0;
    this.peakHourBonuses[idx][field] = val;
  },

  addPeakBonus: function() {
    this.peakHourBonuses.push({ start: '12:00', end: '14:00', bonus: 200, label: 'ランチ' });
    this.renderPeakBonuses();
  },

  removePeakBonus: function(idx) {
    this.peakHourBonuses.splice(idx, 1);
    this.renderPeakBonuses();
  },

  save: function() {
    // ピーク手当の整合性チェック（開始 < 終了 / 同日内）
    for (var i = 0; i < this.peakHourBonuses.length; i++) {
      var pb = this.peakHourBonuses[i];
      if (pb.start >= pb.end) {
        App.showToast('ピーク手当 ' + (pb.label || (i + 1) + '番目') + ' の時間帯が不正です（開始 >= 終了）', 'error');
        return;
      }
    }
    var newSettings = {
      '平日ホール最低人数': document.getElementById('set-weekday-hall').value,
      '平日キッチン最低人数': document.getElementById('set-weekday-kitchen').value,
      '土日ホール最低人数': document.getElementById('set-weekend-hall').value,
      '土日キッチン最低人数': document.getElementById('set-weekend-kitchen').value,
      '営業開始': document.getElementById('set-open-time').value,
      '営業終了': document.getElementById('set-close-time').value,
      '希望提出締切日': document.getElementById('set-deadline-day').value,
      '時間帯別必要人数': JSON.stringify(this.timeSlotStaffing),
      '平日時給加算': document.getElementById('set-weekday-bonus').value || '0',
      '土日祝時給加算': document.getElementById('set-weekend-bonus').value || '0',
      'ピーク手当設定': JSON.stringify(this.peakHourBonuses)
    };

    App.showLoading('設定を保存中...');
    API.updateStoreSettings(newSettings).then(function(result) {
      App.hideLoading();
      if (result.success) {
        App.showToast('設定を保存しました', 'success');
      } else {
        App.showToast(result.message || '保存に失敗しました', 'error');
      }
    }).catch(function() {
      App.hideLoading();
      App.showToast('保存に失敗しました', 'error');
    });
  }
};

function onShow_admin_store_settings() { StoreSettings.init(); }

// ========================================
// 5-3 給与明細 - スタッフ用（自分の明細閲覧）
// ========================================
var StaffPayslip = {
  months: [],
  init: function() {
    var self = this;
    var container = document.getElementById('staff-payslip-month-list');
    if (container) container.innerHTML = '読み込み中...';
    API.listMyPayslipMonths().then(function(result) {
      if (result && result.success) {
        self.months = result.months || [];
        self.render();
      } else {
        if (container) container.innerHTML = '<p class="text-muted">' + esc((result && result.message) || '読み込み失敗') + '</p>';
      }
    }).catch(function() {
      if (container) container.innerHTML = '<p class="text-muted">読み込みに失敗しました</p>';
    });
  },
  render: function() {
    var container = document.getElementById('staff-payslip-month-list');
    if (!container) return;
    if (this.months.length === 0) {
      container.innerHTML = '<p class="text-muted">給与明細はまだ登録されていません。店長に確認してください。</p>';
      return;
    }
    var html = '<div class="menu-grid">';
    for (var i = 0; i < this.months.length; i++) {
      var m = this.months[i];
      var p = m.split('-');
      var label = p[0] + '年' + parseInt(p[1]) + '月';
      html += '<div class="card clickable menu-card" onclick="StaffPayslip.viewDetail(\'' + esc(m) + '\')">';
      html += '<div class="card-icon">&#128196;</div>';
      html += '<div class="card-title">' + esc(label) + '</div>';
      html += '<div class="card-subtitle">給与明細を見る</div>';
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  },
  viewDetail: function(yearMonth) {
    App.showScreen('staff-payslip-detail', { yearMonth: yearMonth });
  },
  loadDetail: function(yearMonth) {
    var titleEl = document.getElementById('staff-payslip-detail-title');
    var bodyEl = document.getElementById('staff-payslip-detail-body');
    var p = yearMonth.split('-');
    if (titleEl) titleEl.textContent = p[0] + '年' + parseInt(p[1]) + '月の給与明細';
    if (bodyEl) bodyEl.innerHTML = '読み込み中...';
    API.getMyPayslip(yearMonth).then(function(result) {
      if (!result.success) {
        bodyEl.innerHTML = '<p class="text-muted">' + esc(result.message || '取得失敗') + '</p>';
        return;
      }
      var slip = result.payslip;
      var html = '<div class="table-wrapper"><table class="data-table"><tr><th>項目</th><th class="text-right">内容</th></tr>';
      var keys = Object.keys(slip.data || {});
      for (var i = 0; i < keys.length; i++) {
        var v = slip.data[keys[i]];
        html += '<tr><td class="text-bold">' + esc(keys[i]) + '</td><td class="text-right">' + esc(String(v == null ? '' : v)) + '</td></tr>';
      }
      html += '</table></div>';
      bodyEl.innerHTML = html;
    }).catch(function() {
      bodyEl.innerHTML = '<p class="text-muted">取得に失敗しました</p>';
    });
  }
};
function onShow_staff_payslip_list() { StaffPayslip.init(); }
function onShow_staff_payslip_detail(params) {
  if (params && params.yearMonth) StaffPayslip.loadDetail(params.yearMonth);
}

// ========================================
// 5-3 給与明細 - 管理者用（CSV取込・閲覧）
// ========================================
var AdminPayslip = {
  init: function() {
    var now = new Date();
    var ym = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
    var t = document.getElementById('payslip-target-month');
    var v = document.getElementById('payslip-view-month');
    if (t && !t.value) t.value = ym;
    if (v && !v.value) v.value = ym;
    this.loadList();
  },
  loadFile: function(input) {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('payslip-csv-text').value = e.target.result;
    };
    reader.readAsText(input.files[0]);
  },
  upload: function() {
    var ym = document.getElementById('payslip-target-month').value;
    var csv = document.getElementById('payslip-csv-text').value;
    if (!ym) { App.showToast('対象月を入力してください', 'error'); return; }
    if (!csv || csv.trim() === '') { App.showToast('CSVを入力してください', 'error'); return; }
    App.showLoading('取込中...'); var self = this;
    API.uploadPayslipCsv(ym, csv).then(function(result) {
      App.hideLoading();
      if (result.success) {
        App.showToast(result.message || '取込しました', 'success');
        if (result.unmatched && result.unmatched.length > 0) {
          alert('一部の氏名が一致せずスキップされました:\n\n' + result.unmatched.join('\n') + '\n\n氏名の表記がスタッフ管理と完全一致しているか確認してください。');
        }
        document.getElementById('payslip-view-month').value = ym;
        self.loadList();
      } else {
        App.showToast(result.message || '取込失敗', 'error');
      }
    }).catch(function() {
      App.hideLoading();
      App.showToast('取込に失敗しました', 'error');
    });
  },
  loadList: function() {
    var ym = document.getElementById('payslip-view-month').value;
    if (!ym) return;
    var container = document.getElementById('admin-payslip-list');
    if (!container) return;
    container.innerHTML = '読み込み中...';
    API.getStorePayslips(ym).then(function(list) {
      if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = '<p class="text-muted">この月の取込データはありません。</p>';
        return;
      }
      var headerSet = {}; var allKeys = [];
      for (var i = 0; i < list.length; i++) {
        var keys = Object.keys(list[i].data || {});
        for (var k = 0; k < keys.length; k++) {
          if (!headerSet[keys[k]]) { headerSet[keys[k]] = true; allKeys.push(keys[k]); }
        }
      }
      var html = '<div class="table-wrapper"><table class="data-table"><tr>';
      for (var hi = 0; hi < allKeys.length; hi++) html += '<th>' + esc(allKeys[hi]) + '</th>';
      html += '</tr>';
      for (var ri = 0; ri < list.length; ri++) {
        html += '<tr>';
        for (var ci = 0; ci < allKeys.length; ci++) {
          var v = list[ri].data[allKeys[ci]];
          html += '<td>' + esc(String(v == null ? '' : v)) + '</td>';
        }
        html += '</tr>';
      }
      html += '</table></div>';
      html += '<p class="text-muted text-sm mt-8">' + list.length + '件</p>';
      container.innerHTML = html;
    }).catch(function() {
      container.innerHTML = '<p class="text-muted">取得に失敗しました</p>';
    });
  }
};
function onShow_admin_payslip() { AdminPayslip.init(); }

// =====================================================================
// ヘルプ募集URL 管理モジュール
// =====================================================================
var AdminHelpCampaign = {
  currentCampaigns: [],
  currentApps: [],
  currentFilter: '申請中',
  lastCreated: null, // 発行直後のキャンペーン（共有モーダル用）

  // 応募件数バッジを更新（Step3のボタンに「○件」を表示）
  refreshPendingCount: function() {
    API.listHelpApplications({ status: '申請中' }).then(function(list) {
      var el = document.getElementById('ahc-pending-count');
      if (el) el.textContent = (list || []).length;
    }).catch(function() { /* 無視 */ });
  },

  // 管理モーダルを開く
  openManager: function() {
    // 案内文のプレースホルダーを空に（前回の値が残らないよう）
    document.getElementById('ahc-new-message').value = '';
    document.getElementById('ahc-new-expires').value = '';
    App.showModal('ahc-manager-modal');
    this.loadList();
  },

  // 一覧を再読込
  loadList: function() {
    var self = this;
    var box = document.getElementById('ahc-list');
    box.innerHTML = '<div class="text-muted text-center" style="padding:20px 0">読み込み中...</div>';
    API.listHelpCampaigns().then(function(list) {
      self.currentCampaigns = list || [];
      var yearMonth = AdminShiftEdit.yearMonth;
      var filtered = self.currentCampaigns.filter(function(c) { return c.yearMonth === yearMonth; });
      if (filtered.length === 0) {
        box.innerHTML = '<p class="text-muted">この月のURLはまだ発行されていません</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < filtered.length; i++) {
        var c = filtered[i];
        var url = location.origin + '/help.html?t=' + c.id;
        var status = c.isActive ? '<span style="color:#2E7D32;font-weight:600">有効</span>' : '<span style="color:#999">停止中</span>';
        html += '<div style="border:1px solid var(--color-border);border-radius:10px;padding:10px 12px;margin-bottom:10px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        html += '<span>' + status + ' <span class="text-muted text-sm">' + (c.createdAt || '').substring(0,16).replace('T',' ') + '</span></span>';
        if (c.isActive) {
          html += '<button class="btn btn-outline btn-sm" onclick="AdminHelpCampaign.deactivate(\'' + c.id + '\')">停止</button>';
        }
        html += '</div>';
        html += '<div style="font-size:12px;color:#666;word-break:break-all;background:#f7f4ef;padding:6px 8px;border-radius:6px;margin-bottom:6px">' + url + '</div>';
        html += '<div class="flex gap-8">';
        html += '<button class="btn btn-outline btn-sm" style="flex:1" onclick="AdminHelpCampaign.copyUrl(\'' + c.id + '\')">URLをコピー</button>';
        html += '<button class="btn btn-outline btn-sm" style="flex:1" onclick="AdminHelpCampaign.reshare(\'' + c.id + '\')">LINE用テキストを表示</button>';
        html += '</div>';
        html += '</div>';
      }
      box.innerHTML = html;
    }).catch(function() {
      box.innerHTML = '<p class="text-muted">取得に失敗しました</p>';
    });
  },

  // 新規作成
  createNew: function() {
    var yearMonth = AdminShiftEdit.yearMonth;
    var message = document.getElementById('ahc-new-message').value.trim();
    var expiresInput = document.getElementById('ahc-new-expires').value;
    var expiresAt = expiresInput ? new Date(expiresInput + 'T23:59:59').toISOString() : null;

    App.showLoading('発行中...');
    var self = this;
    API.createHelpCampaign(yearMonth, 'ヘルプ募集', message, expiresAt).then(function(result) {
      App.hideLoading();
      if (!result.success) {
        App.showToast(result.message || '発行に失敗しました', 'error');
        return;
      }
      self.lastCreated = result.campaign;
      self.loadList();
      self.showShareModal(result.campaign, message);
    }).catch(function() {
      App.hideLoading();
      App.showToast('発行に失敗しました', 'error');
    });
  },

  // 共有モーダル表示
  showShareModal: function(campaign, customMessage) {
    var url = location.origin + '/help.html?t=' + campaign.id;
    var body = '';
    if (customMessage) body = customMessage + '\n\n';
    body += '▼ 入れる方はこちらから応募してください\n' + url;
    document.getElementById('ahc-share-text').value = body;
    App.showModal('ahc-share-modal');
  },

  // 既存キャンペーンのシェアテキストを再表示
  reshare: function(id) {
    var c = null;
    for (var i = 0; i < this.currentCampaigns.length; i++) {
      if (this.currentCampaigns[i].id === id) { c = this.currentCampaigns[i]; break; }
    }
    if (!c) return;
    this.showShareModal(c, c.message || '');
  },

  copyShare: function() {
    var el = document.getElementById('ahc-share-text');
    navigator.clipboard.writeText(el.value).then(function() {
      App.showToast('コピーしました', 'success');
    }).catch(function() { el.select(); document.execCommand('copy'); App.showToast('コピーしました', 'success'); });
  },

  copyUrlOnly: function() {
    var body = document.getElementById('ahc-share-text').value;
    var m = body.match(/https?:\/\/\S+/);
    if (!m) return;
    navigator.clipboard.writeText(m[0]).then(function() {
      App.showToast('URLをコピーしました', 'success');
    }).catch(function() {});
  },

  copyUrl: function(id) {
    var url = location.origin + '/help.html?t=' + id;
    navigator.clipboard.writeText(url).then(function() {
      App.showToast('URLをコピーしました', 'success');
    }).catch(function() {});
  },

  // キャンペーンを停止
  deactivate: function(id) {
    if (!confirm('この募集URLを停止しますか？停止後はスタッフがアクセスできなくなります。')) return;
    var self = this;
    App.showLoading('停止中...');
    API.deactivateHelpCampaign(id).then(function(result) {
      App.hideLoading();
      if (!result.success) {
        App.showToast(result.message || '停止に失敗しました', 'error');
        return;
      }
      App.showToast('停止しました', 'success');
      self.loadList();
    }).catch(function() { App.hideLoading(); App.showToast('停止に失敗しました', 'error'); });
  },

  // 応募一覧モーダルを開く
  openApplications: function() {
    this.currentFilter = '申請中';
    this.updateTabStyle();
    App.showModal('ahc-apps-modal');
    this.loadApplications();
  },

  switchAppsFilter: function(status) {
    this.currentFilter = status;
    this.updateTabStyle();
    this.loadApplications();
  },

  updateTabStyle: function() {
    var map = { '申請中': 'ahc-tab-pending', '承認': 'ahc-tab-approved', '却下': 'ahc-tab-rejected', '': 'ahc-tab-all' };
    for (var k in map) {
      var el = document.getElementById(map[k]);
      if (!el) continue;
      if (k === this.currentFilter) {
        el.style.background = '#BE2828';
        el.style.color = '#fff';
        el.style.borderColor = '#BE2828';
      } else {
        el.style.background = '';
        el.style.color = '';
        el.style.borderColor = '';
      }
    }
  },

  loadApplications: function() {
    var box = document.getElementById('ahc-apps-list');
    box.innerHTML = '<div class="text-muted text-center" style="padding:20px 0">読み込み中...</div>';
    var params = this.currentFilter ? { status: this.currentFilter } : {};
    var self = this;
    API.listHelpApplications(params).then(function(list) {
      self.currentApps = list || [];
      if (self.currentApps.length === 0) {
        box.innerHTML = '<p class="text-muted text-center" style="padding:20px 0">応募はありません</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < self.currentApps.length; i++) {
        var a = self.currentApps[i];
        var statusColor = a.status === '申請中' ? '#BE2828' : a.status === '承認' ? '#2E7D32' : '#999';
        var appliedAt = (a.appliedAt || '').substring(0,16).replace('T',' ');
        html += '<div style="border:1px solid var(--color-border);border-radius:10px;padding:12px;margin-bottom:10px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        html += '<strong>' + (a.staffName || a.staffId) + '</strong>';
        html += '<span style="color:' + statusColor + ';font-weight:600">' + a.status + '</span>';
        html += '</div>';
        html += '<div style="font-size:13px">' + a.date + ' ' + a.startTime + '〜' + a.endTime;
        if (a.position) html += ' <span class="text-muted">(' + a.position + ')</span>';
        html += '</div>';
        if (a.note) html += '<div class="text-muted text-sm" style="margin-top:4px">💬 ' + a.note + '</div>';
        html += '<div class="text-muted text-sm">応募: ' + appliedAt + '</div>';
        if (a.status === '申請中') {
          html += '<div class="flex gap-8" style="margin-top:8px">';
          html += '<button class="btn btn-primary btn-sm" style="flex:1" onclick="AdminHelpCampaign.approve(\'' + a.id + '\')">承認（シフトに反映）</button>';
          html += '<button class="btn btn-outline btn-sm" style="flex:1" onclick="AdminHelpCampaign.reject(\'' + a.id + '\')">却下</button>';
          html += '</div>';
        }
        html += '</div>';
      }
      box.innerHTML = html;
    }).catch(function() { box.innerHTML = '<p class="text-muted">取得に失敗しました</p>'; });
  },

  approve: function(id) {
    if (!confirm('この応募を承認して、確定シフトに反映しますか？')) return;
    var self = this;
    App.showLoading('反映中...');
    API.approveHelpApplication(id).then(function(result) {
      App.hideLoading();
      if (!result.success) {
        App.showToast(result.message || '承認に失敗しました', 'error');
        return;
      }
      App.showToast('承認しました', 'success');
      self.loadApplications();
      self.refreshPendingCount();
      // 確定シフト表を再読込（背後のシフト表にも反映されるように）
      if (typeof AdminShiftEdit !== 'undefined' && AdminShiftEdit.load) AdminShiftEdit.load();
    }).catch(function() { App.hideLoading(); App.showToast('承認に失敗しました', 'error'); });
  },

  reject: function(id) {
    var reason = prompt('却下の理由（任意）を入力してください', '');
    if (reason === null) return;
    var self = this;
    App.showLoading('処理中...');
    API.rejectHelpApplication(id, reason).then(function(result) {
      App.hideLoading();
      if (!result.success) {
        App.showToast(result.message || '却下に失敗しました', 'error');
        return;
      }
      App.showToast('却下しました', 'success');
      self.loadApplications();
      self.refreshPendingCount();
    }).catch(function() { App.hideLoading(); App.showToast('却下に失敗しました', 'error'); });
  }
};
