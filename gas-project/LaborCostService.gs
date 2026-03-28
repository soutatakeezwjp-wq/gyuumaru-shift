/**
 * ぎゅう丸シフト管理システム - 人件費計算サービス
 */

/**
 * 月間人件費を計算する
 * @param {string} yearMonth - 対象年月
 * @return {Object} {success, staffCosts[], totalCost, message}
 */
function calculateLaborCost(yearMonth) {
  try {
    var schedules = getShiftSchedules(yearMonth);
    var allStaff = getAllStaffData(true);

    if (schedules.length === 0) {
      return {
        success: false,
        staffCosts: [],
        totalCost: 0,
        message: 'この月の確定シフトがありません'
      };
    }

    // スタッフ情報をマップ化
    var staffMap = {};
    for (var i = 0; i < allStaff.length; i++) {
      staffMap[allStaff[i].id] = allStaff[i];
    }

    // スケジュールをスタッフごとにグループ化
    var staffSchedules = {};
    for (var j = 0; j < schedules.length; j++) {
      var s = schedules[j];
      if (!staffSchedules[s.staffId]) staffSchedules[s.staffId] = [];
      staffSchedules[s.staffId].push(s);
    }

    var staffCosts = [];
    var totalCost = 0;

    for (var staffId in staffSchedules) {
      var staff = staffMap[staffId];
      if (!staff) continue;

      var shifts = staffSchedules[staffId];
      var cost = calcStaffCost(staff, shifts, yearMonth);
      staffCosts.push(cost);
      totalCost += cost.totalCost;
    }

    // スプレッドシートに保存
    saveLaborCosts(yearMonth, staffCosts);
    addLog('管理者', '人件費計算', yearMonth + ' 合計: ' + totalCost + '円');

    return {
      success: true,
      staffCosts: staffCosts,
      totalCost: totalCost,
      message: '人件費を計算しました（合計: ' + totalCost.toLocaleString() + '円）'
    };

  } catch (e) {
    return {
      success: false,
      staffCosts: [],
      totalCost: 0,
      message: 'エラー: ' + e.message
    };
  }
}

/**
 * スタッフ1人分の人件費を計算する（内部関数）
 * @param {Object} staff - スタッフ情報
 * @param {Object[]} shifts - そのスタッフのシフト配列
 * @param {string} yearMonth - 対象年月
 * @return {Object} 人件費データ
 */
function calcStaffCost(staff, shifts, yearMonth) {
  var totalMinutes = 0;
  var lateNightMinutes = 0;
  var workDays = shifts.length;

  // 週ごとの労働時間を集計（残業手当計算用）
  var weeklyMinutes = {}; // { '月曜日の日付': 合計分 }

  for (var i = 0; i < shifts.length; i++) {
    var shift = shifts[i];
    var startMin = timeToMinutes(shift.startTime);
    var endMin = timeToMinutes(shift.endTime);
    if (endMin <= startMin) endMin += 24 * 60;

    // 拘束時間
    var totalWorkMin = endMin - startMin;

    // 休憩を引く
    var breakMin = calcBreakMinutes(totalWorkMin / 60);
    var actualWorkMin = totalWorkMin - breakMin;
    totalMinutes += actualWorkMin;

    // 深夜時間の計算（22:00-翌5:00）
    var lateStart = TIME_CONFIG.LATE_NIGHT_START * 60; // 22:00 = 1320分
    var lateEnd = (24 + TIME_CONFIG.LATE_NIGHT_END) * 60; // 翌5:00 = 1740分

    // シフト時間と深夜帯の重なりを計算
    var overlapStart = Math.max(startMin, lateStart);
    var overlapEnd = Math.min(endMin, lateEnd);
    if (overlapEnd > overlapStart) {
      lateNightMinutes += (overlapEnd - overlapStart);
    }

    // 週ごとの集計
    var monday = getMonday(shift.date);
    if (!weeklyMinutes[monday]) weeklyMinutes[monday] = 0;
    weeklyMinutes[monday] += actualWorkMin;
  }

  var totalHours = Math.round(totalMinutes / 60 * 100) / 100;
  var lateNightHours = Math.round(lateNightMinutes / 60 * 100) / 100;

  // 基本給計算
  var basePay = 0;
  if (staff.employmentType === EMPLOYMENT_TYPES.FULL_TIME) {
    basePay = staff.monthlySalary || 0;
  } else {
    basePay = Math.round((staff.hourlyRate || 0) * totalHours);
  }

  // 深夜手当（22時以降の時間 x 時給 x 25%）
  var lateNightPay = 0;
  if (lateNightHours > 0 && staff.employmentType !== EMPLOYMENT_TYPES.FULL_TIME) {
    lateNightPay = Math.round((staff.hourlyRate || 0) * lateNightHours * TIME_CONFIG.LATE_NIGHT_RATE);
  }

  // 残業手当（週40時間超過分 x 時給 x 25%）
  var overtimePay = 0;
  if (staff.employmentType !== EMPLOYMENT_TYPES.FULL_TIME) {
    var weeklyLimit = (staff.weeklyLimit || TIME_CONFIG.WEEKLY_HOUR_LIMIT) * 60;
    for (var week in weeklyMinutes) {
      if (weeklyMinutes[week] > weeklyLimit) {
        var overtimeMin = weeklyMinutes[week] - weeklyLimit;
        overtimePay += Math.round((staff.hourlyRate || 0) * (overtimeMin / 60) * TIME_CONFIG.OVERTIME_RATE);
      }
    }
  }

  // 交通費
  var transportTotal = workDays * (staff.transportDaily || 0);

  // 合計
  var totalCostValue = basePay + lateNightPay + overtimePay + transportTotal;

  return {
    staffId: staff.id,
    name: staff.name,
    employmentType: staff.employmentType,
    totalHours: totalHours,
    basePay: basePay,
    lateNightPay: lateNightPay,
    overtimePay: overtimePay,
    transportTotal: transportTotal,
    totalCost: totalCostValue
  };
}

/**
 * 保存済みの人件費レポートを取得する
 * @param {string} yearMonth - 対象年月
 * @return {Object} {staffCosts[], totalCost}
 */
function getLaborCostReport(yearMonth) {
  var costs = getLaborCosts(yearMonth);
  var totalCost = 0;
  for (var i = 0; i < costs.length; i++) {
    totalCost += costs[i].totalCost || 0;
  }
  return {
    staffCosts: costs,
    totalCost: totalCost
  };
}
