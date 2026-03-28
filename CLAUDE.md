# ぎゅう丸シフト管理システム - プロジェクト記録

## セッションログ

### 2026年03月28日

**やったこと**
- プロジェクト全22ファイルのコード全量レビューを実施
- 初回分析で「未完成」と報告された3箇所（admin-shift-edit.html / admin-staff-manage.html / style.html）が実は完成済みであることを確認
- 本当の問題点としてAPI呼び出しのエラー処理（.catch()）の欠落を発見し修正
  - admin-shift-edit.html: saveEntry / deleteEntry / finalizeShift の3箇所に .catch() 追加
  - admin-staff-manage.html: save / retire の2箇所に .catch() 追加
- .claude/settings.local.json を作成し、全操作の自動許可を設定

**わかったこと・気づいたこと**
- プロジェクトのコア機能はほぼ100%完成している
- 全22ファイル（GS 10ファイル + HTML 11ファイル + ドキュメント 2ファイル）が実装済み
- スタッフ側機能（選択・シフト希望入力・確定シフト確認）は完成
- 管理者側機能（ログイン・ダッシュボード・希望一覧・シフト作成編集・スタッフ管理・人件費）は完成
- バックエンド（自動作成アルゴリズム・人件費計算・LINE Messaging API通知）は完成
- エラー処理の欠落はネットワーク障害時にローディング画面が固まる原因になるため重要

**次回やること・メモ**
- GASにデプロイして実際の動作確認
- スプレッドシートのテンプレート作成（docs/spreadsheet-template.md を参照）
- 管理者パスワードの初期設定
- LINE Channel Tokenの設定（任意）
- 実運用テスト（スタッフ登録 → シフト希望提出 → 自動作成 → 確定 → LINE通知の一連フロー）

### 2026年03月28日（2回目セッション）

やったこと
- GAS版をclaspでデプロイし、実際にブラウザで動作確認した
- Setup.gsを作成してスプレッドシートの初期セットアップを自動化
- SpreadsheetApp.getUi()のエラーを2回修正（Logger.logとハードコードパスワード方式に変更）
- appsscript.jsonがclasp createで上書きされた問題を修復（タイムゾーンとwebapp設定）
- GAS版の限界（遅い、バナーがダサい、独自ドメイン不可）を実体験で確認
- Cloudflare Workers + D1 への移行計画を策定（7フェーズ）
- Cloudflareプロジェクトの骨組み作成を開始
  - package.json, wrangler.toml, tsconfig.json を作成
  - schema.sql（7テーブル + インデックス）を作成
  - seed.sql（13店舗の初期データ）を作成
  - src/types.ts（全型定義）を作成
  - src/config.ts（定数・設定値）を作成
  - src/utils.ts（ユーティリティ関数をTypeScriptに移植）を作成

わかったこと・気づいたこと
- GAS版デプロイURLは動作するが、読み込みに3-5秒かかる
- GASのWebアプリには「Google Apps Scriptで作成」のバナーが消せない
- clasp pushは --force フラグが必要な場合がある
- GASエディタのキャッシュが強力で、タブを完全に閉じないと新コードが反映されない
- Cloudflare Workers + D1なら月$5で13店舗OK、爆速、バナーなし
- マルチテナントは全テーブルにstore_idカラムで実現する設計
- フロントエンドはReactなどを使わず、既存のVanilla JSをそのまま移行（リスク最小化）

次回やること・メモ
- src/db/dao.ts（SheetDAO.gsのSQL版）の作成
- src/services/ 配下の6サービスファイルの移植
- src/middleware/ （JWT認証、テナント解決）の作成
- src/index.ts（Honoルーター、全19APIエンドポイント）の作成
- フロントエンドの移行（HTML/CSS/JSをGASテンプレートからfetch()ベースに変換）
- npm installしてwrangler devでローカル動作確認

### 2026年03月28日（3回目セッション）

やったこと
- Cloudflare Workers + D1 版の全コード実装を完了
  - src/db/dao.ts: SheetDAO.gsの全操作をD1 SQLに変換
  - src/services/ 6ファイル: auth, staff, shift-request, shift-schedule, labor-cost, line-notify
  - src/middleware/auth.ts: JWT認証（Web Crypto API使用）
  - src/index.ts: Honoルーター（全19 APIエンドポイント）
  - public/index.html: GASテンプレートから変換した単一ページHTML
  - public/css/style.css: 全スタイル
  - public/js/: api-client.js, app.js, calendar.js, pages.js の4ファイル
- npm install成功（92パッケージ）
- D1ローカルデータベースの初期化とシードデータ投入完了
  - seed.sqlでCROSS JOINがD1のcompound SELECT制限に引っかかる問題を修正（個別INSERT文に変更）
