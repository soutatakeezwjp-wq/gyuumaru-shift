# ぎゅう丸シフト管理システム

焼肉ぎゅう丸の全13店舗で使えるシフト管理Webアプリです。

## できること

- スタッフがスマホからシフト希望を提出できる（PIN認証付き）
- 管理者がシフトを自動作成・手動編集できる（ガントチャート対応）
- ポジション別（ホール/キッチン）のシフト管理
- 人件費の自動計算（深夜手当・残業手当・ピーク手当・曜日手当・店舗別設定）
- 祝日の自動判定とカレンダー表示
- 連勤可視化と労基法アラート
- 月単位＋週別ガントチャートのExcel出力
- 社労士のCSV取込→スタッフがWebで給与明細を閲覧
- 確定シフトをLINEで通知（任意設定）
- 3階層の権限管理（本部 / 店長 / スタッフ）

## 本番URL（運用中）

| サイト | URL | 用途 |
|--------|-----|------|
| 本部 | https://gyuumaru-shift-hq.gyuumaru.workers.dev | 全店舗を横断管理する本部ポータル |
| 嬉野本店 | https://gyuumaru-shift-ureshino.gyuumaru.workers.dev | 嬉野本店専用 |
| 福岡天神店 | https://gyuumaru-shift-tenjin.gyuumaru.workers.dev | 福岡天神店専用 |

ログインのメールアドレス・パスワードは社内パスワード管理ツールを参照してください。

## 技術スタック

| 項目 | 技術 |
|------|------|
| バックエンド | Cloudflare Workers（TypeScript / Hono） |
| データベース | Supabase（PostgreSQL） |
| フロントエンド | HTML / CSS / JavaScript（フレームワークなし） |
| 認証 | JWT + PBKDF2-SHA256 ハッシュ + スタッフ4桁PIN |

## プロジェクト構成

```
cloudflare-project/   ... メインのアプリ（Cloudflare Workers + Supabase）
gas-project/          ... 旧バージョン（Google Apps Script版、参照用）
docs/                 ... 技術説明書・運用ガイド
```

---

## チーム開発のセットアップ手順

### 1. 必要なアカウントとツール

- Node.js（v18以上）
- Cloudflareアカウント（このプロジェクトに招待してもらう）
- Supabaseアカウント（このプロジェクトに招待してもらう）
- Wrangler CLI（`npm install` で自動的に入る）

### 2. リポジトリをクローン

```bash
git clone https://github.com/soutatakeezwjp-wq/gyuumaru-shift.git
cd gyuumaru-shift/cloudflare-project
npm install
```

### 3. 機密情報の設定（最重要）

機密情報は **GitHubには絶対に上げません**。社内のパスワード管理ツール（1Password / Bitwarden / Notion メンバー限定ページなど）から値を取得して、ローカルにコピーします。

```bash
# テンプレートをコピー
cp .dev.vars.example .dev.vars
cp wrangler.toml.example wrangler.toml
```

それぞれのファイルを開いて、社内で共有されている **本物の値** に置き換えてください：

- `.dev.vars` … Supabase接続情報、JWT_SECRET（ローカル開発用）
- `wrangler.toml` … Cloudflare Workers のデプロイ設定（基本そのままでOK）

`.dev.vars` と `wrangler.toml` は `.gitignore` に登録済みで、Git に上がりません。

### 4. ローカル起動

```bash
npx wrangler dev
```

ブラウザで http://localhost:8787 を開くとアプリが動きます。

### 5. 本番デプロイ（権限のある人だけ）

3つの環境（本部 / 嬉野 / 天神）をそれぞれデプロイします：

```bash
# 本部用
npx wrangler deploy --env hq

# 嬉野本店用
npx wrangler deploy --env ureshino

# 福岡天神店用
npx wrangler deploy --env tenjin
```

### 6. 本番Secretsの登録（初回のみ）

新しい環境を作る場合のみ実行。既存環境にはすでに登録済みです：

```bash
echo "実際のSUPABASE_URL"               | npx wrangler secret put SUPABASE_URL --env hq
echo "実際のSUPABASE_SERVICE_ROLE_KEY"  | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env hq
echo "本番用のランダム文字列"           | npx wrangler secret put JWT_SECRET --env hq
# 同じことを --env ureshino と --env tenjin でも実行
```

---

## アクセス権限の管理

### Cloudflare（本番デプロイ権限）

メンバー招待: https://dash.cloudflare.com → 該当アカウント → Members → Invite

### Supabase（DBアクセス権限）

メンバー招待: https://supabase.com/dashboard → 該当プロジェクト → Settings → Team → Invite

### 機密情報の共有

- 1Password / Bitwarden などのチーム用パスワード管理ツールに「ぎゅう丸シフト 本番secrets」のページを作る
- 生のキーをメールやSlackで送るのは避ける（履歴に残るため危険）

---

## 店舗一覧（Supabaseの stores テーブル）

| code | 店舗名 |
|------|--------|
| URESHINO | 嬉野本店 |
| OMURA | 大村店 |
| ISAHAYA | 諫早店 |
| SASEBO | 佐世保店 |
| SAGA | 佐賀店 |
| TOSU | 鳥栖店 |
| FUKUOKA_T | 福岡天神店 |
| FUKUOKA_H | 福岡博多店 |
| KUMAMOTO | 熊本店 |
| OITA | 大分店 |
| MIYAZAKI | 宮崎店 |
| KAGOSHIMA | 鹿児島店 |
| NAGASAKI | 長崎店 |

新しい店舗を本番にデプロイしたい場合は、`wrangler.toml` に `[env.<新店舗code>]` セクションを追加して `npx wrangler deploy --env <新店舗code>` するだけ。
