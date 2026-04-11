-- =====================================================================
-- ぎゅう丸シフト管理システム / Supabase (PostgreSQL) スキーマ
-- =====================================================================
-- このファイルを Supabase の SQL Editor に貼り付けて Run してください。
-- 既存の Cloudflare D1 (SQLite) 版から PostgreSQL 版に移行するための
-- 完全なスキーマ定義です。
--
-- 含まれる新機能:
--   1. スタッフ4桁PIN（pin_hash カラム）
--   2. シフトの覗き見・他人編集の防止（RLS + サーバー側ロール判定）
--   3. 退職処理の論理削除（status + retired_at + retired_by）
--   4. 3階層の権限（managers テーブル: headquarters_admin / store_manager）
--   5. 締切日後のシフト変更ロック（既存の request_deadline_day を活用）
-- =====================================================================

-- ---------- 既存テーブルがあれば一旦クリーン（開発用なので OK） ----------
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS labor_costs CASCADE;
DROP TABLE IF EXISTS shift_schedules CASCADE;
DROP TABLE IF EXISTS shift_requests CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS store_settings CASCADE;
DROP TABLE IF EXISTS managers CASCADE;
DROP TABLE IF EXISTS stores CASCADE;

-- =====================================================================
-- 1. 店舗マスタ
-- =====================================================================
CREATE TABLE stores (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT '直営',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. 店舗設定（key/value）
-- =====================================================================
CREATE TABLE store_settings (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  UNIQUE(store_id, key)
);

CREATE INDEX idx_settings_store ON store_settings(store_id);

-- =====================================================================
-- 3. スタッフ
--   ・新規: pin_hash（4桁PINのSHA-256ハッシュ）
--   ・新規: pin_failed_count, pin_locked_until（連続失敗ロック）
--   ・新規: retired_at, retired_by（退職処理の証跡）
-- =====================================================================
CREATE TABLE staff (
  id                TEXT PRIMARY KEY,
  store_id          INTEGER NOT NULL REFERENCES stores(id),
  name              TEXT NOT NULL,
  kana              TEXT DEFAULT '',
  employment_type   TEXT NOT NULL DEFAULT 'アルバイト',
  position          TEXT DEFAULT 'ホール',
  hourly_rate       INTEGER DEFAULT 0,
  monthly_salary    INTEGER DEFAULT 0,
  transport_daily   INTEGER DEFAULT 0,
  phone             TEXT DEFAULT '',
  email             TEXT DEFAULT '',
  line_user_id      TEXT DEFAULT '',
  join_date         TEXT DEFAULT '',
  weekly_limit      INTEGER DEFAULT 40,
  fixed_off         TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT '在籍',
  memo              TEXT DEFAULT '',
  -- 新機能 1: 4桁PIN（プレーンでは保存しない、ハッシュのみ）
  pin_hash          TEXT DEFAULT '',
  pin_updated_at    TIMESTAMPTZ,
  pin_failed_count  INTEGER NOT NULL DEFAULT 0,
  pin_locked_until  TIMESTAMPTZ,
  -- 新機能 3: 退職処理の論理削除
  retired_at        TIMESTAMPTZ,
  retired_by        TEXT,
  retired_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_store_status ON staff(store_id, status);
CREATE INDEX idx_staff_store_kana ON staff(store_id, kana);

-- =====================================================================
-- 4. 管理者・店長アカウント（新規テーブル）
--   role:
--     'headquarters_admin' = 本部管理者（全店舗を見られる）
--     'store_manager'      = 店長（自店舗のみ）
--   ※ 一般スタッフはこのテーブルではなく staff テーブル + pin_hash で認証
-- =====================================================================
CREATE TABLE managers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('headquarters_admin', 'store_manager')),
  store_id      INTEGER REFERENCES stores(id), -- headquarters_admin は NULL
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 本部管理者は store_id NULL、店長は店舗紐付け必須
  CONSTRAINT mgr_role_store_check CHECK (
    (role = 'headquarters_admin' AND store_id IS NULL) OR
    (role = 'store_manager' AND store_id IS NOT NULL)
  )
);

CREATE INDEX idx_managers_store ON managers(store_id);
CREATE INDEX idx_managers_email ON managers(email);

