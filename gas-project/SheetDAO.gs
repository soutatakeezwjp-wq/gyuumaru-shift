/**
 * ぎゅう丸シフト管理システム - スプレッドシート読み書き処理
 *
 * 全てのシートへのアクセスはこのファイルを経由する。
 * パフォーマンスのため、データは一括取得してJavaScript配列上で操作する。
 */

/**
 * 現在のスプレッドシートを取得する（キャッシュ付き）
 * @return {Spreadsheet} スプレッドシートオブジェクト
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * 指定したシートを取得する
 * @param {string} sheetName - シート名
 * @return {Sheet} シートオブジェクト
 */
function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('シート「' + sheetName + '」が見つかりません。スプレッドシートの設定を確認してください。');
  }
  return sheet;
}

// ========================================
// 設定シート操作
// ========================================

/**
 * 設定シートから全設定を取得する（キー・バリュー形式）
 * @return {Object} 設定のキーバリューオブジェクト
 */
function getSettings() {
  var sheet = getSheet(SHEET_NAMES.SETTINGS);
  var data = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 0; i < data.length; i++) {
    if (data[i][0]) {
      settings[data[i][0]] = data[i][1];
    }
  }
  return settings;
}

/**
 * 設定値を1つ取得する
 * @param {string} key - 設定キー
 * @return {*} 設定値
 */
function getSetting(key) {
  var settings = getSettings();
  return settings[key];
}

/**
 * 設定値を更新する
 * @param {string} key - 設定キー
 * @param {*} value - 設定値
 */
function updateSetting(key, value) {
  var sheet = getSheet(SHEET_NAMES.SETTINGS);
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  // キーが見つからない場合は新規追加
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[key, value]]);
}

// ========================================
// スタッフマスタ操作
// ========================================

// スタッフマスタのカラムインデックス（0始まり）
var STAFF_COL = {
  ID: 0,
  NAME: 1,
  KANA: 2,
  EMPLOYMENT_TYPE: 3,
  HOURLY_RATE: 4,
  MONTHLY_SALARY: 5,
  TRANSPORT_DAILY: 6,
  PHONE: 7,
  EMAIL: 8,
  LINE_USER_ID: 9,
  JOIN_DATE: 10,
  WEEKLY_LIMIT: 11,
  FIXED_OFF: 12,
  STATUS: 13,
  MEMO: 14
};

/**
 * スタッフマスタの全データを取得する（ヘッダー除く）
 * @param {boolean} activeOnly - trueの場合は在籍者のみ
 * @return {Object[]} スタッフデータの配列
 */
function getAllStaffData(activeOnly) {
  var sheet = getSheet(SHEET_NAMES.STAFF);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ヘッダーのみ

  var staff = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[STAFF_COL.ID]) continue; // 空行スキップ
    if (activeOnly && row[STAFF_COL.STATUS] !== STAFF_STATUS.ACTIVE) continue;

    staff.push({
      id: row[STAFF_COL.ID],
      name: row[STAFF_COL.NAME],
      kana: row[STAFF_COL.KANA],
      employmentType: row[STAFF_COL.EMPLOYMENT_TYPE],
      hourlyRate: row[STAFF_COL.HOURLY_RATE] || 0,
      monthlySalary: row[STAFF_COL.MONTHLY_SALARY] || 0,
      transportDaily: row[STAFF_COL.TRANSPORT_DAILY] || 0,
      phone: row[STAFF_COL.PHONE],
      email: row[STAFF_COL.EMAIL],
      lineUserId: row[STAFF_COL.LINE_USER_ID],
      joinDate: row[STAFF_COL.JOIN_DATE] ? formatDate(row[STAFF_COL.JOIN_DATE]) : '',
      weeklyLimit: row[STAFF_COL.WEEKLY_LIMIT] || TIME_CONFIG.WEEKLY_HOUR_LIMIT,
      fixedOff: row[STAFF_COL.FIXED_OFF],
      status: row[STAFF_COL.STATUS],
      memo: row[STAFF_COL.MEMO]
    });
  }
  return staff;
}

/**
 * スタッフIDでスタッフを検索する
 * @param {string} staffId - スタッフID
 * @return {Object|null} スタッフデータ
 */
function getStaffDataById(staffId) {
  var allStaff = getAllStaffData(false);
  for (var i = 0; i < allStaff.length; i++) {
    if (allStaff[i].id === staffId) return allStaff[i];
  }
  return null;
}

