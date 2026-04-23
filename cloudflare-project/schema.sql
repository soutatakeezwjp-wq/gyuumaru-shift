-- ぎゅう丸シフト管理システム D1スキーマ
-- 全テーブルに store_id でマルチテナント対応

-- 店舗マスタ
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '直営'
);

-- 店舗設定
CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (store_id) REFERENCES stores(id),
  UNIQUE(store_id, key)
);

-- スタッフマスタ
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kana TEXT DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT 'アルバイト',
  position TEXT DEFAULT 'ホール',
  hourly_rate INTEGER DEFAULT 0,
  monthly_salary INTEGER DEFAULT 0,
  transport_daily INTEGER DEFAULT 0,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  line_user_id TEXT DEFAULT '',
  join_date TEXT DEFAULT '',
  weekly_limit INTEGER DEFAULT 40,
  fixed_off TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '在籍',
  memo TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- シフト希望
CREATE TABLE IF NOT EXISTS shift_requests (
  id TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL,
  staff_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  note TEXT DEFAULT '',
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- 確定シフト
CREATE TABLE IF NOT EXISTS shift_schedules (
  id TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL,
  staff_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  work_hours REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '仮',
  creation_method TEXT NOT NULL DEFAULT '手動',
  confirmed_at TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- 人件費
CREATE TABLE IF NOT EXISTS labor_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  year_month TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  name TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  total_hours REAL DEFAULT 0,
  base_pay INTEGER DEFAULT 0,
  late_night_pay INTEGER DEFAULT 0,
  overtime_pay INTEGER DEFAULT 0,
  transport_total INTEGER DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  calculated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- ログ
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  datetime TEXT NOT NULL,
  operator TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT DEFAULT '',
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- ヘルプ募集（不足告知URL）
CREATE TABLE IF NOT EXISTS help_campaigns (
  id TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL,
  year_month TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'ヘルプ募集',
  message TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- ヘルプ応募
CREATE TABLE IF NOT EXISTS help_applications (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  store_id INTEGER NOT NULL,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '申請中',
  note TEXT NOT NULL DEFAULT '',
  applied_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (campaign_id) REFERENCES help_campaigns(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- インデックス（検索高速化）
CREATE INDEX IF NOT EXISTS idx_staff_store ON staff(store_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_store_month ON shift_requests(store_id, year_month);
CREATE INDEX IF NOT EXISTS idx_requests_staff_month ON shift_requests(staff_id, year_month);
CREATE INDEX IF NOT EXISTS idx_schedules_store_month ON shift_schedules(store_id, year_month);
CREATE INDEX IF NOT EXISTS idx_schedules_staff_month ON shift_schedules(staff_id, year_month);
CREATE INDEX IF NOT EXISTS idx_labor_store_month ON labor_costs(store_id, year_month);
CREATE INDEX IF NOT EXISTS idx_logs_store ON logs(store_id);
CREATE INDEX IF NOT EXISTS idx_help_campaigns_store_month ON help_campaigns(store_id, year_month);
CREATE INDEX IF NOT EXISTS idx_help_apps_campaign ON help_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_help_apps_store_status ON help_applications(store_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_help_apps_unique ON help_applications(campaign_id, staff_id, date, start_time, end_time);
