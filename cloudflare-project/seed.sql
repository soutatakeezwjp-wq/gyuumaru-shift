-- ぎゅう丸 13店舗の初期データ

INSERT OR IGNORE INTO stores (code, name, type) VALUES
  ('URESHINO', '嬉野本店', '直営'),
  ('OMURA', '大村店', '直営'),
  ('ISAHAYA', '諫早店', '直営'),
  ('SASEBO', '佐世保店', '直営'),
  ('SAGA', '佐賀店', '直営'),
  ('TOSU', '鳥栖店', '直営'),
  ('FUKUOKA_T', '福岡天神店', '直営'),
  ('FUKUOKA_H', '福岡博多店', '直営'),
  ('KUMAMOTO', '熊本店', '直営'),
  ('OITA', '大分店', '直営'),
  ('MIYAZAKI', '宮崎店', '直営'),
  ('KAGOSHIMA', '鹿児島店', '直営'),
  ('NAGASAKI', '長崎店', '直営');

-- 各店舗のデフォルト設定を個別INSERTで投入
-- (CROSS JOIN + UNION ALLだとD1のcompound SELECT制限に引っかかるため)

INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '店舗名', name FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '店舗コード', code FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '店舗区分', '直営' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '営業開始', '11:00' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '営業終了', '22:00' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, 'ランチ開始', '11:00' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, 'ランチ終了', '15:00' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, 'ディナー開始', '17:00' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, 'ディナー終了', '22:00' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, 'ランチ最低人数', '3' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, 'ディナー最低人数', '4' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '希望提出締切日', '20' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, 'LINEチャネルトークン', '' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '管理者パスワード', '' FROM stores;

-- ポジション別・平日土日別の最低人数設定
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '平日ホール最低人数', '3' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '平日キッチン最低人数', '2' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '土日ホール最低人数', '5' FROM stores;
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '土日キッチン最低人数', '4' FROM stores;

-- 正社員の月間上限時間
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '正社員月間上限時間', '60' FROM stores;

-- 時間帯別必要人数（JSON: 平日/土日別）
INSERT OR IGNORE INTO store_settings (store_id, key, value) SELECT id, '時間帯別必要人数', '[{"start":"10:00","end":"14:00","weekdayHall":4,"weekdayKitchen":3,"weekendHall":4,"weekendKitchen":3,"label":"ランチ"},{"start":"14:00","end":"17:00","weekdayHall":1,"weekdayKitchen":1,"weekendHall":1,"weekendKitchen":1,"label":"つなぎ"},{"start":"17:00","end":"22:00","weekdayHall":4,"weekdayKitchen":3,"weekendHall":4,"weekendKitchen":3,"label":"ディナー"}]' FROM stores;

-- 嬉野本店(store_id=1)のダミースタッフ20人

-- ホール正社員(2人)
INSERT OR IGNORE INTO staff (id, store_id, name, kana, employment_type, position, hourly_rate, monthly_salary, transport_daily, phone, email, line_user_id, join_date, weekly_limit, fixed_off, status, memo, created_at, updated_at) VALUES
  ('STF_HALL_F01', 1, '山田太郎', 'ヤマダタロウ', '正社員', 'ホール', 0, 280000, 500, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_HALL_F02', 1, '田中花子', 'タナカハナコ', '正社員', 'ホール', 0, 250000, 500, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00');

-- ホールアルバイト(5人)
INSERT OR IGNORE INTO staff (id, store_id, name, kana, employment_type, position, hourly_rate, monthly_salary, transport_daily, phone, email, line_user_id, join_date, weekly_limit, fixed_off, status, memo, created_at, updated_at) VALUES
  ('STF_HALL_P01', 1, '佐藤美咲', 'サトウミサキ', 'アルバイト', 'ホール', 1000, 0, 300, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_HALL_P02', 1, '鈴木翔太', 'スズキショウタ', 'アルバイト', 'ホール', 1000, 0, 400, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_HALL_P03', 1, '高橋ゆい', 'タカハシユイ', 'アルバイト', 'ホール', 950, 0, 300, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_HALL_P04', 1, '渡辺拓也', 'ワタナベタクヤ', 'アルバイト', 'ホール', 1050, 0, 500, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_HALL_P05', 1, '伊藤さくら', 'イトウサクラ', 'アルバイト', 'ホール', 950, 0, 200, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00');

-- キッチン正社員(2人)
INSERT OR IGNORE INTO staff (id, store_id, name, kana, employment_type, position, hourly_rate, monthly_salary, transport_daily, phone, email, line_user_id, join_date, weekly_limit, fixed_off, status, memo, created_at, updated_at) VALUES
  ('STF_KTCN_F01', 1, '中村健一', 'ナカムラケンイチ', '正社員', 'キッチン', 0, 300000, 500, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_F02', 1, '小林大輔', 'コバヤシダイスケ', '正社員', 'キッチン', 0, 260000, 500, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00');

-- キッチンアルバイト(11人)
INSERT OR IGNORE INTO staff (id, store_id, name, kana, employment_type, position, hourly_rate, monthly_salary, transport_daily, phone, email, line_user_id, join_date, weekly_limit, fixed_off, status, memo, created_at, updated_at) VALUES
  ('STF_KTCN_P01', 1, '加藤りな', 'カトウリナ', 'アルバイト', 'キッチン', 1000, 0, 300, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P02', 1, '吉田遼太', 'ヨシダリョウタ', 'アルバイト', 'キッチン', 1050, 0, 400, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P03', 1, '松本あかり', 'マツモトアカリ', 'アルバイト', 'キッチン', 950, 0, 200, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P04', 1, '井上航', 'イノウエワタル', 'アルバイト', 'キッチン', 1000, 0, 300, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P05', 1, '木村真由', 'キムラマユ', 'アルバイト', 'キッチン', 1000, 0, 400, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P06', 1, '林恵介', 'ハヤシケイスケ', 'アルバイト', 'キッチン', 950, 0, 300, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P07', 1, '斉藤ゆうき', 'サイトウユウキ', 'アルバイト', 'キッチン', 1050, 0, 500, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P08', 1, '清水なつみ', 'シミズナツミ', 'アルバイト', 'キッチン', 950, 0, 200, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P09', 1, '山口翼', 'ヤマグチツバサ', 'アルバイト', 'キッチン', 1000, 0, 300, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P10', 1, '森田あゆみ', 'モリタアユミ', 'アルバイト', 'キッチン', 950, 0, 400, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00'),
  ('STF_KTCN_P11', 1, '阿部光希', 'アベコウキ', 'アルバイト', 'キッチン', 1000, 0, 300, '', '', '', '2026-01-01', 40, '', '在籍', '', '2026-03-28 00:00:00', '2026-03-28 00:00:00');
