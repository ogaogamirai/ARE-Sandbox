# Context Anchor: Japan Household Model (日本生活・雇用影響モデル)

## 📌 1. Latest Status & Release Trace (最新ステータスとリリース証跡)
- **Current Phase**: Phase 27: 全パラメータ解説の README ドキュメンテーションと GitHub 同期 - 完了 ⭐
  - サイドバーから操作できる全8つのパラメータについて、その役割、設定範囲、単位、デフォルト値、主要指標への影響、使用方法を `README.md` に表形式で網羅・ドキュメント化。
  - ローカルリポジトリでコミットし、`git push` によって GitHub リポジトリ（`main` ブランチ）への同期・保存を完了。
- **Latest Version / Cache Buster**: `v=1.6.9` (design_specification.md にも同期)
- **Latest Commit**: `7c97746866a10634f4fe156cde9c54940bbd6004` (docs: format context_anchor.md in compliance with Trinity Forge Protocol for Phase 27)
- **Deployment URL**: [JAPAN-A_Living (GitHub Pages)](https://ogaogamirai.github.io/ARE-Sandbox/japan-household-model/ui/index.html)

## 🌐 2. Dependency Topology (依存関係トポロジー)
- **G/C 分離アーキテクチャ**:
  - **Gドライブ (アイデンティティ・メモリ・ルール)**: `G:\マイドライブ\Nova`
  - **Cドライブ (Git物理コード開発・検証)**: `C:\Users\ogaog\.antigravity\Nova\workspace\Japan-Economy-Model`
- **物理ファイル間の依存構造**:
  - `japan-household-model/ui/index.html` (UI・DOM構造) ➔ `index.css` (デザインシステム・装飾スタイル)
  - `japan-household-model/ui/index.html` (UI・DOM構造) ➔ `main.js` (数理シミュレーション・動的描画エンジン)
  - `japan-household-model/design_specification.md` (数理仕様設計書) ➔ `main.js` (数理ロジック・方程式の実装元)
  - `japan-household-model/context_anchor.md` (本ファイル: 開発ステータス・トポロジー同期の錨)

## 📊 3. Variables & Data Flow (変数・データフロー)
- **Input Variables (from Macro Core)**:
  - 物価インフレ率 $\pi_t$ [初期値: 0.01] (年率・四半期換算など)
  - 政策金利 $r_t$ [初期値: 0.0025]
  - 長期金利 $R_t$ [初期値: 0.008]
  - GDP成長率 $g_{real, t}$ [初期値: 0.01]
  - 名目GDP $Y_t$ [初期値: 600.0]
- **Output Living Indicators**:
  - 平均実質賃金 ($W_{real}$)
  - 実質可処分所得 ($YD_{real}$)
  - 変動金利ローン金利負担 ($Cost_{loan}$)
  - 大中小企業賃金格差 ($Gap_{wage}$)
  - 労働供給就業調整ペナルティ ($L_{penalty}$)
  - 失業率 ($Unemployment\_Rate$)

## 🛡️ 4. Environment & Null-Safety Contract (環境・堅牢性契約)
- **Execution Environment**: Web Browser (HTML5 / Vanilla JS / Chart.js v4.4.1)
- **Verification Method**: ブラウザによる目視動作検証および開発者ツール（Console）のエラーフリー確認。
- **Safety Policy**:
  - DOM要素取得時および計算ループにおける `NaN` や `Infinity` の検知・クランプ保護処理。
  - キャッシュバスターの厳格インクリメント（`main.js`、`index.css` 読み込み時）によるブラウザキャッシュの無効化。

## 🎯 5. Task Backlog & Milestones (タスク履歴とバックログ)
### 過去エポックの完了済み (Context-GC 要約済)
- [x] **Phase 1〜20: 基本動学モデルの実装と可視化**:
  - UIの基礎設計、Chart.js を用いた2軸可視化、為替コストプッシュ、期待インフレ率、給付付き所得税額控除、ローン金利等、マクロ変数から家計への波及因果パス構築。
- [x] **Phase 21〜26: 数理モデルの較正とバグ修正**:
  - 期待インフレ率の不整合解消、就業調整ペナルティの感応度較正、賃金・物価・最賃改定の同期タイミング調整（U字くぼみバグの解消）、消費税スライダーの新設、消費税の一時的物価ショック（減衰モデル）への修正。
- [x] **Phase 27: ドキュメンテーションと同期**:
  - 全パラメータ（8種）の定義、影響先指標、数理的役割を表形式で `README.md` に追記。GitHub Pages へのデプロイ完了。

### 次期マイルストーン
- [ ] **Phase 28**: (次の実装指示に応じて設定)
