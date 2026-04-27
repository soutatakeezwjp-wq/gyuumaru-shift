-- =====================================================================
-- ぎゅう丸シフト管理 / 海外店舗の追加マイグレーション
-- =====================================================================
-- 目的:
--   国内13店舗に加えて、ベトナム店・台湾店をstoresテーブルに追加。
--   多言語化UI（日本語/ベトナム語/繁体字中国語/台湾語）と合わせて使用する。
--
-- 実行方法:
--   Supabase SQL Editor にこのファイル全体を貼り付けて Run
--   （冪等：既に同じcodeの店舗があれば何もしない）
-- =====================================================================

-- 1. 海外店舗の追加
INSERT INTO stores (code, name, type)
VALUES
  ('VIETNAM', 'ベトナム店', '海外'),
  ('TAIWAN',  '台湾店',     '海外')
ON CONFLICT (code) DO NOTHING;

-- 2. 追加した2店舗にデフォルト設定を流し込む
--    （他店舗と同等のキーをそろえておくと、店舗設定画面で扱いやすい）
INSERT INTO store_settings (store_id, key, value)
SELECT s.id, v.key, v.value
FROM stores s
CROSS JOIN (
  VALUES
    ('店舗名',                ''),  -- 後で stores.name で上書き
    ('店舗コード',            ''),  -- 後で stores.code で上書き
    ('店舗区分',              '海外'),
    ('営業開始',              '11:00'),
    ('営業終了',              '22:00'),
    ('平日_ホール最低人数',   '2'),
    ('平日_キッチン最低人数', '2'),
    ('土日_ホール最低人数',   '3'),
    ('土日_キッチン最低人数', '3'),
    ('シフト希望締切日',      '20')
) AS v(key, value)
WHERE s.code IN ('VIETNAM', 'TAIWAN')
ON CONFLICT (store_id, key) DO NOTHING;

-- 店舗名・コードを実値で更新（上のINSERTで空文字が入った行のみ）
UPDATE store_settings ss
SET value = s.name
FROM stores s
WHERE ss.store_id = s.id
  AND ss.key = '店舗名'
  AND s.code IN ('VIETNAM', 'TAIWAN')
  AND ss.value = '';

UPDATE store_settings ss
SET value = s.code
FROM stores s
WHERE ss.store_id = s.id
  AND ss.key = '店舗コード'
  AND s.code IN ('VIETNAM', 'TAIWAN')
  AND ss.value = '';
