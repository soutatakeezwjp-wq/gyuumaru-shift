// ぎゅう丸シフト管理システム - 各画面のロジック（GAS版HTMLから移植）

// ========================================
// ヘルパー関数
// ========================================
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
function onShow_store_select() {
  API.getStores().then(function(stores) {
    var container = document.getElementById('store-list');
    if (stores.length === 0) {
      container.innerHTML = '<div class="alert alert-warning">店舗が登録されていません</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < stores.length; i++) {
      var s = stores[i];
      html += '<div class="store-card" onclick="selectStore(\'' + s.code + '\', \'' + s.name + '\')">';
      html += '<div class="store-card-name">' + s.name + '</div>';
      html += '<div class="store-card-type">' + s.type + '</div>';
      html += '</div>';
    }
    container.innerHTML = html;
  }).catch(function() {
    document.getElementById('store-list').innerHTML = '<div class="alert alert-error">店舗情報の読み込みに失敗しました</div>';
  });
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
      html += '<div class="staff-item" onclick="App.selectStaff(\'' + s.id + '\', \'' + s.name + '\')">' + s.name + '</div>';
    }
    container.innerHTML = html;
  }).catch(function() {
    document.getElementById('staff-list-container').innerHTML = '<div class="alert alert-error">スタッフ情報の読み込みに失敗しました。ページを再読み込みしてください。</div>';
  });
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
      var names = summary.notSubmitted.map(function(s) { return s.name; });
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
        tableHtml += '<tr><td>' + name + '</td><td>' + r.date + '</td><td>' + r.type + '</td><td>' + timeStr + '</td><td>' + (r.note || '') + '</td></tr>';
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
    var parts = this.yearMonth.split('-'); var month = parseInt(parts[1]); var prevMonth = month - 1 || 12;
    el.textContent = month + '月のシフト希望は、' + prevMonth + '月' + App.storeInfo.requestDeadlineDay + '日までに提出してください';
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
      var dayClass = d.getDay() === 0 ? ' class="text-accent"' : (d.getDay() === 6 ? ' style="color:#1976D2"' : '');
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
  currentView: 'month',
  weekOffset: 0,
  selectedDay: '',

  init: function() {
    this.yearMonth = getNextMonthStr(); this.populateTimeSelects();
    this.currentView = 'month'; this.weekOffset = 0; this.selectedDay = '';
    this.updateViewButtons();
    var self = this;
    Calendar.renderHeader('ase-month-header', this.yearMonth, function(newYM) { self.yearMonth = newYM; self.weekOffset = 0; self.load(); });
    this.load();
  },

  setView: function(view) {
    this.currentView = view;
    if (view === 'day' && !this.selectedDay) {
      // デフォルトは今日か月初
      var today = new Date();
      var todayStr = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
      if (todayStr.substring(0, 7) === this.yearMonth) {
        this.selectedDay = todayStr;
      } else {
        this.selectedDay = this.yearMonth + '-01';
      }
    }
    this.updateViewButtons();
    this.renderCurrentView();
  },

  updateViewButtons: function() {
    var btns = ['month', 'week', 'day'];
    for (var i = 0; i < btns.length; i++) {
      var el = document.getElementById('view-' + btns[i] + '-btn');
      if (el) { el.className = 'btn btn-sm view-btn' + (this.currentView === btns[i] ? ' active' : ''); }
    }
  },

  renderCurrentView: function() {
    if (this.currentView === 'week') { this.renderWeekView(); }
    else if (this.currentView === 'day') { this.renderDayView(); }
    else { this.renderMatrix(); }
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
      self.renderCurrentView();
      self.renderStaffHours();
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
    function renderStaffRows(staffGroup) {
      var rowsHtml = '';
      for (var si = 0; si < staffGroup.length; si++) {
        var staff = staffGroup[si];
        rowsHtml += '<tr><td class="staff-name-col">' + staff.name + '</td>';
        for (var day = 1; day <= daysInMonth; day++) {
          var dateStr = self.yearMonth + '-' + ('0' + day).slice(-2);
          var shift = (schedMap[staff.id] || {})[dateStr];
          var req = (reqMap[staff.id] || {})[dateStr];
          if (shift) {
            // 確定シフトがある場合
            rowsHtml += '<td class="shift-cell has-shift" onclick="AdminShiftEdit.editShift(\'' + shift.id + '\', \'' + dateStr + '\', \'' + staff.id + '\')" title="' + staff.name + ' ' + shift.startTime + '-' + shift.endTime + '">' + shift.startTime + '<br>' + shift.endTime + '</td>';
          } else if (req) {
            // シフト希望がある場合（薄い色で表示）
            var reqClass = 'shift-cell has-request';
            var reqLabel = '';
            var reqTitle = staff.name + ' ';
            if (req.type === '出勤希望') {
              reqClass += ' req-work';
              reqLabel = req.startTime + '<br>' + req.endTime;
              reqTitle += '出勤希望 ' + req.startTime + '-' + req.endTime;
            } else if (req.type === '休み希望') {
              reqClass += ' req-off';
              reqLabel = '休';
              reqTitle += '休み希望';
            } else if (req.type === 'どちらでも') {
              reqClass += ' req-either';
              reqLabel = req.startTime ? req.startTime + '<br>' + req.endTime : 'OK';
              reqTitle += 'どちらでも' + (req.startTime ? ' ' + req.startTime + '-' + req.endTime : '');
            }
            rowsHtml += '<td class="' + reqClass + '" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\', \'' + staff.id + '\')" title="' + reqTitle + '">' + reqLabel + '</td>';
          } else {
            rowsHtml += '<td class="shift-cell" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\', \'' + staff.id + '\')"></td>';
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
        rowsHtml += '<td class="' + hoursClass + '">' + hoursLabel + '</td>';
        rowsHtml += '</tr>';
      }
      return rowsHtml;
    }

    // ホールセクション
    html += '<tr class="position-header"><td colspan="' + (daysInMonth + 2) + '">ホール (' + hallStaff.length + '名)</td></tr>';
    html += renderStaffRows(hallStaff);

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
      var isWeekend = (ddDow === 0 || ddDow === 6);
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
      var isWeekendK = (dkDow === 0 || dkDow === 6);
      var kitchenMin = isWeekendK ? kitchenMinWeekend : kitchenMinWeekday;
      var kitchenCount = dailyKitchenCount[dkDate] || 0;
      html += '<td class="' + (kitchenCount < kitchenMin ? 'shortage' : '') + '" title="最低' + kitchenMin + '人">' + kitchenCount + '</td>';
    }
    html += '<td></td></tr>';

    html += '</table>';
    container.innerHTML = html;
  },

  editShift: function(shiftId, dateStr, staffId) {
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

  // 労働時間プレビュー
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
    var breakMin = 0;
    if (totalH > 8) breakMin = 60;
    else if (totalH > 6) breakMin = 45;
    var actualH = Math.round((totalMin - breakMin) / 60 * 10) / 10;
    previewEl.innerHTML = '勤務: ' + totalH.toFixed(1) + 'h - 休憩: ' + breakMin + '分 = <span style="font-weight:bold;color:#4A3323">実働 ' + actualH + 'h</span>';
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
      var names = summary.notSubmitted.map(function(s) { return s.name; }).join(', ');
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

    // 各スタッフの月間合計時間を計算
    var staffHoursMap = {};
    for (var i = 0; i < this.schedules.length; i++) {
      var sc = this.schedules[i];
      if (!staffHoursMap[sc.staffId]) staffHoursMap[sc.staffId] = 0;
      staffHoursMap[sc.staffId] += (sc.workHours || 0);
    }

    // 正社員だけをピックアップ
    var fulltimeStaff = [];
    for (var fi = 0; fi < this.staffList.length; fi++) {
      if (this.staffList[fi].employmentType === '正社員') {
        fulltimeStaff.push(this.staffList[fi]);
      }
    }

    if (fulltimeStaff.length === 0) {
      container.innerHTML = '';
      return;
    }

    // プログレスバーの最大値（320時間を上限とする）
    var maxHours = 320;

    var html = '<div class="fulltime-hours-card">';
    html += '<div style="font-weight:bold;font-size:16px;margin-bottom:12px;color:#4A3323">正社員 月間労働時間</div>';

    for (var si = 0; si < fulltimeStaff.length; si++) {
      var staff = fulltimeStaff[si];
      var totalH = staffHoursMap[staff.id] || 0;
      var roundedH = Math.round(totalH * 10) / 10;
      var pos = staff.position || 'ホール';

      // 状態判定（240h基準、280h危険）
      var barClass = 'ok';
      var valueColor = '#2E7D32';
      var statusLabel = '';
      if (totalH > 280) {
        barClass = 'danger';
        valueColor = '#C62828';
        statusLabel = ' (危険)';
      } else if (totalH > 240) {
        barClass = 'warning';
        valueColor = '#E65100';
        var otHours = Math.round((totalH - 240) * 10) / 10;
        statusLabel = ' (残業' + otHours + 'h)';
      }

      var widthPct = Math.min(Math.round(totalH / maxHours * 100), 100);
      // 240hと280hのライン位置を計算
      var line240 = Math.round(240 / maxHours * 100);
      var line280 = Math.round(280 / maxHours * 100);

      html += '<div class="staff-row">';
      html += '<div class="staff-name">' + staff.name + '</div>';
      html += '<div class="staff-position">' + pos + '</div>';
      html += '<div class="hours-bar-bg">';
      // 240時間ライン（基準）
      html += '<div class="limit-line" style="left:' + line240 + '%"><div class="limit-label" style="left:0">240h</div></div>';
      // 280時間ライン（危険）
      html += '<div class="limit-line" style="left:' + line280 + '%"><div class="limit-label" style="left:0">280h</div></div>';
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
      html += '<tr><td class="time-col" style="text-align:left;font-size:12px">' + nameLabel + '</td>';
      for (var day = weekStart; day <= weekEnd; day++) {
        if (day < 1 || day > daysInMonth) { html += '<td></td>'; continue; }
        var dateStr = this.yearMonth + '-' + ('0' + day).slice(-2);
        var shift = (schedMap[staff.id] || {})[dateStr];
        var req = (reqMap[staff.id] || {})[dateStr];
        if (shift) {
          html += '<td class="has-shift" onclick="AdminShiftEdit.editShift(\'' + shift.id + '\',\'' + dateStr + '\',\'' + staff.id + '\')" title="' + shift.startTime + '-' + shift.endTime + '">';
          html += '<div style="font-size:12px;font-weight:bold">' + shift.startTime + '</div>';
          html += '<div style="font-size:11px;color:#666">~' + shift.endTime + '</div>';
          html += '<div style="font-size:10px;color:#888">' + (shift.workHours || 0) + 'h</div>';
          html += '</td>';
        } else if (req) {
          var bgColor = req.type === '出勤希望' ? '#E3F2FD' : (req.type === '休み希望' ? '#FFEBEE' : '#FFF8E1');
          html += '<td style="background:' + bgColor + ';cursor:pointer;font-size:11px" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\',\'' + staff.id + '\')">';
          html += req.type === '休み希望' ? '休' : (req.startTime || 'OK');
          html += '</td>';
        } else {
          html += '<td style="cursor:pointer" onclick="AdminShiftEdit.addShift(\'' + dateStr + '\',\'' + staff.id + '\')"></td>';
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
          html += '<span class="' + chipClass + '" onclick="AdminShiftEdit.editShift(\'' + shift.id + '\',\'' + this.selectedDay + '\',\'' + shift.staffId + '\')">' + label + '</span>';
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
        html += '<span class="day-view-chip" style="margin:2px" onclick="AdminShiftEdit.addShift(\'' + this.selectedDay + '\',\'' + unassigned[ui].id + '\')">' + unassigned[ui].name + '</span>';
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
      this.renderDayView();
    }
  },

  nextDay: function() {
    var parts = this.selectedDay.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() + 1);
    if (d.getMonth() + 1 === parseInt(parts[1])) {
      this.selectedDay = this.yearMonth + '-' + ('0' + d.getDate()).slice(-2);
      this.renderDayView();
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
          var isWknd = (sDow === 0 || sDow === 6);
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
      html += '<tr><td class="text-bold">' + s.name + ' <span class="text-sm text-muted">[' + pos + '/' + s.employmentType + ']</span></td><td><span class="badge badge-confirmed">' + pos + '</span> <span class="badge badge-draft">' + s.employmentType + '</span></td><td>' + payInfo + '</td>';
      html += '<td><button class="btn btn-outline btn-sm" onclick="StaffManage.edit(\'' + s.id + '\')" style="margin-right:4px">編集</button>';
      html += '<button class="btn btn-danger btn-sm" onclick="StaffManage.retire(\'' + s.id + '\', \'' + s.name + '\')">退職</button></td></tr>';
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

  retire: function(staffId, staffName) {
    if (!App.confirm(staffName + 'さんを退職処理しますか？\n(データは残りますが、シフト入力やスタッフ選択画面に表示されなくなります)')) return;
    App.showLoading('処理中...'); var self = this;
    API.retireStaff(staffId).then(function(result) {
      App.hideLoading(); if (result.success) { App.showToast(result.message, 'success'); self.load(); } else { App.showToast(result.message, 'error'); }
    }).catch(function() { App.hideLoading(); App.showToast('退職処理に失敗しました', 'error'); });
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
    var html = '<div class="table-wrapper"><table class="data-table"><tr><th>スタッフ</th><th>区分</th><th>労働時間</th><th>基本給</th><th>深夜手当</th><th>残業手当</th><th>交通費</th><th>合計</th></tr>';
    var totalHours = 0, totalBase = 0, totalLate = 0, totalOT = 0, totalTrans = 0;
    for (var i = 0; i < costs.length; i++) {
      var c = costs[i];
      html += '<tr><td class="text-bold">' + c.name + '</td><td>' + c.employmentType + '</td><td class="text-right">' + App.formatHours(c.totalHours) + 'h</td><td class="text-right">' + App.formatCurrency(c.basePay) + '</td><td class="text-right">' + App.formatCurrency(c.lateNightPay) + '</td><td class="text-right">' + App.formatCurrency(c.overtimePay) + '</td><td class="text-right">' + App.formatCurrency(c.transportTotal) + '</td><td class="text-right text-bold">' + App.formatCurrency(c.totalCost) + '</td></tr>';
      totalHours += c.totalHours || 0; totalBase += c.basePay || 0; totalLate += c.lateNightPay || 0; totalOT += c.overtimePay || 0; totalTrans += c.transportTotal || 0;
    }
    html += '<tr style="background-color:#F0E8DC;font-weight:bold"><td colspan="2">合計</td><td class="text-right">' + App.formatHours(totalHours) + 'h</td><td class="text-right">' + App.formatCurrency(totalBase) + '</td><td class="text-right">' + App.formatCurrency(totalLate) + '</td><td class="text-right">' + App.formatCurrency(totalOT) + '</td><td class="text-right">' + App.formatCurrency(totalTrans) + '</td><td class="text-right text-accent">' + App.formatCurrency(report.totalCost) + '</td></tr>';
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
    // 時間帯別人数
    this.renderTimeSlots();
  },

  renderTimeSlots: function() {
    var container = document.getElementById('time-slot-staffing-container');
    if (!container) return;
    var html = '';
    for (var i = 0; i < this.timeSlotStaffing.length; i++) {
      var slot = this.timeSlotStaffing[i];
      html += '<div class="time-slot-row" style="border:1px solid #D7CCC8;border-radius:8px;padding:12px;margin-bottom:8px;background:#FAFAFA">';
      html += '<div class="flex gap-8 mb-8" style="align-items:center">';
      html += '<input type="text" class="form-input" style="width:80px;font-size:13px" value="' + (slot.label || '') + '" data-slot="' + i + '" data-field="label" placeholder="名前" onchange="StoreSettings.updateSlot(this)">';
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

  save: function() {
    var newSettings = {
      '平日ホール最低人数': document.getElementById('set-weekday-hall').value,
      '平日キッチン最低人数': document.getElementById('set-weekday-kitchen').value,
      '土日ホール最低人数': document.getElementById('set-weekend-hall').value,
      '土日キッチン最低人数': document.getElementById('set-weekend-kitchen').value,
      '営業開始': document.getElementById('set-open-time').value,
      '営業終了': document.getElementById('set-close-time').value,
      '希望提出締切日': document.getElementById('set-deadline-day').value,
      '時間帯別必要人数': JSON.stringify(this.timeSlotStaffing)
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
