/**
 * ぎゅう丸シフト管理システム - シフト希望サービス
 */

/**
 * シフト希望を一括提出する
 * @param {string} staffId - スタッフID
 * @param {string} yearMonth - 対象年月
 * @param {Object[]} requests - 希望データの配列 [{date, type, startTime, endTime, note}]
 * @return {Object} {success: boolean, message: string}
 */
function submitShiftRequests(staffId, yearMonth, requests) {
  try {
    // バリデーション
    if (!staffId || !yearMonth || !requests) {
      return { success: false, message: '入力データが不足しています' };
    }

    // スタッフ存在チェック
    var staff = getStaffDataById(staffId);
    if (!staff) {
      return { success: false, message: 'スタッフが見つかりません' };
    }

    // 希望データを保存
    saveShiftRequests(staffId, yearMonth, requests);

    // ログ記録
    addLog(staffId, 'シフト希望提出', yearMonth + ' ' + requests.length + '日分');

    return {
      success: true,
      message: requests.length + '日分のシフト希望を提出しました'
    };
  } catch (e) {
    return { success: false, message: 'エラーが発生しました: ' + e.message };
  }
}

/**
 * 自分のシフト希望を取得する
 * @param {string} staffId - スタッフID
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} シフト希望データの配列
 */
function getMyRequests(staffId, yearMonth) {
  return getShiftRequestsByStaff(staffId, yearMonth);
}

/**
 * 全スタッフの希望を取得する（管理者用）
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} シフト希望データの配列
 */
function getAllRequests(yearMonth) {
  return getAllShiftRequests(yearMonth);
}

/**
 * シフト希望の提出状況サマリーを取得する
 * @param {string} yearMonth - 対象年月
 * @return {Object} サマリー情報
 */
function getRequestSummary(yearMonth) {
  var allStaff = getAllStaffData(true);
  var allRequests = getAllShiftRequests(yearMonth);

  // 提出済みスタッフIDを集める
  var submittedStaffIds = {};
  for (var i = 0; i < allRequests.length; i++) {
    submittedStaffIds[allRequests[i].staffId] = true;
  }

  var submittedCount = 0;
  var notSubmitted = [];

  for (var j = 0; j < allStaff.length; j++) {
    if (submittedStaffIds[allStaff[j].id]) {
      submittedCount++;
    } else {
      notSubmitted.push({
        id: allStaff[j].id,
        name: allStaff[j].name
      });
    }
  }

  // 日別の希望集計
  var dailySummary = {};
  for (var k = 0; k < allRequests.length; k++) {
    var req = allRequests[k];
    if (!dailySummary[req.date]) {
      dailySummary[req.date] = { work: 0, off: 0, either: 0, total: 0 };
    }
    if (req.type === REQUEST_TYPES.WORK) dailySummary[req.date].work++;
    else if (req.type === REQUEST_TYPES.OFF) dailySummary[req.date].off++;
    else if (req.type === REQUEST_TYPES.EITHER) dailySummary[req.date].either++;
    dailySummary[req.date].total++;
  }

  return {
    totalStaff: allStaff.length,
    submittedCount: submittedCount,
    notSubmitted: notSubmitted,
    dailySummary: dailySummary
  };
}
