/**
 * ぎゅう丸シフト管理システム - 設定値・定数定義
 */

// シート名の定数
var SHEET_NAMES = {
  SETTINGS: '設定',
  STAFF: 'スタッフマスタ',
  SHIFT_REQUEST: 'シフト希望',
  SHIFT_SCHEDULE: '確定シフト',
  LABOR_COST: '人件費',
  LOG: 'ログ'
};

// 設定シートのキー名（A列に入る項目名）
var SETTING_KEYS = {
  STORE_NAME: '店舗名',
  STORE_CODE: '店舗コード',
  STORE_TYPE: '店舗区分',
  OPEN_TIME: '営業開始時間',
  CLOSE_TIME: '営業終了時間',
  LUNCH_START: 'ランチ開始',
  LUNCH_END: 'ランチ終了',
  DINNER_START: 'ディナー開始',
  DINNER_END: 'ディナー終了',
  MIN_STAFF_LUNCH: '最少人数_ランチ',
  MIN_STAFF_DINNER: '最少人数_ディナー',
  REQUEST_DEADLINE_DAY: '希望締切日',
  LINE_CHANNEL_TOKEN: 'LINE_CHANNEL_TOKEN',
  ADMIN_PASSWORD: '管理者パスワード'
};

// 雇用区分
var EMPLOYMENT_TYPES = {
  FULL_TIME: '正社員',
  PART_TIME: 'アルバイト',
  PART_TIMER: 'パート'
};

// シフト希望の区分
var REQUEST_TYPES = {
  WORK: '出勤希望',
  OFF: '休み希望',
  EITHER: 'どちらでも'
};

// 確定シフトのステータス
var SHIFT_STATUS = {
  DRAFT: '仮',
  CONFIRMED: '確定',
  CHANGED: '変更あり'
};

// シフト作成方法
var SHIFT_CREATION = {
  AUTO: '自動',
  MANUAL: '手動'
};

// スタッフのステータス
var STAFF_STATUS = {
  ACTIVE: '在籍',
  RETIRED: '退職'
};

// デザインカラー
var COLORS = {
  BASE: '#FAF7F2',
  MAIN: '#4A3323',
  ACCENT: '#BE2828',
  LIGHT_BROWN: '#8B6F5E',
  LIGHT_BEIGE: '#F0E8DC',
  WHITE: '#FFFFFF',
  LIGHT_GREEN: '#E8F5E9',
  LIGHT_RED: '#FFEBEE',
  LIGHT_YELLOW: '#FFF8E1'
};

// 時間関連の定数
var TIME_CONFIG = {
  SLOT_INTERVAL: 30,         // 時間選択の刻み（分）
  EARLIEST_HOUR: 6,          // 最も早い選択可能時刻
  LATEST_HOUR: 24,           // 最も遅い選択可能時刻
  MAX_CONSECUTIVE_DAYS: 6,   // 最大連勤日数
  MIN_INTERVAL_HOURS: 11,    // 勤務間インターバル（時間）
  WEEKLY_HOUR_LIMIT: 40,     // 週の労働時間上限
  BREAK_THRESHOLD_6H: 45,    // 6時間超の休憩時間（分）
  BREAK_THRESHOLD_8H: 60,    // 8時間超の休憩時間（分）
  LATE_NIGHT_START: 22,      // 深夜時間帯開始
  LATE_NIGHT_END: 5,         // 深夜時間帯終了
  OVERTIME_RATE: 0.25,       // 残業手当割増率
  LATE_NIGHT_RATE: 0.25      // 深夜手当割増率
};

// 店舗一覧（参考情報）
var STORE_LIST = [
  { code: 'URESHINO', name: '嬉野本店', type: '直営' },
  { code: 'OMURA', name: '大村店', type: '直営' },
  { code: 'COCOWALK', name: '長崎ココウォーク店', type: '直営' },
  { code: 'SASEBO', name: 'させぼ五番街店', type: '直営' },
  { code: 'LALAPORT', name: 'ららぽーと福岡店', type: '直営' },
  { code: 'YUMETOWNH', name: 'ゆめタウン博多店', type: '直営' },
  { code: 'ITO', name: '伊都店', type: '直営' },
  { code: 'AEONF', name: 'イオンモール福岡店', type: '直営' },
  { code: 'IMARI', name: '伊万里店', type: '社内独立' },
  { code: 'IIZUKA', name: '飯塚店', type: '社内独立' },
  { code: 'HARUYOSHI', name: '春吉店', type: 'FC' },
  { code: 'ISAHAYA', name: '諫早店', type: 'FC' },
  { code: 'DAIMYO', name: '大名店', type: 'FC' }
];
