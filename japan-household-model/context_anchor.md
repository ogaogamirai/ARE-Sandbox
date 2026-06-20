# Context Anchor: Japan Household Model (日本生活・雇用影響モデル)

### Status
- **Phase 4: Verification & Debugging** - 完了
  - `README.md`, `design_specification.md` の仕様設計から始まり、`ui/index.html`, `ui/index.css`, `ui/main.js` の物理施工を完了。
  - ドライラン用テストスクリプト `scratch/test_engine.js` により、30期にわたる生活実感インフレ、金利の二面性、年収の壁、実質賃金および可処分所得の動学シミュレーションがNaNや発散なく美しく連動することを確認（検証パス）。

---

## Architecture Outline

```text
C:\Users\ogaog\.antigravity\Nova\workspace\Japan-Economy-Model/ (リポジトリルート)
├── README.md               # [既存] マクロ経済シミュレーター解説書
├── japan-economy-model/    # [既存] マクロ経済モデル本体
└── japan-household-model/  # [新設] 今回追加したフォルダ
    ├── README.md           # 国民生活モデル解説書
    ├── design_specification.md # 数理設計仕様書
    ├── context_anchor.md   # [本ファイル] 同期用アンカー・進捗履歴
    └── ui/
        ├── index.html      # シミュレーターUI (HTML)
        ├── index.css       # デザインシステム・スタイル (CSS)
        └── main.js         # 計算エンジンおよびUIチャート連動スクリプト (JS)
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
- [x] **Phase 6: Full Dynamic Feedback Model Integration** =^・^=
  - 最低賃金引き上げに伴う「供給収縮（$\beta_1$効果）」「限界費用上昇（$MC_t$）」「コストプッシュインフレ（$\pi_t$）」「テイラー・ルール利上げ（$r_{policy, t}, R_{long, t}$）」「需要抑制（$\theta$効果）」および「変動ローン支払金利高騰（$Cost_{loan, t}$）」「実質可処分所得（$YD_{real, t}$）圧縮」の完全動学フィードバックループを実装。
  - 各変数に上限・下限の厳格な保護ガードを設定し、NaNや数値発散を防止。
  - `chart-labor` チャートを2軸化し、左軸に格差・ペナルティ（%）、右軸に総供給量・総需要量（兆円）の推移を美しく可視化。