-- =====================================================================
-- 5. シフト希望
-- =====================================================================
CREATE TABLE shift_requests (
  id            TEXT PRIMARY KEY,
  store_id      INTEGER NOT NULL REFERENCES stores(id),
  staff_id      TEXT NOT NULL REFERENCES staff(id),
  year_month    TEXT NOT NULL,
  date          TEXT NOT NULL,
  type          TEXT NOT NULL,
  start_time    TEXT DEFAULT '',
  end_time      TEXT DEFAULT '',
  note          TEXT DEFAULT '',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_requests_store_month ON shift_requests(store_id, year_month);
CREATE INDEX idx_requests_staff_month ON shift_requests(staff_id, year_month);

-- =====================================================================
-- 6. 確定シフト
-- =====================================================================
CREATE TABLE shift_schedules (
  id              TEXT PRIMARY KEY,
  store_id        INTEGER NOT NULL REFERENCES stores(id),
  staff_id        TEXT NOT NULL REFERENCES staff(id),
  year_month      TEXT NOT NULL,
  date            TEXT NOT NULL,
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL,
  break_minutes   INTEGER DEFAULT 0,
  work_hours      REAL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT '仮',
  creation_method TEXT NOT NULL DEFAULT '手動',
  confirmed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedules_store_month ON shift_schedules(store_id, year_month);
CREATE INDEX idx_schedules_staff_month ON shift_schedules(staff_id, year_month);

-- =====================================================================
-- 7. 人件費
-- =====================================================================
CREATE TABLE labor_costs (
  id              SERIAL PRIMARY KEY,
  store_id        INTEGER NOT NULL REFERENCES stores(id),
  year_month      TEXT NOT NULL,
  staff_id        TEXT NOT NULL REFERENCES staff(id),
  name            TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  total_hours     REAL DEFAULT 0,
  base_pay        INTEGER DEFAULT 0,
  late_night_pay  INTEGER DEFAULT 0,
  overtime_pay    INTEGER DEFAULT 0,
  transport_total INTEGER DEFAULT 0,
  total_cost      INTEGER DEFAULT 0,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_labor_store_month ON labor_costs(store_id, year_month);

-- =====================================================================
-- 8. ログ（操作証跡）
-- =====================================================================
CREATE TABLE logs (
  id        BIGSERIAL PRIMARY KEY,
  store_id  INTEGER REFERENCES stores(id),
  datetime  TIMESTAMPTZ NOT NULL DEFAULT now(),
  operator  TEXT NOT NULL,
  action    TEXT NOT NULL,
  detail    TEXT DEFAULT ''
);

CREATE INDEX idx_logs_store_datetime ON logs(store_id, datetime DESC);

-- =====================================================================
-- 9. updated_at の自動更新トリガ
-- =====================================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_touch BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER managers_touch BEFORE UPDATE ON managers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER requests_touch BEFORE UPDATE ON shift_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER schedules_touch BEFORE UPDATE ON shift_schedules
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =====================================================================
-- 10. RLS（行レベルセキュリティ）
--   ・このシステムは「Cloudflare Workers バックエンド経由でのみアクセス」
--     する設計です。Workers は service_role キーを使うため、RLS は実質
--     バイパスされます。
--   ・ただし防衛深層化のため RLS を有効化し、anon キーでのアクセスを
--     全ブロックします。
-- =====================================================================
ALTER TABLE stores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff           ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_costs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs            ENABLE ROW LEVEL SECURITY;

-- service_role（バックエンドWorkers）からのアクセスは全許可
CREATE POLICY service_role_all ON stores          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON store_settings  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON staff           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON managers        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON shift_requests  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON shift_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON labor_costs     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON logs            FOR ALL TO service_role USING (true) WITH CHECK (true);

-- anon ロール（publishable key、ブラウザ直アクセス）からの参照は store のみ許可
-- それ以外は明示的にブロック（ポリシー無し = アクセス不可）
CREATE POLICY anon_read_stores ON stores FOR SELECT TO anon USING (true);

-- =====================================================================
-- 11. 13店舗の初期データ
-- =====================================================================
INSERT INTO stores (code, name, type) VALUES
  ('URESHINO',  '嬉野本店',   '直営'),
  ('OMURA',     '大村店',     '直営'),
  ('ISAHAYA',   '諫早店',     '直営'),
  ('SASEBO',    '佐世保店',   '直営'),
  ('SAGA',      '佐賀店',     '直営'),
  ('TOSU',      '鳥栖店',     '直営'),
  ('FUKUOKA_T', '福岡天神店', '直営'),
  ('FUKUOKA_H', '福岡博多店', '直営'),
  ('KUMAMOTO',  '熊本店',     '直営'),
  ('OITA',      '大分店',     '直営'),
  ('MIYAZAKI',  '宮崎店',     '直営'),
  ('KAGOSHIMA', '鹿児島店',   '直営'),
  ('NAGASAKI',  '長崎店',     '直営')
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 12. 13店舗ぶんのデフォルト設定
-- =====================================================================
INSERT INTO store_settings (store_id, key, value)
SELECT id, '店舗名', name FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '店舗コード', code FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '店舗区分', '直営' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '営業開始', '11:00' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '営業終了', '22:00' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, 'ランチ開始', '11:00' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, 'ランチ終了', '15:00' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, 'ディナー開始', '17:00' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, 'ディナー終了', '22:00' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, 'ランチ最低人数', '3' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, 'ディナー最低人数', '4' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '希望提出締切日', '20' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, 'LINEチャネルトークン', '' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '管理者パスワード', '' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '平日ホール最低人数', '3' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '平日キッチン最低人数', '2' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '土日ホール最低人数', '5' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '土日キッチン最低人数', '4' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id, '正社員月間上限時間', '60' FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

INSERT INTO store_settings (store_id, key, value)
SELECT id,
  '時間帯別必要人数',
  '[{"start":"10:00","end":"14:00","weekdayHall":4,"weekdayKitchen":3,"weekendHall":4,"weekendKitchen":3,"label":"ランチ"},{"start":"14:00","end":"17:00","weekdayHall":1,"weekdayKitchen":1,"weekendHall":1,"weekendKitchen":1,"label":"つなぎ"},{"start":"17:00","end":"22:00","weekdayHall":4,"weekdayKitchen":3,"weekendHall":4,"weekendKitchen":3,"label":"ディナー"}]'
FROM stores
ON CONFLICT (store_id, key) DO NOTHING;

-- =====================================================================
-- 完了。次は data-import.sql を実行してスタッフとシフト希望を流し込みます。
-- =====================================================================