/**
 * スタッフを新規登録する
 * @param {Object} staffData - スタッフデータ
 * @return {string} 生成されたスタッフID
 */
function addStaffData(staffData) {
  var sheet = getSheet(SHEET_NAMES.STAFF);
  var id = generateId('STF');
  var row = [
    id,
    staffData.name || '',
    staffData.kana || '',
    staffData.employmentType || EMPLOYMENT_TYPES.PART_TIME,
    staffData.hourlyRate || 0,
    staffData.monthlySalary || 0,
    staffData.transportDaily || 0,
    staffData.phone || '',
    staffData.email || '',
    staffData.lineUserId || '',
    staffData.joinDate || formatDate(new Date()),
    staffData.weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT,
    staffData.fixedOff || '',
    STAFF_STATUS.ACTIVE,
    staffData.memo || ''
  ];
  sheet.appendRow(row);
  return id;
}

/**
 * スタッフ情報を更新する
 * @param {string} staffId - スタッフID
 * @param {Object} staffData - 更新データ
 * @return {boolean} 成功したかどうか
 */
function updateStaffData(staffId, staffData) {
  var sheet = getSheet(SHEET_NAMES.STAFF);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][STAFF_COL.ID] === staffId) {
      var rowNum = i + 1;
      if (staffData.name !== undefined) sheet.getRange(rowNum, STAFF_COL.NAME + 1).setValue(staffData.name);
      if (staffData.kana !== undefined) sheet.getRange(rowNum, STAFF_COL.KANA + 1).setValue(staffData.kana);
      if (staffData.employmentType !== undefined) sheet.getRange(rowNum, STAFF_COL.EMPLOYMENT_TYPE + 1).setValue(staffData.employmentType);
      if (staffData.hourlyRate !== undefined) sheet.getRange(rowNum, STAFF_COL.HOURLY_RATE + 1).setValue(staffData.hourlyRate);
      if (staffData.monthlySalary !== undefined) sheet.getRange(rowNum, STAFF_COL.MONTHLY_SALARY + 1).setValue(staffData.monthlySalary);
      if (staffData.transportDaily !== undefined) sheet.getRange(rowNum, STAFF_COL.TRANSPORT_DAILY + 1).setValue(staffData.transportDaily);
      if (staffData.phone !== undefined) sheet.getRange(rowNum, STAFF_COL.PHONE + 1).setValue(staffData.phone);
      if (staffData.email !== undefined) sheet.getRange(rowNum, STAFF_COL.EMAIL + 1).setValue(staffData.email);
      if (staffData.lineUserId !== undefined) sheet.getRange(rowNum, STAFF_COL.LINE_USER_ID + 1).setValue(staffData.lineUserId);
      if (staffData.weeklyLimit !== undefined) sheet.getRange(rowNum, STAFF_COL.WEEKLY_LIMIT + 1).setValue(staffData.weeklyLimit);
      if (staffData.fixedOff !== undefined) sheet.getRange(rowNum, STAFF_COL.FIXED_OFF + 1).setValue(staffData.fixedOff);
      if (staffData.status !== undefined) sheet.getRange(rowNum, STAFF_COL.STATUS + 1).setValue(staffData.status);
      if (staffData.memo !== undefined) sheet.getRange(rowNum, STAFF_COL.MEMO + 1).setValue(staffData.memo);
      return true;
    }
  }
  return false;
}

// ========================================
// シフト希望操作
// ========================================

// シフト希望のカラムインデックス
var REQUEST_COL = {
  ID: 0,
  STAFF_ID: 1,
  YEAR_MONTH: 2,
  DATE: 3,
  TYPE: 4,
  START_TIME: 5,
  END_TIME: 6,
  NOTE: 7,
  SUBMITTED_AT: 8,
  UPDATED_AT: 9
};

/**
 * シフト希望を一括登録する（既存データは削除して上書き）
 * @param {string} staffId - スタッフID
 * @param {string} yearMonth - 対象年月 'YYYY-MM'
 * @param {Object[]} requests - 希望データの配列
 */
