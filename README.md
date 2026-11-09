# 幾何学メーカー — 第2段階（画像・設定の保存）

シード連動配色と各色の再抽選・固定を追加しました。[操作・互換性](docs/SEEDED-COLORS.md)を参照してください。

この開発ブランチ `feat/stage2-export-settings` はv4を基準に、PNG／SVG書き出し・設定JSON保存／読込・カスタム解像度を追加しています。生成処理は変更していません。[第2段階の使い方・検証結果・制約](docs/STAGE2.md)を参照してください。main／GitHub Pages本番には未反映です。

React + TypeScript + Vite / SVG の、バックエンド不要のWebアプリです。
Windows・macOSのデスクトップブラウザで利用する構成です。

## 作業開始時の調査

2026-11-08時点の `/workspace` とその共有フォルダには、既存ソース、package.json、有効なGitリポジトリはありませんでした。添付「幾何学メーカー設計図.txt」は最終目標として参照し、今回明示された7項目に範囲を限定しました。

そのため本実装は独立した `geometry-maker` フォルダに作成しています。既存コードを削除・置換していません。元プロジェクトへの統合と既存実装の回帰確認は、元ソース未提供のため未実施です。

## 実装済み

1. シード入力（数値・文字列・日本語・絵文字・空文字）
2. 暗号学的乱数を用いたランダムシード生成
3. 単色と3色グラデーション背景の切り替え、任意色・方向の調整
4. 16:9 / 9:16 / 1:1 / 4:5 / 3:2 / 21:9 / A4縦 / A4横
5. シードで中央集中・斜め流動・コーナー集中・非対称・フレーム型を選び、1〜2個の主役と関連する図形群を背景／中景／前景に生成。図形数は固定せず、余白にかかる補助図形は省く
6. SVGによるライブプレビュー
7. 同じシード・設定・アルゴリズム版での再生成

シード欄は選択・コピー・再入力できます。変更は即座に反映されます。「同じ設定で再生成」でも構図は変わりません。背景色と図形配色は独立し、色変更によって図形配置は変わりません。

## 開発・ビルド

Node.js 22.12以降（検証環境: Node.js 24.22.1、npm 11.9.0）を使用してください。

```sh
npm ci
npm run dev
```

表示されたローカルURLをブラウザで開いてください。

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`dist/` が静的公開用の成果物です。開発・プレビューサーバーは開発確認用で、アプリ自体にバックエンドは不要です。ファイルの直接ダブルクリックではなくHTTPサーバーで確認してください。実行時に外部フォント・CDN・APIを読み込みません。

## ブラウザテスト

初回のみテスト用Chromiumを用意します。

```sh
npx playwright install chromium
```

別ターミナルで `npm run dev` を起動し、次を実行します。

```sh
npm run test:browser
```

既存Chromiumを使う場合は `CHROMIUM_PATH`、別のテスト対象URLを使う場合は `TEST_BASE_URL` を環境変数で設定できます（Linux/macOSの例）。

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

検証内容・結果は [docs/TEST-REPORT.md](docs/TEST-REPORT.md) を参照してください。

## 再現性と構成

- `src/scene.ts`: バージョン付きPRNG、構図計画、連続ノイズ・密度場、3層の図形データ生成、比率定義
- `src/geometry.ts`: 共通の図形輪郭、接続点、境界と余白の判定
- `src/paint.ts`: 指定背景の色を保ったまま、図形側のコントラストと発光を調整
- `src/Preview.tsx`: 図形データからSVGを描画
- `src/App.tsx`: 操作画面・設定状態
- `src/scene.test.ts`: 再現性・各比率・乱数などのユニットテスト
- `src/composition.test.ts`: 全8比率×100シードの役割・階層・接続・余白・画面端、構図タイプの多様性、v4固定ダイジェスト
- `src/refinement-v4.test.ts`: コーナー型の対重心、三角形面積、明るい背景の補正
- `src/paint.test.ts`: 明暗・有彩色背景の視認性、縦横比を考慮したグラデーション座標、限定した発光
- `tests/app.spec.ts`: 実ブラウザの操作・画像一致テスト

このブランチのアルゴリズム版は `2d-v4` です。v2と同じシードでも構図は変わります。v2はコミット `407e581`、v1はコミット `196b177` で保持しています。旧版切替UIは追加していません。設定JSONはschemaVersion 1・algorithmVersion 2d-v4を保存／復元します。シードは文字列として扱い、`1` と `01`、前後空白も区別します。空文字も有効なシードです。PRNGは従来のFNV-1a + Mulberry32を維持。描画と再生成に `Math.random()` や時刻は使用せず、明示的なランダムボタンだけが `crypto.getRandomValues()` を使用します。再現時は同じシード、比率、背景種類・色・角度、アルゴリズム版を使用してください。ページを読み直すと設定は初期値に戻ります。背景色を変えても構図は変わらず、図形の明暗と発光だけが適応します。

SVGの座標と実寸の比率を一致させ、画面サイズ変更時も図形を縦横に引き伸ばしません。同一環境の再入力・再読み込みでは描画画像の一致も確認しています。異なるOS・ブラウザ間のピクセル単位の一致はフォントや描画系に依存し、今回の保証対象には含めません。

## GitHub / GitHub Pages

ソースは [ShugureRune/geometry-maker](https://github.com/ShugureRune/geometry-maker) の `main` で管理しています。`.github/workflows/ci.yml` は型チェック・ユニットテスト・ビルド用です。

`.github/workflows/pages.yml` は `main` へのpushまたは手動実行で、`npm ci` → `npm test` → `npm run build`（型チェックを含む）→ `dist/` のアップロード → GitHub Pagesへのデプロイを行います。テスト・ビルドの失敗時にはデプロイしません。公開処理は同時実行せず、既存のPagesデプロイを途中で中断しません。アプリの2D生成・描画コードは変更していません。

初回はリポジトリの **Settings → Pages → Build and deployment → Source → GitHub Actions** を設定してください。Actionsが無効ならSettings → Actions → Generalから有効にします。その後mainへのpush、またはActions → Deploy to GitHub Pages → Run workflowで実行できます。

公開先は `https://shugurerune.github.io/geometry-maker/` です。デプロイの完了はActionsの `Deploy to GitHub Pages` 実行結果で確認してください。完了後、iPhoneのSafariで同じURLを開けます。Safariで表示されない場合は、末尾の `/` まで含めてURLを確認し、再読み込みしてください。iPhone実機の操作確認は別途必要です。

Viteの `base: './'` を維持し、アセットを相対参照します。クライアント側のURLルーティングは使用していないため、リポジトリ配下でのページ再読み込みにも対応します。GitHub Pagesの標準HTTPSで配信し、バックエンドや追加の秘密情報は不要です。

## 今回の対象外

図形個別ON/OFF・密度・テーマなどの高度な編集、成長アニメーション、タイムライン、3D/Three.js、動画、Blender、PSD、待機画面は未実装です。未実装機能のボタンは置いていません。Three.jsは将来必要になる段階で追加し、この2D生成・描画モジュールと分離して統合する想定です。

画像・設定保存までの第2段階を実装し、その先の機能には進んでいません。

### 図形密度

縦横比の下のスライダーで0〜100%（5%刻み）を調整できます。初期値50%はv4標準、0%は背景のみです。主役の位置を保ち、補助図形・装飾の量を変更します。PNG/SVGと設定JSONにも密度を反映します。旧JSONは50%として読み込みます。[方式・比較画像・検証結果](docs/density/README.md)を参照してください。
