// ぎゅう丸シフト管理システム - 設定値・定数定義（Config.gs の移植）

// 設定シートのキー名
export const SETTING_KEYS = {
  STORE_NAME: '店舗名',
  STORE_CODE: '店舗コード',
  STORE_TYPE: '店舗区分',
  OPEN_TIME: '営業開始',
  CLOSE_TIME: '営業終了',
  LUNCH_START: 'ランチ開始',
  LUNCH_END: 'ランチ終了',
  DINNER_START: 'ディナー開始',
  DINNER_END: 'ディナー終了',
  MIN_STAFF_LUNCH: 'ランチ最低人数',
  MIN_STAFF_DINNER: 'ディナー最低人数',
  REQUEST_DEADLINE_DAY: '希望提出締切日',
  LINE_CHANNEL_TOKEN: 'LINEチャネルトークン',
  ADMIN_PASSWORD: '管理者パスワード',
  WEEKDAY_HALL_MIN: '平日ホール最低人数',
  WEEKDAY_KITCHEN_MIN: '平日キッチン最低人数',
  WEEKEND_HALL_MIN: '土日ホール最低人数',
  WEEKEND_KITCHEN_MIN: '土日キッチン最低人数',
  FULLTIME_MONTHLY_LIMIT: '正社員月間上限時間',
  TIME_SLOT_STAFFING: '時間帯別必要人数',
} as const;

// ポジション（ホール/キッチン）
export const POSITIONS = {
  HALL: 'ホール',
  KITCHEN: 'キッチン',
} as const;

// 雇用区分
export const EMPLOYMENT_TYPES = {
  FULL_TIME: '正社員',
  PART_TIME: 'アルバイト',
  PART_TIMER: 'パート',
} as const;

// シフト希望の区分
export const REQUEST_TYPES = {
  WORK: '出勤希望',
  OFF: '休み希望',
  EITHER: 'どちらでも',
} as const;

// 確定シフトのステータス
export const SHIFT_STATUS = {
  DRAFT: '仮',
  CONFIRMED: '確定',
  CHANGED: '変更あり',
} as const;

// シフト作成方法
export const SHIFT_CREATION = {
  AUTO: '自動',
  MANUAL: '手動',
} as const;

// スタッフのステータス
export const STAFF_STATUS = {
  ACTIVE: '在籍',
  RETIRED: '退職',
} as const;

// 時間関連の定数
export const TIME_CONFIG = {
  SLOT_INTERVAL: 30,
  EARLIEST_HOUR: 6,
  LATEST_HOUR: 24,
  MAX_CONSECUTIVE_DAYS: 6,
  MIN_INTERVAL_HOURS: 11,
  WEEKLY_HOUR_LIMIT: 40,
  FULLTIME_WEEKLY_LIMIT: 60,
  FULLTIME_WEEKLY_DANGER: 70,
  BREAK_THRESHOLD_6H: 45,
  BREAK_THRESHOLD_8H: 60,
  LATE_NIGHT_START: 22,
  LATE_NIGHT_END: 5,
  OVERTIME_RATE: 0.25,
  LATE_NIGHT_RATE: 0.25,
  FULLTIME_MONTHLY_LIMIT: 240,
  FULLTIME_OVERTIME_RATE: 1.3,
  FULLTIME_DANGER_LINE: 280,
  FULLTIME_OVERTIME_THRESHOLD: 60,
} as const;

// 店舗一覧
export const STORE_LIST = [
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
  { code: 'DAIMYO', name: '大名店', type: 'FC' },
] as const;