function saveShiftRequests(staffId, yearMonth, requests) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_REQUEST);
  var data = sheet.getDataRange().getValues();
  var now = getNow();

  // 既存データの行番号を記録（後ろから削除するため逆順）
  var rowsToDelete = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][REQUEST_COL.STAFF_ID] === staffId &&
        data[i][REQUEST_COL.YEAR_MONTH] === yearMonth) {
      rowsToDelete.push(i + 1); // シート上の行番号（1始まり）
    }
  }

  // 既存データを削除
  for (var j = 0; j < rowsToDelete.length; j++) {
    sheet.deleteRow(rowsToDelete[j]);
  }

  // 新規データを追加
  var rows = [];
  for (var k = 0; k < requests.length; k++) {
    var req = requests[k];
    rows.push([
      generateId('REQ'),
      staffId,
      yearMonth,
      req.date,
      req.type,
      req.startTime || '',
      req.endTime || '',
      req.note || '',
      now,
      now
    ]);
  }

  if (rows.length > 0) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/**
 * 特定スタッフの特定月のシフト希望を取得する
 * @param {string} staffId - スタッフID
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} シフト希望データの配列
 */
function getShiftRequestsByStaff(staffId, yearMonth) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_REQUEST);
  var data = sheet.getDataRange().getValues();
  var requests = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[REQUEST_COL.STAFF_ID] === staffId &&
        row[REQUEST_COL.YEAR_MONTH] === yearMonth) {
      requests.push({
        id: row[REQUEST_COL.ID],
        staffId: row[REQUEST_COL.STAFF_ID],
        yearMonth: row[REQUEST_COL.YEAR_MONTH],
        date: row[REQUEST_COL.DATE] instanceof Date ? formatDate(row[REQUEST_COL.DATE]) : row[REQUEST_COL.DATE],
        type: row[REQUEST_COL.TYPE],
        startTime: formatTime(row[REQUEST_COL.START_TIME]),
        endTime: formatTime(row[REQUEST_COL.END_TIME]),
        note: row[REQUEST_COL.NOTE],
        submittedAt: row[REQUEST_COL.SUBMITTED_AT],
        updatedAt: row[REQUEST_COL.UPDATED_AT]
      });
    }
  }
  return requests;
}

/**
 * 特定月の全スタッフのシフト希望を取得する
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} シフト希望データの配列
 */
function getAllShiftRequests(yearMonth) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_REQUEST);
  var data = sheet.getDataRange().getValues();
  var requests = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[REQUEST_COL.YEAR_MONTH] === yearMonth) {
      requests.push({
        id: row[REQUEST_COL.ID],
        staffId: row[REQUEST_COL.STAFF_ID],
        yearMonth: row[REQUEST_COL.YEAR_MONTH],
        date: row[REQUEST_COL.DATE] instanceof Date ? formatDate(row[REQUEST_COL.DATE]) : row[REQUEST_COL.DATE],
        type: row[REQUEST_COL.TYPE],
        startTime: formatTime(row[REQUEST_COL.START_TIME]),
        endTime: formatTime(row[REQUEST_COL.END_TIME]),
        note: row[REQUEST_COL.NOTE],
        submittedAt: row[REQUEST_COL.SUBMITTED_AT],
        updatedAt: row[REQUEST_COL.UPDATED_AT]
      });
    }
  }
  return requests;
}

// ========================================
// 確定シフト操作
// ========================================

// 確定シフトのカラムインデックス
var SCHEDULE_COL = {
  ID: 0,
  STAFF_ID: 1,
  YEAR_MONTH: 2,
  DATE: 3,
  START_TIME: 4,
  END_TIME: 5,
  BREAK_MINUTES: 6,
  WORK_HOURS: 7,
  STATUS: 8,
  CREATION_METHOD: 9,
  CONFIRMED_AT: 10,
  UPDATED_AT: 11
};

/**
 * 確定シフトを一括保存する（年月分を上書き）
 * @param {string} yearMonth - 対象年月
 * @param {Object[]} schedules - シフトデータの配列
 */
