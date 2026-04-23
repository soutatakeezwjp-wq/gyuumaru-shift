-- =====================================================================
-- ぎゅう丸シフト管理 / ヘルプ募集URL機能 追加マイグレーション
-- =====================================================================
-- 目的:
--   管理者がシフト不足時に「この店舗のこの月用」のヘルプ募集URLを発行し、
--   バイトがそのURLからカレンダーで不足日を見て、応募申請ができるようにする。
--
-- 実行方法:
--   Supabase SQL Editor にこのファイル全体を貼り付けて Run
-- =====================================================================

-- ---------- 1. ヘルプ募集キャンペーン ----------
-- id 自体がURLトークンになる（URLに埋め込む乱数文字列）
CREATE TABLE IF NOT EXISTS help_campaigns (
  id           TEXT PRIMARY KEY,                                       -- URLに使う公開トークン
  store_id     INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year_month   TEXT NOT NULL,                                          -- 対象月 'YYYY-MM'
  title        TEXT NOT NULL DEFAULT 'ヘルプ募集',
  message      TEXT NOT NULL DEFAULT '',                               -- 案内文（LINE貼付用テキストにも使用）
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,                          -- 無効化フラグ
  expires_at   TIMESTAMPTZ,                                            -- 有効期限（NULLなら無期限）
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_help_campaigns_store_month
  ON help_campaigns(store_id, year_month);

-- ---------- 2. ヘルプ応募 ----------
CREATE TABLE IF NOT EXISTS help_applications (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES help_campaigns(id) ON DELETE CASCADE,
  store_id     INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  staff_id     TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,                                          -- 'YYYY-MM-DD'
  start_time   TEXT NOT NULL,                                          -- 'HH:MM'
  end_time     TEXT NOT NULL,
  position     TEXT NOT NULL DEFAULT '',                               -- 応募時点でのポジション（ホール/キッチン）
  status       TEXT NOT NULL DEFAULT '申請中',                         -- 申請中 / 承認 / 却下
  note         TEXT NOT NULL DEFAULT '',
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_help_apps_campaign
  ON help_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_help_apps_store_status
  ON help_applications(store_id, status);
CREATE INDEX IF NOT EXISTS idx_help_apps_staff
  ON help_applications(staff_id);

-- 同じ人が同じキャンペーン・同じ日時で二重応募するのを防ぐ
CREATE UNIQUE INDEX IF NOT EXISTS uq_help_apps_unique
  ON help_applications(campaign_id, staff_id, date, start_time, end_time);

-- =====================================================================
-- 完了。管理画面のAPIからこれらのテーブルを使います。
-- =====================================================================
