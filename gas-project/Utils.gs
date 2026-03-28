/**
 * ぎゅう丸シフト管理システム - 共通ユーティリティ
 */

/**
 * ユニークIDを生成する
 * @param {string} prefix - IDのプレフィックス（例: 'STF', 'REQ', 'SFT'）
 * @return {string} 生成されたID
 */
function generateId(prefix) {
  var timestamp = new Date().getTime().toString(36);
  var random = Math.random().toString(36).substring(2, 6);
  return prefix + '_' + timestamp + random;
}

/**
 * 日付を 'YYYY-MM-DD' 形式の文字列に変換する
 * @param {Date} date - 日付オブジェクト
 * @return {string} フォーマットされた日付文字列
 */
function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

/**
 * 日付を 'YYYY-MM' 形式の文字列に変換する
 * @param {Date} date - 日付オブジェクト
 * @return {string} フォーマットされた年月文字列
 */
function formatYearMonth(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  return year + '-' + month;
}

/**
 * 時刻を 'HH:MM' 形式の文字列に変換する
 * @param {Date|string} time - 時刻
 * @return {string} フォーマットされた時刻文字列
 */
function formatTime(time) {
  if (typeof time === 'string') {
    // 既に文字列の場合はそのまま返す
    if (time.match(/^\d{1,2}:\d{2}$/)) return time;
    time = new Date(time);
  }
  if (time instanceof Date) {
    var hours = ('0' + time.getHours()).slice(-2);
    var minutes = ('0' + time.getMinutes()).slice(-2);
    return hours + ':' + minutes;
  }
  return '';
}

/**
 * 現在の日時を 'YYYY-MM-DD HH:MM:SS' 形式で取得する
 * @return {string} 現在の日時文字列
 */
function getNow() {
  var d = new Date();
  return formatDate(d) + ' ' +
    ('0' + d.getHours()).slice(-2) + ':' +
    ('0' + d.getMinutes()).slice(-2) + ':' +
    ('0' + d.getSeconds()).slice(-2);
}

/**
 * 指定した年月の日数を取得する
 * @param {string} yearMonth - 'YYYY-MM' 形式
 * @return {number} 日数
 */
function getDaysInMonth(yearMonth) {
  var parts = yearMonth.split('-');
  var year = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  return new Date(year, month, 0).getDate();
}

/**
 * 指定した年月の全日付を配列で取得する
 * @param {string} yearMonth - 'YYYY-MM' 形式
 * @return {string[]} 'YYYY-MM-DD' 形式の日付文字列の配列
 */
function getAllDatesInMonth(yearMonth) {
  var days = getDaysInMonth(yearMonth);
  var dates = [];
  for (var i = 1; i <= days; i++) {
    dates.push(yearMonth + '-' + ('0' + i).slice(-2));
  }
  return dates;
}

/**
 * 指定した日付の曜日を取得する（日本語）
 * @param {string} dateStr - 'YYYY-MM-DD' 形式
 * @return {string} 曜日（日、月、火、水、木、金、土）
 */
function getDayOfWeek(dateStr) {
  var days = ['日', '月', '火', '水', '木', '金', '土'];
  var d = new Date(dateStr);
  return days[d.getDay()];
}

/**
 * 時刻文字列を分数に変換する
 * @param {string} timeStr - 'HH:MM' 形式
 * @return {number} 0時からの分数
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * 分数を時刻文字列に変換する
 * @param {number} minutes - 0時からの分数
 * @return {string} 'HH:MM' 形式
 */
function minutesToTime(minutes) {
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

/**
 * 2つの時刻の差を時間（小数）で計算する
 * @param {string} startTime - 開始時刻 'HH:MM'
 * @param {string} endTime - 終了時刻 'HH:MM'
 * @return {number} 差の時間数（小数）
 */
function calcHoursDiff(startTime, endTime) {
  var startMin = timeToMinutes(startTime);
  var endMin = timeToMinutes(endTime);
  if (endMin <= startMin) {
    // 日を跨ぐ場合（例: 22:00-02:00）
    endMin += 24 * 60;
  }
  return (endMin - startMin) / 60;
}

/**
 * 勤務時間から休憩時間（分）を計算する（労基法ベース）
 * @param {number} workHours - 拘束時間（時間）
 * @return {number} 休憩時間（分）
 */
function calcBreakMinutes(workHours) {
  if (workHours > 8) {
    return TIME_CONFIG.BREAK_THRESHOLD_8H;
  } else if (workHours > 6) {
    return TIME_CONFIG.BREAK_THRESHOLD_6H;
  }
  return 0;
}

/**
 * パスワードをSHA-256でハッシュ化する
 * @param {string} password - 平文パスワード
 * @return {string} ハッシュ値（16進数文字列）
 */
function hashPassword(password) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  var hash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var val = (rawHash[i] + 256) % 256;
    hash += ('0' + val.toString(16)).slice(-2);
  }
  return hash;
}

/**
 * 指定した日付が含まれる週の月曜日を取得する
 * @param {string} dateStr - 'YYYY-MM-DD' 形式
 * @return {string} その週の月曜日 'YYYY-MM-DD'
 */
function getMonday(dateStr) {
  var d = new Date(dateStr);
  var day = d.getDay();
  // 日曜日は0なので7に変換
  var diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return formatDate(d);
}

/**
 * 日付文字列から来月の年月を取得する
 * @return {string} 来月の 'YYYY-MM'
 */
function getNextMonth() {
  var d = new Date();
  d.setMonth(d.getMonth() + 1);
  return formatYearMonth(d);
}

/**
 * 日付文字列から今月の年月を取得する
 * @return {string} 今月の 'YYYY-MM'
 */
function getCurrentMonth() {
  return formatYearMonth(new Date());
}

/**
 * 30分刻みの時間選択肢を生成する
 * @return {string[]} 時刻文字列の配列
 */
function generateTimeSlots() {
  var slots = [];
  for (var h = TIME_CONFIG.EARLIEST_HOUR; h < TIME_CONFIG.LATEST_HOUR; h++) {
    for (var m = 0; m < 60; m += TIME_CONFIG.SLOT_INTERVAL) {
      slots.push(('0' + h).slice(-2) + ':' + ('0' + m).slice(-2));
    }
  }
  // 最終時刻も追加
  slots.push(('0' + TIME_CONFIG.LATEST_HOUR).slice(-2) + ':00');
  return slots;
}
