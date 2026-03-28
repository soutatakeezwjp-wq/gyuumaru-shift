// ぎゅう丸シフト管理システム - LINE通知サービス（LineNotifyService.gs の移植）

import * as dao from '../db/dao';
import { SETTING_KEYS } from '../config';
import { getRequestSummary } from './shift-request';
import type { ApiResult } from '../types';

// シフト確定通知を送信する
export async function sendShiftConfirmNotification(
  db: D1Database, storeId: number, yearMonth: string, baseUrl: string
): Promise<ApiResult> {
  const settings = await dao.getSettings(db, storeId);
  const token = settings[SETTING_KEYS.LINE_CHANNEL_TOKEN];
  const storeName = settings[SETTING_KEYS.STORE_NAME] || 'ぎゅう丸';

  if (!token) {
    return { success: false, message: 'LINE Channel Tokenが設定されていません。設定を確認してください。' };
  }

  const parts = yearMonth.split('-');
  const month = parseInt(parts[1]);

  const message = '【' + storeName + '】\n' +
    month + '月のシフトが確定しました!\n\n' +
    '下記URLから確認してください。\n' +
    baseUrl + '\n\n' +
    '※変更がある場合は店長までご連絡ください。';

  await sendLineBroadcast(token, message);
  await dao.addLog(db, storeId, '管理者', 'LINE通知送信', 'シフト確定通知 ' + yearMonth);

  return { success: true, message: 'LINE通知を送信しました' };
}

// シフト希望リマインド通知を送信する
export async function sendReminderNotification(
  db: D1Database, storeId: number, yearMonth: string, baseUrl: string
): Promise<ApiResult> {
  const settings = await dao.getSettings(db, storeId);
  const token = settings[SETTING_KEYS.LINE_CHANNEL_TOKEN];
  const storeName = settings[SETTING_KEYS.STORE_NAME] || 'ぎゅう丸';
  const deadlineDay = settings[SETTING_KEYS.REQUEST_DEADLINE_DAY] || '20';

  if (!token) {
    return { success: false, message: 'LINE Channel Tokenが設定されていません' };
  }

  const parts = yearMonth.split('-');
  const month = parseInt(parts[1]);
  let prevMonth = month - 1;
  if (prevMonth === 0) prevMonth = 12;

  const summary = await getRequestSummary(db, storeId, yearMonth);
  const notSubmittedNames = summary.notSubmitted.map(s => s.name);

  let message = '【' + storeName + '】\n' +
    month + '月のシフト希望の提出期限が近づいています。\n\n' +
    '締切: ' + prevMonth + '月' + deadlineDay + '日\n';

  if (notSubmittedNames.length > 0) {
    message += '\n未提出の方:\n' + notSubmittedNames.join('、') + '\n';
  }

  message += '\n早めに提出をお願いします!\n' + baseUrl;

  await sendLineBroadcast(token, message);
  await dao.addLog(db, storeId, '管理者', 'LINE通知送信', 'リマインド通知 ' + yearMonth);

  return { success: true, message: 'リマインド通知を送信しました' };
}

// LINE通知テスト送信
export async function testLineNotification(db: D1Database, storeId: number): Promise<ApiResult> {
  const settings = await dao.getSettings(db, storeId);
  const token = settings[SETTING_KEYS.LINE_CHANNEL_TOKEN];
  const storeName = settings[SETTING_KEYS.STORE_NAME] || 'ぎゅう丸';

  if (!token) {
    return { success: false, message: 'LINE Channel Tokenが設定されていません' };
  }

  const message = '【' + storeName + '】\nLINE通知のテストです。このメッセージが届いていれば、設定は正常です。';

  await sendLineBroadcast(token, message);
  return { success: true, message: 'テスト通知を送信しました' };
}

// LINE Messaging API でブロードキャストメッセージを送信する（内部関数）
async function sendLineBroadcast(channelToken: string, message: string): Promise<void> {
  const url = 'https://api.line.me/v2/bot/message/broadcast';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + channelToken,
    },
    body: JSON.stringify({
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error('LINE API エラー (HTTP ' + response.status + '): ' + body);
  }
}
