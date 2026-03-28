/**
 * ぎゅう丸シフト管理システム - 簡易認証サービス
 */

/**
 * スタッフ選択画面用の一覧を取得する
 * （個人情報は含めず、IDと名前のみ）
 * @return {Object[]} スタッフ一覧 [{id, name, kana}]
 */
function getStaffList() {
  var allStaff = getAllStaffData(true); // 在籍者のみ
  var list = [];
  for (var i = 0; i < allStaff.length; i++) {
    list.push({
      id: allStaff[i].id,
      name: allStaff[i].name,
      kana: allStaff[i].kana
    });
  }
  // フリガナ順にソート
  list.sort(function(a, b) {
    return (a.kana || '').localeCompare(b.kana || '', 'ja');
  });
  return list;
}

/**
 * 管理者パスワードを検証する
 * @param {string} password - 入力されたパスワード
 * @return {boolean} 正しいかどうか
 */
function verifyAdminPassword(password) {
  var storedHash = getSetting(SETTING_KEYS.ADMIN_PASSWORD);
  if (!storedHash) {
    // パスワード未設定の場合は警告して拒否
    return false;
  }
  var inputHash = hashPassword(password);
  return storedHash === inputHash;
}

/**
 * 管理者パスワードを設定する（初期設定用）
 * @param {string} password - 新しいパスワード
 */
function setAdminPassword(password) {
  var hashed = hashPassword(password);
  updateSetting(SETTING_KEYS.ADMIN_PASSWORD, hashed);
  addLog('管理者', 'パスワード変更', '管理者パスワードが変更されました');
}

/**
 * 現在の店舗情報を取得する
 * @return {Object} 店舗情報
 */
function getCurrentStoreInfo() {
  var settings = getSettings();
  return {
    storeName: settings[SETTING_KEYS.STORE_NAME] || '未設定',
    storeCode: settings[SETTING_KEYS.STORE_CODE] || '',
    storeType: settings[SETTING_KEYS.STORE_TYPE] || '',
    openTime: settings[SETTING_KEYS.OPEN_TIME] || '11:00',
    closeTime: settings[SETTING_KEYS.CLOSE_TIME] || '22:00',
    lunchStart: settings[SETTING_KEYS.LUNCH_START] || '11:00',
    lunchEnd: settings[SETTING_KEYS.LUNCH_END] || '15:00',
    dinnerStart: settings[SETTING_KEYS.DINNER_START] || '17:00',
    dinnerEnd: settings[SETTING_KEYS.DINNER_END] || '22:00',
    minStaffLunch: parseInt(settings[SETTING_KEYS.MIN_STAFF_LUNCH]) || 3,
    minStaffDinner: parseInt(settings[SETTING_KEYS.MIN_STAFF_DINNER]) || 4,
    requestDeadlineDay: parseInt(settings[SETTING_KEYS.REQUEST_DEADLINE_DAY]) || 20
  };
}

/**
 * シフト希望の受付期間中かどうかを判定する
 * @param {string} yearMonth - 対象年月 'YYYY-MM'
 * @return {boolean} 受付期間中ならtrue
 */
function isRequestPeriodOpen(yearMonth) {
  var storeInfo = getCurrentStoreInfo();
  var deadlineDay = storeInfo.requestDeadlineDay;

  // 対象年月の前月の締切日を計算
  var parts = yearMonth.split('-');
  var targetYear = parseInt(parts[0]);
  var targetMonth = parseInt(parts[1]);

  // 前月
  var prevMonth = targetMonth - 1;
  var prevYear = targetYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }

  var deadlineDate = new Date(prevYear, prevMonth - 1, deadlineDay, 23, 59, 59);
  var now = new Date();

  return now <= deadlineDate;
}
