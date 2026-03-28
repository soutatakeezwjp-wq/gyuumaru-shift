/**
 * ぎゅう丸シフト管理システム - シフト表作成・管理サービス
 */

/**
 * シフト表を自動作成する
 * @param {string} yearMonth - 対象年月
 * @return {Object} {success, warnings[], message}
 */
function generateAutoShift(yearMonth) {
  try {
    var storeInfo = getCurrentStoreInfo();
    var allStaff = getAllStaffData(true);
    var allRequests = getAllShiftRequests(yearMonth);

    if (allStaff.length === 0) {
      return { success: false, warnings: [], message: 'スタッフが登録されていません' };
    }

    // スタッフ情報をIDでマップ化
    var staffMap = {};
    for (var i = 0; i < allStaff.length; i++) {
      staffMap[allStaff[i].id] = allStaff[i];
    }

    // 希望データをスタッフID+日付でマップ化
    var requestMap = {}; // { staffId: { date: request } }
    for (var j = 0; j < allRequests.length; j++) {
      var req = allRequests[j];
      if (!requestMap[req.staffId]) requestMap[req.staffId] = {};
      requestMap[req.staffId][req.date] = req;
    }

    var dates = getAllDatesInMonth(yearMonth);
    var schedules = []; // 生成するシフトデータ
    var warnings = [];  // 警告メッセージ

    // ========================================
    // Step 1: 出勤希望をそのまま仮配置
    // ========================================
    var assignedMap = {}; // { date: [staffId, ...] }
    var staffShiftMap = {}; // { staffId: { date: shift } }

    for (var si = 0; si < allStaff.length; si++) {
      var staff = allStaff[si];
      staffShiftMap[staff.id] = {};

      for (var di = 0; di < dates.length; di++) {
        var date = dates[di];
        var request = (requestMap[staff.id] || {})[date];

        if (request && request.type === REQUEST_TYPES.WORK) {
          // 出勤希望 → そのまま配置
          var shift = {
            staffId: staff.id,
            date: date,
            startTime: request.startTime || storeInfo.openTime,
            endTime: request.endTime || storeInfo.closeTime,
            status: SHIFT_STATUS.DRAFT,
            creationMethod: SHIFT_CREATION.AUTO
          };
          schedules.push(shift);
          if (!assignedMap[date]) assignedMap[date] = [];
          assignedMap[date].push(staff.id);
          staffShiftMap[staff.id][date] = shift;
        }
      }
    }

    // ========================================
    // Step 2: 各日の人数チェック・不足日特定
    // ========================================
    var shortages = []; // { date, period, needed, current }

    for (var dk = 0; dk < dates.length; dk++) {
      var d = dates[dk];
      var assigned = assignedMap[d] || [];

      // ランチ帯の人数
      var lunchCount = 0;
      var dinnerCount = 0;
      for (var ac = 0; ac < assigned.length; ac++) {
        var s = staffShiftMap[assigned[ac]][d];
        if (s) {
          var sMin = timeToMinutes(s.startTime);
          var eMin = timeToMinutes(s.endTime);
          var lsMin = timeToMinutes(storeInfo.lunchStart);
          var leMin = timeToMinutes(storeInfo.lunchEnd);
          var dsMin = timeToMinutes(storeInfo.dinnerStart);
          var deMin = timeToMinutes(storeInfo.dinnerEnd);

          if (sMin < leMin && eMin > lsMin) lunchCount++;
          if (sMin < deMin && eMin > dsMin) dinnerCount++;
        }
      }

      if (lunchCount < storeInfo.minStaffLunch) {
        shortages.push({
          date: d,
          period: 'ランチ',
          needed: storeInfo.minStaffLunch,
          current: lunchCount,
          startTime: storeInfo.lunchStart,
          endTime: storeInfo.lunchEnd
        });
      }
      if (dinnerCount < storeInfo.minStaffDinner) {
        shortages.push({
          date: d,
          period: 'ディナー',
          needed: storeInfo.minStaffDinner,
          current: dinnerCount,
          startTime: storeInfo.dinnerStart,
          endTime: storeInfo.dinnerEnd
        });
      }
    }

    // ========================================
    // Step 3: 不足日を補充
    // ========================================
    for (var sh = 0; sh < shortages.length; sh++) {
      var shortage = shortages[sh];
      var shortDate = shortage.date;
      var need = shortage.needed - shortage.current;

      // 候補スタッフを集める
      var candidates = [];

      for (var ci = 0; ci < allStaff.length; ci++) {
        var candidate = allStaff[ci];
        var alreadyAssigned = (assignedMap[shortDate] || []).indexOf(candidate.id) >= 0;
        if (alreadyAssigned) continue;

        // 休み希望の人はスキップ
        var candReq = (requestMap[candidate.id] || {})[shortDate];
        if (candReq && candReq.type === REQUEST_TYPES.OFF) continue;

        // 優先度: 「どちらでも」> 未入力
        var priority = candReq && candReq.type === REQUEST_TYPES.EITHER ? 1 : 2;

        // 制約チェック
        if (!checkConstraints(candidate.id, shortDate, shortage.startTime, shortage.endTime, staffShiftMap, candidate.weeklyLimit)) {
          continue;
        }

        candidates.push({ staffId: candidate.id, priority: priority });
      }

      // 優先度順にソート
      candidates.sort(function(a, b) { return a.priority - b.priority; });

      // 不足分を埋める
      for (var fi = 0; fi < Math.min(need, candidates.length); fi++) {
        var fillStaff = candidates[fi];
        var fillShift = {
          staffId: fillStaff.staffId,
          date: shortDate,
          startTime: shortage.startTime,
          endTime: shortage.endTime,
          status: SHIFT_STATUS.DRAFT,
          creationMethod: SHIFT_CREATION.AUTO
        };
        schedules.push(fillShift);
        if (!assignedMap[shortDate]) assignedMap[shortDate] = [];
        assignedMap[shortDate].push(fillStaff.staffId);
        staffShiftMap[fillStaff.staffId][shortDate] = fillShift;
      }

      // まだ足りない場合は警告
      var filled = Math.min(need, candidates.length);
      if (filled < need) {
        var dayOfWeek = getDayOfWeek(shortDate);
        var parts = shortDate.split('-');
        var warnMsg = parseInt(parts[1]) + '/' + parseInt(parts[2]) + '（' + dayOfWeek + '）' +
          shortage.period + ': 必要' + shortage.needed + '人に対して' +
          (shortage.current + filled) + '人しか確保できません';
        warnings.push(warnMsg);
      }
    }

    // ========================================
    // Step 4: 結果をシートに書き込む
    // ========================================
    if (schedules.length > 0) {
      saveShiftSchedules(yearMonth, schedules);
      addLog('管理者', 'シフト自動作成', yearMonth + ' ' + schedules.length + '件');
    }

    return {
      success: true,
      warnings: warnings,
      message: schedules.length + '件のシフトを作成しました' +
        (warnings.length > 0 ? '（' + warnings.length + '件の警告あり）' : '')
    };

  } catch (e) {
    return { success: false, warnings: [], message: 'エラー: ' + e.message };
  }
}

