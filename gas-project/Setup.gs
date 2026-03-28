/**
 * ぎゅう丸シフト管理システム - 初期セットアップ
 *
 * デプロイ後に1回だけ実行する。
 * スプレッドシートに必要な6つのシートとヘッダー行を自動作成し、
 * 初期設定値を書き込む。
 */

/**
 * スプレッドシートを初期セットアップする
 * GASエディタから手動で実行する（1回だけ）
 */
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // デフォルトの「シート1」を「設定」にリネーム
  var sheets = ss.getSheets();
  if (sheets.length === 1 && sheets[0].getName() === 'シート1') {
    sheets[0].setName(SHEET_NAMES.SETTINGS);
  }

  // --- 設定シート ---
  var settingsSheet = getOrCreateSheet(ss, SHEET_NAMES.SETTINGS);
  var settingsData = [
    [SETTING_KEYS.STORE_NAME, '（店舗名を入力）'],
    [SETTING_KEYS.STORE_CODE, ''],
    [SETTING_KEYS.STORE_TYPE, '直営'],
    [SETTING_KEYS.OPEN_TIME, '11:00'],
    [SETTING_KEYS.CLOSE_TIME, '22:00'],
    [SETTING_KEYS.LUNCH_START, '11:00'],
    [SETTING_KEYS.LUNCH_END, '15:00'],
    [SETTING_KEYS.DINNER_START, '17:00'],
    [SETTING_KEYS.DINNER_END, '22:00'],
    [SETTING_KEYS.MIN_STAFF_LUNCH, 3],
    [SETTING_KEYS.MIN_STAFF_DINNER, 4],
    [SETTING_KEYS.REQUEST_DEADLINE_DAY, 20],
    [SETTING_KEYS.LINE_CHANNEL_TOKEN, ''],
    [SETTING_KEYS.ADMIN_PASSWORD, '']
  ];
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.getRange(1, 1, settingsData.length, 2).setValues(settingsData);
    settingsSheet.setColumnWidth(1, 180);
    settingsSheet.setColumnWidth(2, 300);
  }

  // --- スタッフマスタシート ---
  var staffSheet = getOrCreateSheet(ss, SHEET_NAMES.STAFF);
  var staffHeaders = [
    'スタッフID', '氏名', 'フリガナ', '雇用区分', '時給', '月給',
    '交通費_日額', '電話番号', 'メール', 'LINE_USER_ID',
    '入社日', '週上限時間', '希望休固定', 'ステータス', 'メモ'
  ];
  if (staffSheet.getLastRow() === 0) {
    staffSheet.getRange(1, 1, 1, staffHeaders.length).setValues([staffHeaders]);
    formatHeaderRow(staffSheet);
  }

  // --- シフト希望シート ---
  var requestSheet = getOrCreateSheet(ss, SHEET_NAMES.SHIFT_REQUEST);
  var requestHeaders = [
    '希望ID', 'スタッフID', '対象年月', '日付', '希望区分',
    '開始時間', '終了時間', '備考', '提出日時', '更新日時'
  ];
  if (requestSheet.getLastRow() === 0) {
    requestSheet.getRange(1, 1, 1, requestHeaders.length).setValues([requestHeaders]);
    formatHeaderRow(requestSheet);
  }

  // --- 確定シフトシート ---
  var scheduleSheet = getOrCreateSheet(ss, SHEET_NAMES.SHIFT_SCHEDULE);
  var scheduleHeaders = [
    'シフトID', 'スタッフID', '対象年月', '日付', '開始時間', '終了時間',
    '休憩時間_分', '実労働時間', 'ステータス', '作成方法', '確定日時', '更新日時'
  ];
  if (scheduleSheet.getLastRow() === 0) {
    scheduleSheet.getRange(1, 1, 1, scheduleHeaders.length).setValues([scheduleHeaders]);
    formatHeaderRow(scheduleSheet);
  }

  // --- 人件費シート ---
  var laborSheet = getOrCreateSheet(ss, SHEET_NAMES.LABOR_COST);
  var laborHeaders = [
    '対象年月', 'スタッフID', '氏名', '雇用区分', '総労働時間',
    '基本給', '深夜手当', '残業手当', '交通費合計', '合計人件費', '計算日時'
  ];
  if (laborSheet.getLastRow() === 0) {
    laborSheet.getRange(1, 1, 1, laborHeaders.length).setValues([laborHeaders]);
    formatHeaderRow(laborSheet);
  }

  // --- ログシート ---
  var logSheet = getOrCreateSheet(ss, SHEET_NAMES.LOG);
  var logHeaders = ['日時', '操作者', '操作種別', '詳細'];
  if (logSheet.getLastRow() === 0) {
    logSheet.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
    formatHeaderRow(logSheet);
  }

  // 初期ログを記録
  logSheet.appendRow([getNow(), 'システム', '初期セットアップ', 'スプレッドシートを初期化しました']);

  Logger.log('セットアップ完了！次のステップ: 1.設定シートの店舗名を入力 2.setupAdminPasswordを実行 3.デプロイ');
}

/**
 * 管理者パスワードを設定する（初期設定用）
 * ★ 実行前に下の 'gyuumaru2026' を好きなパスワードに書き換えてください ★
 * 設定後はこの関数内のパスワード文字列を削除してください
 */
function setupAdminPassword() {
  var password = 'gyuumaru2026';  // ← ここを変更してから実行
  setAdminPassword(password);
  Logger.log('パスワードを設定しました！');
}

// ========================================
// ヘルパー関数（セットアップ専用）
// ========================================

/**
 * シートを取得（なければ作成）
 */
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * ヘッダー行を見やすくフォーマットする
 */
function formatHeaderRow(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground('#4A3323');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
}
