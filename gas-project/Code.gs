/**
 * ぎゅう丸シフト管理システム - メインエントリポイント
 *
 * Webアプリとしてデプロイすると、このファイルのdoGet関数がリクエストを受け取る。
 * URLパラメータ ?mode=admin で管理者画面、それ以外はスタッフ画面を表示する。
 */

/**
 * Webアプリのエントリポイント
 * @param {Object} e - リクエストパラメータ
 * @return {HtmlOutput} HTML出力
 */
function doGet(e) {
  var mode = (e && e.parameter && e.parameter.mode) || 'staff';
  var template;

  if (mode === 'admin') {
    template = HtmlService.createTemplateFromFile('html/index');
    template.mode = 'admin';
  } else {
    template = HtmlService.createTemplateFromFile('html/index');
    template.mode = 'staff';
  }

  var output = template.evaluate();
  output.setTitle('ぎゅう丸 シフト管理');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return output;
}

/**
 * HTMLファイルをインクルードするためのヘルパー関数
 * （HTMLテンプレート内で <?!= include('filename') ?> として使用）
 * @param {string} filename - インクルードするファイル名
 * @return {string} HTMLコンテンツ
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 時間選択肢を取得する（フロントエンド用）
 * @return {string[]} 時刻文字列の配列
 */
function getTimeSlots() {
  return generateTimeSlots();
}
