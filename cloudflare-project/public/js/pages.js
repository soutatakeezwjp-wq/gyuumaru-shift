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

  init: function() {
    this.yearMonth = getNextMonthStr(); this.populateTimeSelects();
    var self = this;
    Calendar.renderHeader('ase-month-header', this.yearMonth, function(newYM) { self.yearMonth = newYM; self.load(); });
    this.load();
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
    Promise.all([API.getShiftSchedule(this.yearMonth), API.getAllStaff(), API.getAllRequests(this.yearMonth)]).then(function(results) {
      App.hideLoading(); self.schedules = results[0]; self.staffList = results[1]; self.requests = results[2];
      Calendar.renderHeader('ase-month-header', self.yearMonth, function(newYM) { self.yearMonth = newYM; self.load(); });
      self.renderMatrix();
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
          if (totalH > 80) {
            hoursClass += ' hours-danger';
          } else if (totalH > 60) {
            hoursClass += ' hours-warning';
          } else {
            hoursClass += ' hours-ok';
          }
        }
        var hoursLabel = (Math.round(totalH * 10) / 10) + 'h';
        // 正社員で60時間超の場合は1.3倍の印を追加
        if (staff.employmentType === '正社員' && totalH > 60) {
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

    // 最低人数の定義（平日/土日で異なる）
    var hallMinWeekday = 3;
    var hallMinWeekend = 5;
    var kitchenMinWeekday = 2;
    var kitchenMinWeekend = 4;

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
    document.getElementById('ase-delete-btn').classList.remove('hidden'); App.showModal('ase-edit-modal');
  },

  addShift: function(dateStr, staffId) {
    this.editingShiftId = null; this.editingDate = dateStr;
    var parts = dateStr.split('-'); var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    document.getElementById('ase-modal-title').textContent = parseInt(parts[1]) + '/' + parseInt(parts[2]) + '(' + dayNames[d.getDay()] + ') シフト追加';
    this.populateStaffSelect(staffId);
    document.getElementById('ase-modal-start').value = '11:00'; document.getElementById('ase-modal-end').value = '17:00';
    document.getElementById('ase-delete-btn').classList.add('hidden'); App.showModal('ase-edit-modal');
  },

  populateStaffSelect: function(selectedId) {
    var el = document.getElementById('ase-modal-staff'); el.innerHTML = '';
    for (var i = 0; i < this.staffList.length; i++) { var opt = document.createElement('option'); opt.value = this.staffList[i].id; opt.textContent = this.staffList[i].name; el.appendChild(opt); }
    if (selectedId) el.value = selectedId;
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

    // プログレスバーの最大値（100時間を上限とする）
    var maxHours = 100;

    var html = '<div class="fulltime-hours-card">';
    html += '<div style="font-weight:bold;font-size:16px;margin-bottom:12px;color:#4A3323">正社員 月間労働時間</div>';

    for (var si = 0; si < fulltimeStaff.length; si++) {
      var staff = fulltimeStaff[si];
      var totalH = staffHoursMap[staff.id] || 0;
      var roundedH = Math.round(totalH * 10) / 10;
      var pos = staff.position || 'ホール';

      // 状態判定
      var barClass = 'ok';
      var valueColor = '#2E7D32';
      var statusLabel = '';
      if (totalH > 80) {
        barClass = 'danger';
        valueColor = '#C62828';
        statusLabel = ' (危険)';
      } else if (totalH > 60) {
        barClass = 'warning';
        valueColor = '#E65100';
        statusLabel = ' (注意 x1.3)';
      }

      var widthPct = Math.min(Math.round(totalH / maxHours * 100), 100);

      html += '<div class="staff-row">';
      html += '<div class="staff-name">' + staff.name + '</div>';
      html += '<div class="staff-position">' + pos + '</div>';
      html += '<div class="hours-bar-bg">';
      // 60時間ラインの表示
      html += '<div class="limit-line" style="left:60%"><div class="limit-label" style="left:0">60h</div></div>';
      // 80時間ラインの表示
      html += '<div class="limit-line" style="left:80%"><div class="limit-label" style="left:0">80h</div></div>';
      // プログレスバーの塗りつぶし
      html += '<div class="hours-bar-fill ' + barClass + '" style="width:' + widthPct + '%"></div>';
      html += '</div>';
      html += '<div class="hours-value" style="color:' + valueColor + '">' + roundedH + 'h' + statusLabel + '</div>';
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  },

  // シフト表をExcelファイルとして出力する
  exportExcel: function() {
    if (this.schedules.length === 0 && this.staffList.length === 0) {
      App.showToast('シフトデータがありません', 'error');
      return;
    }

    var parts = this.yearMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];

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

    // --- Excelデータの組み立て ---
    var wb = XLSX.utils.book_new();
    var wsData = [];
    var merges = [];
    var colWidths = [{wch: 12}]; // スタッフ名列の幅
    for (var cw = 0; cw < daysInMonth; cw++) { colWidths.push({wch: 6}); }
    colWidths.push({wch: 8}); // 合計列

    // 店舗名
    var storeName = (App.storeInfo && App.storeInfo.storeName) ? App.storeInfo.storeName : 'ぎゅう丸';

    // 1行目: タイトル
    var titleRow = [storeName + ' ' + year + '年' + month + '月 シフト表'];
    wsData.push(titleRow);

    // 2行目: ヘッダー（日付）
    var headerRow1 = ['スタッフ'];
    for (var d = 1; d <= daysInMonth; d++) { headerRow1.push(d + '日'); }
    headerRow1.push('合計h');
    wsData.push(headerRow1);

    // 3行目: ヘッダー（曜日）
    var headerRow2 = [''];
    for (var dw = 1; dw <= daysInMonth; dw++) {
      var dow = new Date(year, month - 1, dw).getDay();
      headerRow2.push(dayNames[dow]);
    }
    headerRow2.push('');
    wsData.push(headerRow2);

    // スタッフ行を追加する関数
    function addStaffRows(staffGroup, groupName) {
      // グループヘッダー行
      var groupRow = [groupName + ' (' + staffGroup.length + '名)'];
      wsData.push(groupRow);

      for (var si = 0; si < staffGroup.length; si++) {
        var staff = staffGroup[si];
        var row = [staff.name];
        for (var day = 1; day <= daysInMonth; day++) {
          var dateStr = parts[0] + '-' + parts[1] + '-' + ('0' + day).slice(-2);
          var shift = (schedMap[staff.id] || {})[dateStr];
          if (shift) {
            row.push(shift.startTime + '-' + shift.endTime);
          } else {
            row.push('');
          }
        }
        // 合計時間
        var totalH = staffHoursMap[staff.id] || 0;
        row.push(Math.round(totalH * 10) / 10);
        wsData.push(row);
      }
    }

    addStaffRows(hallStaff, 'ホール');
    addStaffRows(kitchenStaff, 'キッチン');

    // ホール出勤人数行
    var hallCountRow = ['ホール出勤'];
    for (var dd = 1; dd <= daysInMonth; dd++) {
      var ddDate = this.yearMonth + '-' + ('0' + dd).slice(-2);
      hallCountRow.push(dailyHallCount[ddDate] || 0);
    }
    hallCountRow.push('');
    wsData.push(hallCountRow);

    // キッチン出勤人数行
    var kitchenCountRow = ['キッチン出勤'];
    for (var dk = 1; dk <= daysInMonth; dk++) {
      var dkDate = this.yearMonth + '-' + ('0' + dk).slice(-2);
      kitchenCountRow.push(dailyKitchenCount[dkDate] || 0);
    }
    kitchenCountRow.push('');
    wsData.push(kitchenCountRow);

    // ワークシートを作成
    var ws = XLSX.utils.aoa_to_sheet(wsData);

    // 列幅を設定
    ws['!cols'] = colWidths;

    // タイトル行のマージ（1行目を全列結合）
    merges.push({s: {r: 0, c: 0}, e: {r: 0, c: daysInMonth + 1}});
    ws['!merges'] = merges;

    // --- セルのスタイル設定 ---
    var range = XLSX.utils.decode_range(ws['!ref']);

    for (var R = range.s.r; R <= range.e.r; R++) {
      for (var C = range.s.c; C <= range.e.c; C++) {
        var cellRef = XLSX.utils.encode_cell({r: R, c: C});
        if (!ws[cellRef]) {
          ws[cellRef] = {v: '', t: 's'};
        }
        var cell = ws[cellRef];
        if (!cell.s) cell.s = {};

        // 全セルに罫線を付ける（タイトル行以外）
        if (R >= 1) {
          cell.s.border = {
            top: {style: 'thin', color: {rgb: 'CCCCCC'}},
            bottom: {style: 'thin', color: {rgb: 'CCCCCC'}},
            left: {style: 'thin', color: {rgb: 'CCCCCC'}},
            right: {style: 'thin', color: {rgb: 'CCCCCC'}}
          };
        }

        // タイトル行
        if (R === 0) {
          cell.s.font = {bold: true, sz: 16, color: {rgb: '4A3323'}};
          cell.s.alignment = {horizontal: 'center', vertical: 'center'};
          cell.s.fill = {fgColor: {rgb: 'FFF8E1'}};
        }

        // ヘッダー行（日付と曜日）
        if (R === 1 || R === 2) {
          cell.s.font = {bold: true, sz: 10, color: {rgb: 'FFFFFF'}};
          cell.s.fill = {fgColor: {rgb: '4A3323'}};
          cell.s.alignment = {horizontal: 'center', vertical: 'center'};
          // 土日の色分け
          if (C >= 1 && C <= daysInMonth) {
            var colDow = new Date(year, month - 1, C).getDay();
            if (colDow === 0) {
              cell.s.font = {bold: true, sz: 10, color: {rgb: 'FFCDD2'}};
              cell.s.fill = {fgColor: {rgb: '4A3323'}};
            } else if (colDow === 6) {
              cell.s.font = {bold: true, sz: 10, color: {rgb: '90CAF9'}};
              cell.s.fill = {fgColor: {rgb: '4A3323'}};
            }
          }
        }

        // スタッフ名列（左端）
        if (C === 0 && R >= 3) {
          cell.s.font = {bold: true, sz: 10};
          cell.s.fill = {fgColor: {rgb: 'F5F5F5'}};
        }

        // シフトが入っているセル
        if (R >= 3 && C >= 1 && C <= daysInMonth) {
          var val = cell.v;
          if (val && typeof val === 'string' && val.indexOf('-') !== -1 && val.indexOf(':') !== -1) {
            cell.s.fill = {fgColor: {rgb: 'E8F5E9'}};
            cell.s.font = {sz: 9, color: {rgb: '2E7D32'}};
            cell.s.alignment = {horizontal: 'center', vertical: 'center'};
          } else {
            cell.s.alignment = {horizontal: 'center', vertical: 'center'};
          }
        }

        // 合計列
        if (C === daysInMonth + 1 && R >= 3) {
          cell.s.font = {bold: true, sz: 10};
          cell.s.alignment = {horizontal: 'center'};
          if (typeof cell.v === 'number' && cell.v > 60) {
            cell.s.fill = {fgColor: {rgb: 'FFF3E0'}};
            cell.s.font = {bold: true, sz: 10, color: {rgb: 'E65100'}};
          }
        }
      }
    }

    // グループヘッダー行（ホール、キッチン）とサマリー行のスタイル
    var currentRow = 3; // 0:タイトル, 1:日付, 2:曜日
    // ホールヘッダー
    var hallHeaderRow = currentRow;
    for (var hc = 0; hc <= daysInMonth + 1; hc++) {
      var hRef = XLSX.utils.encode_cell({r: hallHeaderRow, c: hc});
      if (ws[hRef]) {
        ws[hRef].s = {
          font: {bold: true, sz: 11, color: {rgb: 'FFFFFF'}},
          fill: {fgColor: {rgb: '8D6E63'}},
          alignment: {horizontal: 'left'},
          border: {top: {style: 'thin', color: {rgb: '8D6E63'}}, bottom: {style: 'thin', color: {rgb: '8D6E63'}}, left: {style: 'thin', color: {rgb: '8D6E63'}}, right: {style: 'thin', color: {rgb: '8D6E63'}}}
        };
      }
    }

    // キッチンヘッダー
    var kitchenHeaderRow = hallHeaderRow + 1 + hallStaff.length;
    for (var kc = 0; kc <= daysInMonth + 1; kc++) {
      var kRef = XLSX.utils.encode_cell({r: kitchenHeaderRow, c: kc});
      if (ws[kRef]) {
        ws[kRef].s = {
          font: {bold: true, sz: 11, color: {rgb: 'FFFFFF'}},
          fill: {fgColor: {rgb: '8D6E63'}},
          alignment: {horizontal: 'left'},
          border: {top: {style: 'thin', color: {rgb: '8D6E63'}}, bottom: {style: 'thin', color: {rgb: '8D6E63'}}, left: {style: 'thin', color: {rgb: '8D6E63'}}, right: {style: 'thin', color: {rgb: '8D6E63'}}}
        };
      }
    }

    // サマリー行（ホール出勤・キッチン出勤）
    var summaryStartRow = kitchenHeaderRow + 1 + kitchenStaff.length;
    var hallMinWeekday = 3; var hallMinWeekend = 5;
    var kitchenMinWeekday = 2; var kitchenMinWeekend = 4;

    for (var sr = summaryStartRow; sr <= summaryStartRow + 1; sr++) {
      for (var sc2 = 0; sc2 <= daysInMonth + 1; sc2++) {
        var sRef = XLSX.utils.encode_cell({r: sr, c: sc2});
        if (ws[sRef]) {
          ws[sRef].s = {
            font: {bold: true, sz: 10, color: {rgb: '4A3323'}},
            fill: {fgColor: {rgb: 'FFF8E1'}},
            alignment: {horizontal: 'center'},
            border: {top: {style: 'medium', color: {rgb: '4A3323'}}, bottom: {style: 'thin', color: {rgb: 'CCCCCC'}}, left: {style: 'thin', color: {rgb: 'CCCCCC'}}, right: {style: 'thin', color: {rgb: 'CCCCCC'}}}
          };
          // 人員不足のセルは赤くする
          if (sc2 >= 1 && sc2 <= daysInMonth && typeof ws[sRef].v === 'number') {
            var sumDow = new Date(year, month - 1, sc2).getDay();
            var isWknd = (sumDow === 0 || sumDow === 6);
            var minCount;
            if (sr === summaryStartRow) {
              minCount = isWknd ? hallMinWeekend : hallMinWeekday;
            } else {
              minCount = isWknd ? kitchenMinWeekend : kitchenMinWeekday;
            }
            if (ws[sRef].v < minCount) {
              ws[sRef].s.font = {bold: true, sz: 10, color: {rgb: 'C62828'}};
              ws[sRef].s.fill = {fgColor: {rgb: 'FFCDD2'}};
            }
          }
        }
      }
    }

    // ワークブックに追加してダウンロード
    XLSX.utils.book_append_sheet(wb, ws, month + '月シフト表');

    // ファイル名を生成
    var fileName = year + '年' + month + '月_' + storeName + '_シフト表.xlsx';
    XLSX.writeFile(wb, fileName);

    App.showToast('Excelファイルをダウンロードしました', 'success');
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
