# ぎゅう丸シフト管理システム

焼肉ぎゅう丸の全13店舗で使えるシフト管理Webアプリです。

## できること

- スタッフがスマホからシフト希望を提出できる
- 管理者がシフトを自動作成・手動編集できる
- ポジション別（ホール/キッチン）のシフト管理
- 人件費の自動計算
- 確定シフトをLINEで通知（任意設定）

## 技術スタック

| 項目 | 技術 |
|------|------|
| バックエンド | Cloudflare Workers（TypeScript） |
| データベース | Cloudflare D1（SQLite） |
| フレームワーク | Hono |
| フロントエンド | HTML / CSS / JavaScript（フレームワークなし） |
| 認証 | JWT |

## プロジェクト構成

```
cloudflare-project/   ... メインのアプリ（Cloudflare Workers版）
gas-project/           ... 旧バージョン（Google Apps Script版）
docs/                  ... セットアップガイドなどのドキュメント
```

## セットアップ手順

### 1. 必要なもの

- Node.js（v18以上）
- Cloudflareアカウント（無料プランでOK）
- Wrangler CLI（Cloudflareの開発ツール）

### 2. インストール

```bash
cd cloudflare-project
npm install
```

### 3. 設定ファイルの準備

```bash
cp wrangler.toml.example wrangler.toml
```

`wrangler.toml` を開いて、自分のCloudflare D1データベースIDとJWTシークレットを設定してください。

### 4. データベースの初期化

```bash
npx wrangler d1 execute gyuumaru-db --local --file=schema.sql
npx wrangler d1 execute gyuumaru-db --local --file=seed.sql
```

### 5. ローカルで起動

```bash
npx wrangler dev
```

ブラウザで http://localhost:8787 を開くとアプリが使えます。

### 6. 本番デプロイ

```bash
npx wrangler deploy
```

## 店舗一覧

嬉野本店 / 嬉野2号店 / 武雄店 / 伊万里店 / 佐世保店 / 大村店 / 諫早店 / 長崎店 / 久留米店 / 鳥栖店 / 筑紫野店 / 福岡東店 / 福岡原店