function saveShiftSchedules(yearMonth, schedules) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_SCHEDULE);
  var data = sheet.getDataRange().getValues();
  var now = getNow();

  // 既存データを削除（後ろから）
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][SCHEDULE_COL.YEAR_MONTH] === yearMonth) {
      sheet.deleteRow(i + 1);
    }
  }

  // 新規データを追加
  var rows = [];
  for (var k = 0; k < schedules.length; k++) {
    var s = schedules[k];
    var workHoursRaw = calcHoursDiff(s.startTime, s.endTime);
    var breakMin = calcBreakMinutes(workHoursRaw);
    var workHours = Math.round((workHoursRaw - breakMin / 60) * 100) / 100;

    rows.push([
      s.id || generateId('SFT'),
      s.staffId,
      yearMonth,
      s.date,
      s.startTime,
      s.endTime,
      breakMin,
      workHours,
      s.status || SHIFT_STATUS.DRAFT,
      s.creationMethod || SHIFT_CREATION.AUTO,
      now,
      now
    ]);
  }

  if (rows.length > 0) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/**
 * 確定シフトを取得する（年月指定）
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} シフトデータの配列
 */
function getShiftSchedules(yearMonth) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_SCHEDULE);
  var data = sheet.getDataRange().getValues();
  var schedules = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[SCHEDULE_COL.YEAR_MONTH] === yearMonth) {
      schedules.push({
        id: row[SCHEDULE_COL.ID],
        staffId: row[SCHEDULE_COL.STAFF_ID],
        yearMonth: row[SCHEDULE_COL.YEAR_MONTH],
        date: row[SCHEDULE_COL.DATE] instanceof Date ? formatDate(row[SCHEDULE_COL.DATE]) : row[SCHEDULE_COL.DATE],
        startTime: formatTime(row[SCHEDULE_COL.START_TIME]),
        endTime: formatTime(row[SCHEDULE_COL.END_TIME]),
        breakMinutes: row[SCHEDULE_COL.BREAK_MINUTES],
        workHours: row[SCHEDULE_COL.WORK_HOURS],
        status: row[SCHEDULE_COL.STATUS],
        creationMethod: row[SCHEDULE_COL.CREATION_METHOD],
        confirmedAt: row[SCHEDULE_COL.CONFIRMED_AT],
        updatedAt: row[SCHEDULE_COL.UPDATED_AT]
      });
    }
  }
  return schedules;
}

/**
 * 確定シフト1件を更新する
 * @param {string} shiftId - シフトID
 * @param {Object} updateData - 更新データ
 * @return {boolean} 成功したか
 */
function updateShiftScheduleEntry(shiftId, updateData) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_SCHEDULE);
  var data = sheet.getDataRange().getValues();
  var now = getNow();

  for (var i = 1; i < data.length; i++) {
    if (data[i][SCHEDULE_COL.ID] === shiftId) {
      var rowNum = i + 1;
      if (updateData.startTime !== undefined) {
        sheet.getRange(rowNum, SCHEDULE_COL.START_TIME + 1).setValue(updateData.startTime);
      }
      if (updateData.endTime !== undefined) {
        sheet.getRange(rowNum, SCHEDULE_COL.END_TIME + 1).setValue(updateData.endTime);
      }
      if (updateData.startTime !== undefined || updateData.endTime !== undefined) {
        var st = updateData.startTime || formatTime(data[i][SCHEDULE_COL.START_TIME]);
        var et = updateData.endTime || formatTime(data[i][SCHEDULE_COL.END_TIME]);
        var workRaw = calcHoursDiff(st, et);
        var brk = calcBreakMinutes(workRaw);
        sheet.getRange(rowNum, SCHEDULE_COL.BREAK_MINUTES + 1).setValue(brk);
        sheet.getRange(rowNum, SCHEDULE_COL.WORK_HOURS + 1).setValue(Math.round((workRaw - brk / 60) * 100) / 100);
      }
      if (updateData.status !== undefined) {
        sheet.getRange(rowNum, SCHEDULE_COL.STATUS + 1).setValue(updateData.status);
      }
      sheet.getRange(rowNum, SCHEDULE_COL.UPDATED_AT + 1).setValue(now);
      return true;
    }
  }
  return false;
}

/**
 * 確定シフト1件を追加する
 * @param {Object} scheduleData - シフトデータ
 * @return {string} 生成されたシフトID
 */
function addShiftScheduleEntry(scheduleData) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_SCHEDULE);
  var now = getNow();
  var id = generateId('SFT');
  var workRaw = calcHoursDiff(scheduleData.startTime, scheduleData.endTime);
  var breakMin = calcBreakMinutes(workRaw);
  var workHours = Math.round((workRaw - breakMin / 60) * 100) / 100;

  var row = [
    id,
    scheduleData.staffId,
    scheduleData.yearMonth,
    scheduleData.date,
    scheduleData.startTime,
    scheduleData.endTime,
    breakMin,
    workHours,
    SHIFT_STATUS.DRAFT,
    SHIFT_CREATION.MANUAL,
    now,
    now
  ];
  sheet.appendRow(row);
  return id;
}

