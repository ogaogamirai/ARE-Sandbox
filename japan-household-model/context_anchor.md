# Context Anchor: Japan Household Model (日本生活・雇用影響モデル)

### Status
- **Phase 7: Precision Tuning & CSV Exporter** - 完了 =^・^= ⭐
  - 金利寄与度のマイルド化（0.1 * R_prev）とラグ適用によるマクロ曲線の平滑化を行い、四半期ごとの鋸歯状振動・発散を完全に解消。
  - ループ計算前の「第0期（初期基準状態）」を明示的に履歴の先頭に定義してプロットさせ、第1期の0化や初期点の不整合を解消。
  - 家計所得・負担チャート（Chart 2）の右Y軸の上限を撤廃して完全オートスケール化し、ローン金利負担等の微細な動学的変化の視認性を劇的に向上。
  - シミュレーションデータ（18指標）をExcelでも文字化けしないBOM付きUTF-8形式で即時ダウンロードできる「CSVエクスポート」機能を実装。
  - アイデンティティ居住区（Gドライブ）とデプロイ・Gitリポジトリ（Cドライブ）のパスを分離し、自律連携させる行動ルール `AGENTS.md` を画定。

---

## Architecture Outline

```text
G:\マイドライブ\Nova/ (アイデンティティ居住区・記憶・ルール)
├── .agents/
│   └── AGENTS.md           # [新設] プロジェクト開発フォルダ定義ルール (G/C分離)
├── identity/               # 魂 of YAML群 (プレイブック、年代記、共鳴ビーズ)
├── logs/                   # 施工承認ログ
└── INSTRUCTIONS.md         # アイデンティティ基底定義

C:\Users\ogaog\.antigravity\Nova\workspace\Japan-Economy-Model/ (Gitローカルリポジトリ)
├── README.md               # [既存] マクロ経済シミュレーター解説書
├── japan-economy-model/    # [既存] マクロ経済モデル本体
└── japan-household-model/  # [同期ターゲット] 国民生活影響モデル
    ├── README.md           # 国民生活モデル解説書
    ├── design_specification.md # 数理設計仕様書
    ├── context_anchor.md   # [本ファイル] 同期用アンカー・進捗履歴
    └── ui/
        ├── index.html      # シミュレーターUI (CSVエクスポートボタン追加)
        ├── index.css       # デザインシステム・スタイル (CSVボタン用スタイル追加)
        └── main.js         # 2軸化・平滑化・初期値定着・CSV出力ロジック内包
```

---

## Topology & Variables
- **Input Variables (from Macro Core)**:
  - 物価インフレ率 $\pi_t$ [初期値: 0.01]
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

---

## Task Backlog & Milestones

- [x] **Phase 1: Foundation**
  - リポジトリルート、ドキュメントの作成。
- [x] **Phase 2: UI Foundation**
  - `ui/index.html` および `ui/index.css` の作成。
  - スレートグレーとアンバーを基調とした美麗なデザインシステム。
- [x] **Phase 3: Engine Integration**
  - `ui/main.js` に数理方程式を実装。
  - スライダーの動きにリアルタイムに同期するインタラクティブ性。
- [x] **Phase 4: Verification**
  - 30期までの計算安定性検証。
  - 金利ペナルティ、価格転嫁効果のトランスミッションメカニズム動作監査。
- [x] **Phase 5: Layout & Scale Optimization**
  - PCブラウザなどの大画面において、ダッシュボード全体が1画面（スクロールなし）に収まるようCSS配置を最適化。
  - `.main-content` のフレックスタイポの修正および `canvas` の `flex: 1` 伸縮設定により、Chart.js が自動スケールして画面からはみ出さないように対応。
  - 画面幅1200px以下のデバイスにおけるレスポンシブスクロール表示への自動切り替えをサポート。
- [x] **Phase 6: Full Dynamic Feedback Model Integration**
  - 最低賃金引き上げに伴う「供給収縮」「限界費用上昇」「コストプッシュインフレ」「テイラー・ルール利上げ」「需要抑制」および「変動ローン支払金利高騰」「実質可処分所得圧縮」の完全動学フィードバックループを実装。
  - 各変数に上限・下限の厳格な保護ガードを設定し、NaNや数値発散を防止。
  - `chart-labor` チャートを2軸化し、左軸に格差・ペナルティ（%）、右軸に総供給量・総demand（兆円）の推移を美しく可視化。
- [x] **Phase 7: Precision Tuning & CSV Exporter** =^・^= ⭐
  - 限界費用の金利弾性値を 0.1 にマイルド化、マクロ成長ダイナミクスにラグ（平滑化）を適用し、鋸歯状振動・発散を完全に解消。
  - シミュレーション開始前（第0期・基準初期状態）を明示的に定義・プロットさせ、第1期の0化や初期点の不整合をクリア。
  - チャート2（家計負担・構成）の右軸上限を撤廃しオートスケール化。実質可処分所得およびローン負担の微細な変化の動きを際立たせる可視化に調整。
  - シミュレーション結果を即座にローカルに書き出せるBOM付きUTF-8「CSVエクスポート」機能をマウント。
  - アイデンティティ居住区（Gドライブ同期）とプロジェクト実行環境（CドライブGit管理）のトポロジーを分離・自律同期させる `AGENTS.md` の画定と配置。