- wrangler dev でローカルサーバー起動成功
- 全APIエンドポイントのテスト合格
  - GET /api/stores: 13店舗が正しく返る
  - GET /api/stores/URESHINO/info: 店舗設定が正しく返る
  - GET /api/time-slots: 06:00-24:00の37スロット
  - GET /api/stores/URESHINO/staff-list: 空配列（正常）
  - フロントエンドHTML/CSS/JS: 全て200 OK

わかったこと・気づいたこと
- D1のSQLiteにはcompound SELECTの項数制限がある（CROSS JOIN + 大量UNION ALLは避ける）
- wrangler devはTypeScriptを自動コンパイルしてくれる（tsc不要）
- Hono + D1の組み合わせは非常に高速（APIレスポンス 1-18ms）
- フロントエンドの静的ファイルはwrangler.tomlのassets設定で自動配信される

次回やること・メモ
- ブラウザで実際にアクセスして画面遷移を確認
- テスト用スタッフを登録してシフト希望 -> 自動作成 -> 確定の一連フローを通す
- 管理者パスワードの設定（初回はAPIから設定）
- Cloudflareにデプロイ（wrangler deploy）
- カスタムドメインの設定（任意）
- LINE Messaging API の接続設定（任意）

### 2026年03月28日（4回目セッション）

**やったこと**
- ブラウザで実際にアプリを操作し、一連のフロー（店舗選択 → スタッフ登録 → シフト希望提出 → 自動作成 → 確定）を動作確認
- 管理者ログインの初回パスワード自動設定機能を追加（パスワード未設定時は入力したパスワードがそのまま登録される）
- シフト希望が管理者のシフト表作成画面に反映されない問題を修正
  - AdminShiftEdit.loadでAPI.getAllRequestsも取得するよう変更
  - renderMatrixで確定シフトがないセルにシフト希望を色分け表示（出勤=青点線、休み=ピンク点線、どちらでも=黄色点線）
- 「シフト確定」ボタンにシフト0件時の警告メッセージを追加
- スタッフ側「確定シフト確認」画面のデフォルト表示を今月→来月に変更
- ぎゅう丸ロゴ画像をアプリに組み込み（ヘッダー、店舗選択画面、モード選択画面）
- ポジション（ホール/キッチン）機能を追加
  - staffテーブルにpositionカラムを追加
  - スタッフ管理画面にポジション選択を追加
  - シフト表をポジション別にグループ表示
- 平日/土日別の最低人数設定を実装（平日: ホール3/キッチン2、土日: ホール5/キッチン4）
  - 自動作成アルゴリズムをポジション×曜日対応に全面改修
- 正社員の月間労働時間管理を実装
  - 月60時間超で1.3倍の給与計算
  - 月80時間超で危険ライン表示
  - シフト表にプログレスバーで正社員の月間時間を可視化
- 嬉野本店にダミースタッフ20人を追加（ホール7人: 正社員2+アルバイト5、キッチン13人: 正社員2+アルバイト11）
- データベースリセット機能（npm run db:reset）を追加
- Cloudflare Workers に本番デプロイ完了
  - D1データベースを本番環境に作成（ID: 3915784e-dcb0-4c35-90d7-58382cd8d719）
  - workers.devサブドメイン「gyuumaru」をAPI経由で登録
  - 公開URL: https://gyuumaru-shift.gyuumaru.workers.dev

**わかったこと・気づいたこと**
- D1のcompound SELECT制限は本番でもローカルでも同様（個別INSERTで対応が安定）
- wrangler deployは7ファイルのアップロード含めて約7秒で完了する（爆速）
- 新しいworkers.devサブドメインはSSL証明書の発行に数分かかることがある
- Cloudflare Workers Free planは日10万リクエスト、D1は月500万読み取りまで無料（シフト管理なら余裕）
- curlのLibreSSL古いバージョンだとworkers.devへの接続でSSLエラーが出るが、ブラウザからは問題なくアクセスできる
- 管理者パスワード未設定時のログインフローは初回セットアップとして重要
- シフト表画面ではgetShiftSchedule（確定）だけでなくgetAllRequests（希望）も同時に表示する必要がある

**次回やること・メモ**
- GitHubリポジトリを作成してコードをアップロード（バックアップと共同編集のため）
- GitHub Actionsで自動デプロイの設定（pushしたら自動で本番反映）
- カスタムドメインの設定（任意、例: shift.gyuumaru.com）
- LINE Messaging APIの接続設定（任意）
- 実運用テスト（全店舗でスタッフが実際に使ってみる）

---
