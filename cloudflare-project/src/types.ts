// ぎゅう丸シフト管理システム - 型定義

// Cloudflare Workers の環境変数
// ※ Supabase 移行後は D1 を使わず、SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY で接続する
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  // 店舗ごとの専用デプロイで使う任意の設定
  // STORE_CODE  : この値が設定されていればフロントは店舗選択をスキップ（例: "URESHINO"）
  // INITIAL_PAGE: "hq" を指定すると本部画面（/hq.html）に自動リダイレクト
  STORE_CODE?: string;
  INITIAL_PAGE?: string;
}

// 認証ロール（3階層）
export type UserRole = 'headquarters_admin' | 'store_manager' | 'staff';

// 管理者・店長アカウント
export interface ManagerAccount {
  id: string;
  email: string;
  name: string;
  role: 'headquarters_admin' | 'store_manager';
  storeId: number | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

// 店舗
export interface Store {
  id: number;
  code: string;
  name: string;
  type: string;
}

// 店舗設定
export interface StoreSettings {
  [key: string]: string;
}

// 時間帯別必要人数
export interface TimeSlotStaffing {
  start: string;
  end: string;
  hall: number;
  kitchen: number;
  label?: string;
  weekdayHall?: number;
  weekdayKitchen?: number;
  weekendHall?: number;
  weekendKitchen?: number;
}

// 1-1: ピークタイム手当（時間帯ごとの追加時給）
export interface PeakHourBonus {
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
  bonus: number; // 円/時間
  label?: string;
}

// 店舗情報（フロントエンド向け）
export interface StoreInfo {
  storeName: string;
  storeCode: string;
  storeType: string;
  openTime: string;
  closeTime: string;
  lunchStart: string;
  lunchEnd: string;
  dinnerStart: string;
  dinnerEnd: string;
  minStaffLunch: number;
  minStaffDinner: number;
  weekdayHallMin: number;
  weekdayKitchenMin: number;
  weekendHallMin: number;
  weekendKitchenMin: number;
  fulltimeMonthlyLimit: number;
  requestDeadlineDay: number;
  timeSlotStaffing: TimeSlotStaffing[];
  // 1-1, 1-2, 1-3: 店舗別の手当設定
  peakHourBonuses: PeakHourBonus[];
  weekendBonusPerHour: number;
  weekdayBonusPerHour: number;
}

// スタッフ
export interface StaffData {
  id: string;
  name: string;
  kana: string;
  employmentType: string;
  position: string;
  hourlyRate: number;
  monthlySalary: number;
  transportDaily: number;
  phone: string;
  email: string;
  lineUserId: string;
  joinDate: string;
  weeklyLimit: number;
  fixedOff: string;
  status: string;
  memo: string;
}

// スタッフ一覧用（軽量版）
export interface StaffListItem {
  id: string;
  name: string;
  kana: string;
  position: string;
}

// シフト希望
export interface ShiftRequest {
  id: string;
  staffId: string;
  yearMonth: string;
  date: string;
  type: string;
  startTime: string;
  endTime: string;
  note: string;
  submittedAt: string;
  updatedAt: string;
}

// シフト希望の入力データ
export interface ShiftRequestInput {
  date: string;
  type: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}

// 確定シフト
export interface ShiftSchedule {
  id: string;
  staffId: string;
  yearMonth: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workHours: number;
  status: string;
  creationMethod: string;
  confirmedAt: string;
  updatedAt: string;
}

// 人件費データ
export interface LaborCostData {
  staffId: string;
  name: string;
  employmentType: string;
  position: string;
  totalHours: number;
  basePay: number;
  lateNightPay: number;
  overtimePay: number;
  // 1-1: ピーク手当（時間帯別追加時給）の合計
  peakBonusPay: number;
  // 1-2: 曜日手当（土日祝の追加時給）の合計
  weekendBonusPay: number;
  transportTotal: number;
  totalCost: number;
  monthlyLimit?: number;
  isOverLimit?: boolean;
  isDanger?: boolean;
}

// 希望サマリー
export interface RequestSummary {
  totalStaff: number;
  submittedCount: number;
  notSubmitted: StaffListItem[];
  dailySummary: { [date: string]: { work: number; off: number; either: number; total: number } };
}

// 5-3 社労士CSV取込用の給与明細
export interface Payslip {
  id?: number;
  storeId: number;
  staffId: string;
  yearMonth: string;
  data: Record<string, string | number>; // CSVヘッダ→値
  uploadedAt?: string;
}

// API共通レスポンス
export interface ApiResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}
