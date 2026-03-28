/**
 * ぎゅう丸シフト管理システム - LINE Messaging API 通知サービス
 *
 * LINE Notifyは2025年3月でサービス終了のため、LINE Messaging APIを使用。
 * 各店舗でLINE公式アカウントを作成し、Channel Access Tokenを設定シートに保存する。
 */

/**
 * シフト確定通知を送信する
 * @param {string} yearMonth - 対象年月
 * @return {Object} {success, message}
 */
function sendShiftConfirmNotification(yearMonth) {
  try {
    var settings = getSettings();
    var token = settings[SETTING_KEYS.LINE_CHANNEL_TOKEN];
    var storeName = settings[SETTING_KEYS.STORE_NAME] || 'ぎゅう丸';

    if (!token) {
      return { success: false, message: 'LINE Channel Tokenが設定されていません。設定シートを確認してください。' };
    }

    var parts = yearMonth.split('-');
    var month = parseInt(parts[1]);

    // Webアプリの URL を取得
    var webAppUrl = ScriptApp.getService().getUrl();

    var message = '【' + storeName + '】\n' +
      month + '月のシフトが確定しました！\n\n' +
      '下記URLから確認してください。\n' +
      webAppUrl + '\n\n' +
      '※変更がある場合は店長までご連絡ください。';

    sendLineBroadcast(token, message);
    addLog('管理者', 'LINE通知送信', 'シフト確定通知 ' + yearMonth);

    return { success: true, message: 'LINE通知を送信しました' };

  } catch (e) {
    return { success: false, message: 'LINE通知の送信に失敗しました: ' + e.message };
  }
}

/**
 * シフト希望リマインド通知を送信する
 * @param {string} yearMonth - 対象年月
 * @return {Object} {success, message}
 */
function sendReminderNotification(yearMonth) {
  try {
    var settings = getSettings();
    var token = settings[SETTING_KEYS.LINE_CHANNEL_TOKEN];
    var storeName = settings[SETTING_KEYS.STORE_NAME] || 'ぎゅう丸';
    var deadlineDay = settings[SETTING_KEYS.REQUEST_DEADLINE_DAY] || 20;

    if (!token) {
      return { success: false, message: 'LINE Channel Tokenが設定されていません' };
    }

    var parts = yearMonth.split('-');
    var month = parseInt(parts[1]);
    var prevMonth = month - 1;
    if (prevMonth === 0) prevMonth = 12;

    // 未提出者を取得
    var summary = getRequestSummary(yearMonth);
    var notSubmittedNames = [];
    for (var i = 0; i < summary.notSubmitted.length; i++) {
      notSubmittedNames.push(summary.notSubmitted[i].name);
    }

    var webAppUrl = ScriptApp.getService().getUrl();

    var message = '【' + storeName + '】\n' +
      month + '月のシフト希望の提出期限が近づいています。\n\n' +
      '締切: ' + prevMonth + '月' + deadlineDay + '日\n';

    if (notSubmittedNames.length > 0) {
      message += '\n未提出の方:\n' + notSubmittedNames.join('、') + '\n';
    }

    message += '\n早めに提出をお願いします！\n' + webAppUrl;

    sendLineBroadcast(token, message);
    addLog('管理者', 'LINE通知送信', 'リマインド通知 ' + yearMonth);

    return { success: true, message: 'リマインド通知を送信しました' };

  } catch (e) {
    return { success: false, message: 'LINE通知の送信に失敗しました: ' + e.message };
  }
}

/**
 * LINE通知テスト送信
 * @return {Object} {success, message}
 */
function testLineNotification() {
  try {
    var settings = getSettings();
    var token = settings[SETTING_KEYS.LINE_CHANNEL_TOKEN];
    var storeName = settings[SETTING_KEYS.STORE_NAME] || 'ぎゅう丸';

    if (!token) {
      return { success: false, message: 'LINE Channel Tokenが設定されていません' };
    }

    var message = '【' + storeName + '】\nLINE通知のテストです。このメッセージが届いていれば、設定は正常です。';

    sendLineBroadcast(token, message);

    return { success: true, message: 'テスト通知を送信しました' };
  } catch (e) {
    return { success: false, message: 'テスト送信に失敗しました: ' + e.message };
  }
}

/**
 * LINE Messaging API でブロードキャストメッセージを送信する（内部関数）
 * （公式アカウントの友だち全員に送信）
 * @param {string} channelToken - Channel Access Token
 * @param {string} message - 送信メッセージ
 */
function sendLineBroadcast(channelToken, message) {
  var url = 'https://api.line.me/v2/bot/message/broadcast';

  var payload = {
    messages: [
      {
        type: 'text',
        text: message
      }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + channelToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    var responseBody = response.getContentText();
    throw new Error('LINE API エラー (HTTP ' + responseCode + '): ' + responseBody);
  }
}

/**
 * タイムトリガー用：締切3日前にリマインドを自動送信する
 * （GASのトリガーに設定して日次実行する）
 */
function autoSendReminder() {
  var settings = getSettings();
  var deadlineDay = parseInt(settings[SETTING_KEYS.REQUEST_DEADLINE_DAY]) || 20;

  var today = new Date();
  var todayDay = today.getDate();

  // 締切3日前かチェック
  if (todayDay === deadlineDay - 3) {
    // 来月分のリマインド
    var nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    var yearMonth = formatYearMonth(nextMonth);

    sendReminderNotification(yearMonth);
  }
}
