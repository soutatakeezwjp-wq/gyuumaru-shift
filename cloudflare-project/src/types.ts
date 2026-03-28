// ぎゅう丸シフト管理システム - 型定義

// Cloudflare Workers の環境変数
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
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

// API共通レスポンス
export interface ApiResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}
