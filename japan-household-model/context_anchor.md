# Context Anchor: Japan Household Model (日本生活・雇用影響モデル)

### Status
- **Phase 4: Verification & Debugging** - 完了
  - `README.md`, `design_specification.md` の仕様設計から始まり、`ui/index.html`, `ui/index.css`, `ui/main.js` の物理施工を完了。
  - ドライラン用テストスクリプト `scratch/test_engine.js` により、30期にわたる生活実感インフレ、金利の二面性、年収の壁、実質賃金および可処分所得の動学シミュレーションがNaNや発散なく美しく連動することを確認（検証パス）。

---

## Architecture Outline

```text
C:\Users\ogaog\.antigravity\Nova\workspace\Japan-Household-Model/
├── README.md               # ユーザー向け基本解説書
├── design_specification.md  # 数理方程式系およびハイドレーション設計書
├── context_anchor.md       # [本ファイル] 同期用アンカー・進捗履歴
├── japan-household-model/
│   └── ui/
│       ├── index.html      # シミュレーターUI (HTML)
│       ├── index.css       # デザインシステム・スタイル (CSS)
│       └── main.js         # 計算エンジンおよびUIチャート連動スクリプト (JS)
└── scratch/                # 施工前/施工後検証用スクリプト
    └── test_engine.js      # ドライラン動作検証用スクリプト
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