/**
 * 確定シフト1件を削除する
 * @param {string} shiftId - シフトID
 * @return {boolean} 成功したか
 */
function deleteShiftScheduleEntry(shiftId) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_SCHEDULE);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][SCHEDULE_COL.ID] === shiftId) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * 特定月のシフトステータスを一括更新する
 * @param {string} yearMonth - 対象年月
 * @param {string} newStatus - 新しいステータス
 */
function updateShiftStatus(yearMonth, newStatus) {
  var sheet = getSheet(SHEET_NAMES.SHIFT_SCHEDULE);
  var data = sheet.getDataRange().getValues();
  var now = getNow();

  for (var i = 1; i < data.length; i++) {
    if (data[i][SCHEDULE_COL.YEAR_MONTH] === yearMonth) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, SCHEDULE_COL.STATUS + 1).setValue(newStatus);
      sheet.getRange(rowNum, SCHEDULE_COL.CONFIRMED_AT + 1).setValue(now);
      sheet.getRange(rowNum, SCHEDULE_COL.UPDATED_AT + 1).setValue(now);
    }
  }
}

// ========================================
// 人件費操作
// ========================================

var LABOR_COL = {
  YEAR_MONTH: 0,
  STAFF_ID: 1,
  NAME: 2,
  EMPLOYMENT_TYPE: 3,
  TOTAL_HOURS: 4,
  BASE_PAY: 5,
  LATE_NIGHT_PAY: 6,
  OVERTIME_PAY: 7,
  TRANSPORT_TOTAL: 8,
  TOTAL_COST: 9,
  CALCULATED_AT: 10
};

/**
 * 人件費データを保存する（年月分を上書き）
 * @param {string} yearMonth - 対象年月
 * @param {Object[]} costData - 人件費データの配列
 */
function saveLaborCosts(yearMonth, costData) {
  var sheet = getSheet(SHEET_NAMES.LABOR_COST);
  var data = sheet.getDataRange().getValues();
  var now = getNow();

  // 既存データを削除
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][LABOR_COL.YEAR_MONTH] === yearMonth) {
      sheet.deleteRow(i + 1);
    }
  }

  // 新規データを追加
  var rows = [];
  for (var k = 0; k < costData.length; k++) {
    var c = costData[k];
    rows.push([
      yearMonth,
      c.staffId,
      c.name,
      c.employmentType,
      c.totalHours,
      c.basePay,
      c.lateNightPay,
      c.overtimePay,
      c.transportTotal,
      c.totalCost,
      now
    ]);
  }

  if (rows.length > 0) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/**
 * 人件費データを取得する
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} 人件費データの配列
 */
function getLaborCosts(yearMonth) {
  var sheet = getSheet(SHEET_NAMES.LABOR_COST);
  var data = sheet.getDataRange().getValues();
  var costs = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[LABOR_COL.YEAR_MONTH] === yearMonth) {
      costs.push({
        yearMonth: row[LABOR_COL.YEAR_MONTH],
        staffId: row[LABOR_COL.STAFF_ID],
        name: row[LABOR_COL.NAME],
        employmentType: row[LABOR_COL.EMPLOYMENT_TYPE],
        totalHours: row[LABOR_COL.TOTAL_HOURS],
        basePay: row[LABOR_COL.BASE_PAY],
        lateNightPay: row[LABOR_COL.LATE_NIGHT_PAY],
        overtimePay: row[LABOR_COL.OVERTIME_PAY],
        transportTotal: row[LABOR_COL.TRANSPORT_TOTAL],
        totalCost: row[LABOR_COL.TOTAL_COST],
        calculatedAt: row[LABOR_COL.CALCULATED_AT]
      });
    }
  }
  return costs;
}

// ========================================
// ログ操作
// ========================================

/**
 * 操作ログを記録する
 * @param {string} operator - 操作者（スタッフIDまたは'管理者'）
 * @param {string} action - 操作種別
 * @param {string} detail - 詳細
 */
function addLog(operator, action, detail) {
  var sheet = getSheet(SHEET_NAMES.LOG);
  sheet.appendRow([getNow(), operator, action, detail]);
}
