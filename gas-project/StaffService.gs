/**
 * ぎゅう丸シフト管理システム - スタッフ管理サービス
 */

/**
 * スタッフ詳細を取得する
 * @param {string} staffId - スタッフID
 * @return {Object|null} スタッフ情報
 */
function getStaffById(staffId) {
  return getStaffDataById(staffId);
}

/**
 * 全スタッフを取得する（在籍者のみ）
 * @return {Object[]} スタッフ一覧
 */
function getAllStaff() {
  return getAllStaffData(true);
}

/**
 * スタッフを新規登録する
 * @param {Object} staffData - スタッフ情報
 * @return {Object} {success, staffId, message}
 */
function addStaff(staffData) {
  try {
    if (!staffData.name) {
      return { success: false, message: '氏名は必須です' };
    }

    var staffId = addStaffData(staffData);
    addLog('管理者', 'スタッフ追加', staffData.name + ' (' + staffId + ')');

    return {
      success: true,
      staffId: staffId,
      message: staffData.name + 'さんを登録しました'
    };
  } catch (e) {
    return { success: false, message: 'エラー: ' + e.message };
  }
}

/**
 * スタッフ情報を更新する
 * @param {string} staffId - スタッフID
 * @param {Object} staffData - 更新データ
 * @return {Object} {success, message}
 */
function updateStaff(staffId, staffData) {
  try {
    var result = updateStaffData(staffId, staffData);
    if (result) {
      addLog('管理者', 'スタッフ更新', staffId);
      return { success: true, message: '更新しました' };
    }
    return { success: false, message: 'スタッフが見つかりません' };
  } catch (e) {
    return { success: false, message: 'エラー: ' + e.message };
  }
}

/**
 * スタッフを退職処理する（論理削除）
 * @param {string} staffId - スタッフID
 * @return {Object} {success, message}
 */
function retireStaff(staffId) {
  try {
    var staff = getStaffDataById(staffId);
    if (!staff) {
      return { success: false, message: 'スタッフが見つかりません' };
    }

    var result = updateStaffData(staffId, { status: STAFF_STATUS.RETIRED });
    if (result) {
      addLog('管理者', 'スタッフ退職', staff.name + ' (' + staffId + ')');
      return { success: true, message: staff.name + 'さんを退職処理しました' };
    }
    return { success: false, message: '処理に失敗しました' };
  } catch (e) {
    return { success: false, message: 'エラー: ' + e.message };
  }
}