/**
 * 制約チェック（内部関数）
 */
function checkConstraints(staffId, date, startTime, endTime, staffShiftMap, weeklyLimit) {
  var shifts = staffShiftMap[staffId] || {};

  // 連勤チェック（6日以内）
  var consecutive = 0;
  for (var c = -6; c <= 6; c++) {
    var checkDate = addDays(date, c);
    if (shifts[checkDate] || (c === 0)) {
      consecutive++;
      if (consecutive > TIME_CONFIG.MAX_CONSECUTIVE_DAYS) return false;
    } else {
      consecutive = 0;
    }
  }

  // インターバルチェック（前日との間隔）
  var prevDate = addDays(date, -1);
  if (shifts[prevDate]) {
    var prevEnd = timeToMinutes(shifts[prevDate].endTime);
    var thisStart = timeToMinutes(startTime);
    var intervalMinutes = (24 * 60 - prevEnd) + thisStart;
    if (intervalMinutes < TIME_CONFIG.MIN_INTERVAL_HOURS * 60) return false;
  }

  // 週上限チェック
  var monday = getMonday(date);
  var weekTotal = 0;
  for (var w = 0; w < 7; w++) {
    var weekDate = addDays(monday, w);
    if (shifts[weekDate]) {
      weekTotal += calcHoursDiff(shifts[weekDate].startTime, shifts[weekDate].endTime);
    }
  }
  var newHours = calcHoursDiff(startTime, endTime);
  if (weekTotal + newHours > (weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT)) return false;

  return true;
}

/**
 * 日付に日数を加算する（内部関数）
 */
function addDays(dateStr, days) {
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * 確定シフト表を取得する
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} シフトデータ
 */
function getShiftSchedule(yearMonth) {
  return getShiftSchedules(yearMonth);
}

/**
 * 自分の確定シフトを取得する
 * @param {string} staffId - スタッフID
 * @param {string} yearMonth - 対象年月
 * @return {Object[]} シフトデータ
 */
function getMyShift(staffId, yearMonth) {
  var all = getShiftSchedules(yearMonth);
  var mine = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].staffId === staffId) {
      mine.push(all[i]);
    }
  }
  return mine;
}

/**
 * シフト1件を更新する
 * @param {string} shiftId - シフトID
 * @param {Object} data - 更新データ
 * @return {Object} {success, message}
 */
function updateShiftEntry(shiftId, data) {
  try {
    var result = updateShiftScheduleEntry(shiftId, data);
    if (result) {
      addLog('管理者', 'シフト編集', shiftId);
      return { success: true, message: '更新しました' };
    }
    return { success: false, message: 'シフトが見つかりません' };
  } catch (e) {
    return { success: false, message: 'エラー: ' + e.message };
  }
}

/**
 * シフト1件を追加する
 * @param {Object} data - シフトデータ
 * @return {Object} {success, shiftId, message}
 */
function addShiftEntry(data) {
  try {
    var shiftId = addShiftScheduleEntry(data);
    addLog('管理者', 'シフト追加', data.staffId + ' ' + data.date);
    return { success: true, shiftId: shiftId, message: '追加しました' };
  } catch (e) {
    return { success: false, message: 'エラー: ' + e.message };
  }
}

/**
 * シフト1件を削除する
 * @param {string} shiftId - シフトID
 * @return {Object} {success, message}
 */
function deleteShiftEntry(shiftId) {
  try {
    var result = deleteShiftScheduleEntry(shiftId);
    if (result) {
      addLog('管理者', 'シフト削除', shiftId);
      return { success: true, message: '削除しました' };
    }
    return { success: false, message: 'シフトが見つかりません' };
  } catch (e) {
    return { success: false, message: 'エラー: ' + e.message };
  }
}

/**
 * シフトを確定する
 * @param {string} yearMonth - 対象年月
 * @return {Object} {success, message}
 */
function finalizeShift(yearMonth) {
  try {
    updateShiftStatus(yearMonth, SHIFT_STATUS.CONFIRMED);
    addLog('管理者', 'シフト確定', yearMonth);
    return { success: true, message: yearMonth + 'のシフトを確定しました' };
  } catch (e) {
    return { success: false, message: 'エラー: ' + e.message };
  }
}
