# Qoder OAuth for DeepSeek Harness

Repository: https://github.com/Fizor-drm/dsh-qoder-oauth

Qoder（国際版 / qoder.com）のログインとモデルを DeepSeek Harness（DSH）で使うための
コミュニティプラグインです。Qoder 公式の Qoder CLI / Agent SDK のログイン状態を再利用し、
Qoder のモデルを DSH のモデルピッカーから利用できるようにします。

> This is an unofficial community plugin. It is not affiliated with Qoder or
> DeepSeek. Qoder services remain subject to Qoder's own terms and plan limits.
> The MIT license below applies to this plugin's code only.

## 特長

- **Qoder Global のブラウザログイン**（公式 Qoder CLI 経由）
- Qoder のモデルを DSH のモデル一覧に追加
  - モデルごとの有効/無効
  - コンテキストウィンドウの選択
  - Qoder のアカウント/クォータ表示
- **キャンペーンクレジット表示（任意）**
  - Qoder の `dedicatedResourcePackages` を表示
  - 表示には Personal Access Token（PAT）が必要
- 日本語 UI
  - 「国際版」ではなく「グローバル版」表記
  - アカウント名は初期状態でランダム名＋ぼかし。クリックで実名表示
- アカウント名・クレジット・キャンペーン枠を同じ設定ページで確認

## 必要環境

- DeepSeek Harness `>= 0.2.0-rc.2`（このフォークは `0.2.2` 系で開発）
- Node.js `^22.19.0 || >=24.0.0`
- Qoder Global アカウント
- ワンクリック設定を使う場合は **Windows**（CLI のインストールとログインを補助）
- 手動の場合は `@qoder-ai/qodercli`

## インストール

### GitHub から

```sh
dsh plugin --profile desktop add github:Fizor-drm/dsh-qoder-oauth
```

リポジトリにはビルド済みの `lib/index.js` を含めています。ソースから更新した場合は
`pnpm run build` を実行してからコミットしてください。

### ローカルのチェックアウトから

```sh
pnpm install
pnpm run build
dsh plugin --profile desktop add /path/to/dsh-qoder-oauth
```

### npm 公開後

```sh
dsh plugin --profile desktop add dsh-qoder-oauth
```

インストール後、DSH を再起動するかページを再読み込みしてください。
ホスト側の変更を含む更新は DSH の再起動が必要です。

## ログイン

1. **Settings → Qoder グローバル版** を開く
2. **一括設定** を押す
   - Qoder CLI がなければインストール
   - ブラウザで Qoder Global にログイン
3. 完了後、モデル一覧とクォータが表示される

手動で行う場合は、**一括設定がインストールする CLI バージョンと一致**させてください。
Qoder SDK は CLI のプロトコルバージョンに依存するため、無指定の `latest` ではなく
SDK が要求するバージョンを指定します（一括設定を使うのが最も安全です）。

```powershell
# 一括設定を使えない場合のみ。バージョンは SDK の qoderCliVersion に合わせる
npm install -g @qoder-ai/qodercli@<SDK が要求するバージョン>
qodercli login
```

Qoder CN（qoder.com.cn）はこのプロファイルでは無効化しています。

## モデルの選択

1. Qoder グローバル版の設定ページで使うモデルを有効化
2. コンポーザのモデルピッカーで Qoder のモデルを選択
3. 必要に応じて reasoning effort と context window を設定

Qoder のモデルはアカウントのプラン・地域・混雑状況に依存します。Free プランでは
キュー待ちが発生することがあります。

## キャンペーンクレジット（任意）

Qoder CLI の `getUsageInfo()` は、プラン枠・追加パッケージ・セッション使用量を返しますが、
キャンペーン由来の `dedicatedResourcePackages` は返しません。
このプラグインでは、任意の PAT を設定した場合だけ Qoder のアカウント API から取得します。

1. [Qoder の Integrations](https://qoder.com/account/integrations) で Personal Access Token を発行
2. **Settings → Qoder グローバル版 → キャンペーン表示用 PAT** に入力
3. 保存後、クォータカードにキャンペーン枠が表示される

PAT は OAuth ログインとは別で、キャンペーン枠の取得だけに使います。
DSH のユーザーデータ領域（`~/.dsh/agent-sdk-bridge/qoder-campaign.json`、0600）に保存し、
ブラウザには返しません。

## セキュリティとプライバシー

- Qoder CLI のログイン情報は Qoder CLI が管理します。このプラグインは Qoder CLI の
  ログイン状態を再利用するだけで、OAuth トークンをリポジトリや設定ファイルに保存しません。
- キャンペーン表示用 PAT は上記のローカルファイルに 0600 で保存します。
  Windows ではファイルの ACL が実効的な保護になります。
- 使用量・アカウント表示の一部はブラウザの `localStorage` にキャッシュされます。
  共有端末では注意してください。
- Qoder の利用規約、プラン、レート制限、アカウント制限は利用者自身の責任で確認してください。

## 開発

```sh
pnpm install
pnpm run build
```

ホスト側は `src/`、クライアント側は `client.js` です。
`pnpm run build` は `lib/index.js` を生成します。

## ライセンス

MIT。詳細は `LICENSE` を参照してください。

このプロジェクトは **dsh-agent-sdk-bridge**（MIT, k1-h2）のフォークです。
上流の著作権・ライセンス表示は `LICENSE.original` / `NOTICE` / `FORK-NOTICE.md` に
保持しています。

Qoder、DeepSeek などの名称・ロゴは各権利者に帰属します。本プロジェクトは
Qoder または DeepSeek の公式プロジェクトではありません。

