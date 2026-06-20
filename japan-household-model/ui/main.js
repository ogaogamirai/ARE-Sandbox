/* ==========================================================================
   JAPAN-A_Living: 数理シミュレーションエンジン & UI制御 (main.js)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // 1. 初期状態ハイドレーション (基準パラメータ)
    const INITIAL_STATE = {
      W_nominal: 100.0,         // 平均名目賃金指数 (初期値100)
      Balance_loan: 80.0,       // 住宅ローン残高 (兆円)
      Balance_deposit: 200.0,   // 家計貯蓄預金残高 (兆円)
      tau_social: 0.15,         // 基準社会保険料率 15.0%
      Gap_wage: 0.30,           // 基準大中小企業賃金乖離率 30%
      Y_potential: 600.0,       // 潜在GDP基準値 (兆円)
      W_min: 1.0,               // 基準最低賃金指数 (初期値1.0)
      P_def: 1.0,               // 価格デフレーター初期値
      R_neutral: 0.015,         // 中立長期金利 1.5% (年率)
      r_neutral: 0.010,         // 中立政策金利 1.0% (年率)
      pi_target: 0.020,         // 年間目標インフレ率 2.0%
      term_premium: 0.008,      // 期間プレミアム 0.8%
      MC_init: 0.0104,          // 初期の限界費用基準値
      E_init: 150.0             // 基準為替レート
    };

    // 2. 政策スライダーおよび構造パラメータの現在値
    let config = {
      alpha_pass: 0.50,         // 中小企業価格転嫁率 (0.0 - 1.0)
      dMW: 0.03,                // 最低賃金引き上げ率 (年率)
      dSocial: 0.0,             // 社会保険料率調整
      ETC: 0.0,                 // 給付付き税額控除 (兆円規模)
      G_reskill: 0.0,           // リスキリング支援 (兆円規模)
      Loan_var: 0.70,           // 変動金利シェア (70%)
      Self_Suff: 0.38,          // 食料自給率 (38%)
      E_current: 150.0,         // 現在の為替レート
      scenario: "default"       // 選択シナリオ
    };

    // 🧱 UI要素の取得（現在の index.html に完全に適合する ID）
    const elements = {
        scenario: document.getElementById("macro-scenario"),
        sliderPass: document.getElementById("slider-pass"),
        sliderMw: document.getElementById("slider-mw"),
        sliderSocial: document.getElementById("slider-social"),
        sliderEtc: document.getElementById("slider-etc"),
        sliderReskill: document.getElementById("slider-reskill"),
        sliderLoan: document.getElementById("slider-loan"),
        
        valPass: document.getElementById("val-pass"),
        valMw: document.getElementById("val-mw"),
        valSocial: document.getElementById("val-social"),
        valEtc: document.getElementById("val-etc"),
        valReskill: document.getElementById("val-reskill"),
        valLoan: document.getElementById("val-loan"),
        
        hudWage: document.querySelector("#hud-wage .hud-value"),
        hudWageDelta: document.querySelector("#hud-wage .hud-delta"),
        hudYd: document.querySelector("#hud-yd .hud-value"),
        hudYdDelta: document.querySelector("#hud-yd .hud-delta"),
        hudLoan: document.querySelector("#hud-loan .hud-value"),
        hudLoanDelta: document.querySelector("#hud-loan .hud-delta"),
        hudGap: document.querySelector("#hud-gap .hud-value"),
        hudGapDelta: document.querySelector("#hud-gap .hud-delta"),
        hudPenalty: document.querySelector("#hud-penalty .hud-value"),
        hudPenaltyDelta: document.querySelector("#hud-penalty .hud-delta"),
        hudInflation: document.querySelector("#hud-inflation .hud-value"),
        hudInflationDelta: document.querySelector("#hud-inflation .hud-delta")
    };

    let charts = {};

    // 3. 30期分の動学時系列データの生成シミュレータ (最新の Rev2 ロジックを100%継承)
    function runSimulation() {
      const steps = 30;
      const dt = 0.25; // 四半期ベース
      let history = [];

      // 初期値のセット
      let state = { ...INITIAL_STATE };

      for (let t = 0; t < steps; t++) {
        const period = t;

        // ① 最低賃金指数の累積更新
        state.W_min = state.W_min * Math.pow(1 + config.dMW, dt);

        // ② 企業の限界費用 MC_t の計算 (金利の寄与を実態に即して 0.1 にマイルド化)
        const R_prev = t > 0 ? history[t - 1].R_long : state.R_neutral;
        const MC = 0.005 * state.W_min + 0.1 * R_prev;

        // ③ 潜在GDPの成長 (四半期 0.25%)
        const Y_potential_t = state.Y_potential * Math.pow(1 + 0.0025, period);

        // ④ 総供給量 Y_s,t の計算 (供給収縮効果)
        const W_min_impact = 0.1 * (state.W_min - 1.0);
        const R_impact = 0.5 * (R_prev - state.R_neutral);
        const Y_s = Y_potential_t * Math.max(0.5, 1.0 - W_min_impact - R_impact);

        // ⑤ 労働市場就業調整ペナルティ L_penalty
        const L_penalty = Math.max(0.0, 0.04 * (config.dMW / 0.03) * 0.8);

        // ⑥ 総名目労働所得の決定 (就業調整による手取り削減を内生化)
        const Gross_Income = state.W_nominal * 3.6 * (1.0 - L_penalty);

        // ⑦ 実質賃金指数 W_real,t の計算
        const W_real = state.W_nominal / state.P_def;

        // ⑧ 総需要量 Y_demand,t の計算 (実質賃金所得効果に変更し貨幣錯覚を排除)
        const Demand_R_impact = 1.0 * (R_prev - state.R_neutral);
        const Demand_W_impact = 0.2 * ((W_real - 100.0) / 100.0);
        const Y_d = Y_potential_t * Math.max(0.6, 1.0 - Demand_R_impact + Demand_W_impact);

        // ⑨ 需給ギャップ率
        const gap_ratio = (Y_d - Y_s) / Y_s;

        // ⑩ コストプッシュ型インフレ動学 (急激な四半期比MC変化に1期の移動平均的なラグを挟んでマイルド化)
        const MC_prev = t > 0 ? history[t - 1].MC : state.MC_init;
        const MC_growth = MC_prev > 0 ? (MC - MC_prev) / MC_prev : 0;
        
        // 期待インフレ率を四半期換算し、コストプッシュ(λ)の伝播を0.25で調整
        const pi = 0.015 / 4 + 0.15 * Math.max(-0.15, Math.min(0.15, gap_ratio)) + 0.1 * Math.max(0, MC_growth);
        const pi_clamped = Math.max(-0.05 / 4, Math.min(0.15 / 4, pi)); // 年率-5%〜15%にクランプ

        // ⑪ デフレーター P_t の累積更新
        state.P_def = state.P_def * (1 + pi_clamped);

        // ⑫ 生活実感インフレ率
        const FX_shock = Math.max(0, (config.E_current - state.E_init) / state.E_init);
        const pi_living = pi_clamped + 0.12 * FX_shock * (1 - config.Self_Suff);

        // ⑬ テイラー・ルール (日銀の防衛的利上げ: 四半期インフレ率ベースで判定)
        const Target_pi_quarter = state.pi_target / 4;
        const r_policy = Math.max(0.0, Math.min(0.12, state.r_neutral + 1.2 * (pi_clamped - Target_pi_quarter) + 0.3 * gap_ratio));
        const R_long = r_policy + state.term_premium;

        // ⑭ 金利の二面性 (預金受取とローン負担)
        const Inc_deposit = state.Balance_deposit * (r_policy * 0.5) * 0.25;
        const Cost_loan = state.Balance_loan * (config.Loan_var * r_policy + (1.0 - config.Loan_var) * 0.015) * 0.25;

        // ⑮ 政府リスキリング効果の動学補正
        let productivity_boost = 0.0;
        if (config.G_reskill > 0) {
          if (period <= 8) {
            productivity_boost = -0.0005 * config.G_reskill; // 投資期は摩擦損失
          } else {
            productivity_boost = 0.001 * config.G_reskill;  // スキルアップ発現
          }
        }

        // ⑯ 税金と社会保険料
        const Tax = Gross_Income * 0.10;
        const Social_Premium = Gross_Income * (0.15 + config.dSocial);

        // ⑰ 名目可処分所得 YD & 実質可処分所得 YD_real
        const YD = Gross_Income + Inc_deposit - Cost_loan - Tax - Social_Premium + config.ETC;
        const YD_real = YD / state.P_def;

        // ⑲ 大中小企業賃金格差 Gap_wage
        const dGap = 0.02 * (1 - config.alpha_pass) - 0.005 * config.dMW;
        const Gap_wage = state.Gap_wage * (1 + dGap);

        // 履歴に蓄積 (年率換算値に較正)
        history.push({
          step: period + 1,
          Y_potential: Y_potential_t,
          Y_s,
          Y_d,
          gap_ratio: gap_ratio * 100, // パーセンテージ
          pi_clamped: pi_clamped * 4 * 100, // 年率換算 %
          pi_living: pi_living * 4 * 100,   // 年率換算 %
          r_policy: r_policy * 100,         // 年率 %
          R_long: R_long * 100,             // 年率 %
          W_nominal: state.W_nominal,
          W_real: W_real * 100,             // 指数（初期100）
          L_penalty: L_penalty * 100,       // 就業調整率 %
          Inc_deposit,                      // 兆円フロー
          Cost_loan,                        // 兆円フロー
          YD,                               // 兆円フロー
          YD_real,                          // 兆円フロー
          Gap_wage: Gap_wage * 100,         // %
          MC
        });

        // 次期の名目賃金指数の更新
        const g_w = 0.0025 + 0.4 * pi_clamped + 0.1 * gap_ratio + 0.015 * (config.alpha_pass - 0.5) + 0.05 * config.dMW + productivity_boost;
        state.W_nominal = state.W_nominal * (1 + g_w);
      }

      return history;
    }

    // 📈 4. チャートインスタンスの管理 (HTMLのIDに完全適合)
    const initCharts = (history) => {
        const ctxWages = document.getElementById("chart-wages").getContext("2d");
        const ctxDisposable = document.getElementById("chart-disposable").getContext("2d");
        const ctxLabor = document.getElementById("chart-labor").getContext("2d");
        const ctxMacro = document.getElementById("chart-macro").getContext("2d");

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6' } }
            }
        };

        // 1. 賃金推移チャート (名目 vs 実質)
        charts.wage = new Chart(ctxWages, {
            type: "line",
            data: {
                labels: history.map(h => `期 ${h.step}`),
                datasets: [
                    { label: "平均名目賃金指数", data: history.map(h => h.W_nominal), borderColor: "#3b82f6", backgroundColor: "transparent", borderWidth: 2, tension: 0.1 },
                    { label: "平均実質賃金指数", data: history.map(h => h.W_real), borderColor: "#10b981", backgroundColor: "transparent", borderWidth: 2, tension: 0.1 }
                ]
            },
            options: chartOptions
        });

        // 2. 所得・利払い構成チャート (左右2軸化に適合)
        charts.household = new Chart(ctxDisposable, {
            type: "line",
            data: {
                labels: history.map(h => `期 ${h.step}`),
                datasets: [
                    { 
                        label: "実質可処分所得 (左軸: 兆円)", 
                        data: history.map(h => h.YD_real), 
                        borderColor: "#06b6d4", 
                        backgroundColor: "transparent", 
                        borderWidth: 2, 
                        tension: 0.1,
                        yAxisID: 'y'
                    },
                    { 
                        label: "住宅ローン支払金利負担 (右軸: 兆円)", 
                        data: history.map(h => h.Cost_loan), 
                        borderColor: "#f43f5e", 
                        borderDash: [5, 5], 
                        backgroundColor: "transparent", 
                        borderWidth: 2, 
                        tension: 0.1,
                        yAxisID: 'y1'
                    },
                    { 
                        label: "預金利息受取 (右軸: 兆円)", 
                        data: history.map(h => h.Inc_deposit), 
                        borderColor: "#10b981", 
                        borderDash: [2, 2], 
                        backgroundColor: "transparent", 
                        borderWidth: 2, 
                        tension: 0.1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: '所得規模 (兆円)', color: '#9ca3af' },
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#9ca3af' } 
                    },
                    y1: { 
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: '金利収支負担 (兆円)', color: '#9ca3af' },
                        min: 0,
                        max: 10, 
                        grid: { drawOnChartArea: false }, 
                        ticks: { color: '#9ca3af' } 
                    },
                    x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                },
                plugins: { legend: { labels: { color: '#f3f4f6' } } }
            }
        });

        // 3. 格差・就業調整および総需給チャート (左右2軸化)
        const chartOptionsLabor = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
                y: { 
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: '#9ca3af' },
                    title: { display: true, text: "比率 (%)", color: '#9ca3af' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false }, 
                    ticks: { color: '#9ca3af' },
                    title: { display: true, text: "需給規模 (兆円)", color: '#9ca3af' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6' } }
            }
        };

        charts.labor = new Chart(ctxLabor, {
            type: "line",
            data: {
                labels: history.map(h => `期 ${h.step}`),
                datasets: [
                    { label: "大中小賃金格差 (%)", data: history.map(h => h.Gap_wage), borderColor: "#6366f1", backgroundColor: "transparent", borderWidth: 2, tension: 0.1, yAxisID: 'y' },
                    { label: "就業調整ペナルティ (%)", data: history.map(h => h.L_penalty), borderColor: "#f59e0b", backgroundColor: "transparent", borderWidth: 2, tension: 0.1, yAxisID: 'y' },
                    { label: "総供給 Ys (右軸: 兆円)", data: history.map(h => h.Y_s), borderColor: "#10b981", borderDash: [3, 3], backgroundColor: "transparent", borderWidth: 1.5, tension: 0.1, yAxisID: 'y1' },
                    { label: "総需要 Yd (右軸: 兆円)", data: history.map(h => h.Y_d), borderColor: "#3b82f6", borderDash: [3, 3], backgroundColor: "transparent", borderWidth: 1.5, tension: 0.1, yAxisID: 'y1' }
                ]
            },
            options: chartOptionsLabor
        });

        // 4. マクロ金利・インフレ状態チャート
        charts.macro = new Chart(ctxMacro, {
            type: "line",
            data: {
                labels: history.map(h => `期 ${h.step}`),
                datasets: [
                    { label: "マクロインフレ率 (年率 %)", data: history.map(h => h.pi_clamped), borderColor: "#eab308", backgroundColor: "transparent", borderWidth: 2, tension: 0.1 },
                    { label: "政策金利 (年率 %)", data: history.map(h => h.r_policy), borderColor: "#3b82f6", backgroundColor: "transparent", borderWidth: 2, tension: 0.1 },
                    { label: "長期金利 (年率 %)", data: history.map(h => h.R_long), borderColor: "#a855f7", backgroundColor: "transparent", borderWidth: 2, tension: 0.1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) { return value.toFixed(1) + '%'; }
                        }
                    },
                    x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                },
                plugins: { legend: { labels: { color: '#f3f4f6' } } }
            }
        });
    };

    const updateMetricsAndCharts = () => {
        const history = runSimulation();
        const last = history[history.length - 1];
        const first = history[0];

        // 📋 HUD（カード）の更新 (現在の HTML ID)
        elements.hudWage.innerHTML = `${last.W_real.toFixed(1)} <span class="unit">指数</span>`;
        const wageDelta = last.W_real - 100.0;
        elements.hudWageDelta.textContent = `${wageDelta >= 0 ? '▲' : '▼'} ${Math.abs(wageDelta).toFixed(1)} (対期首)`;
        elements.hudWageDelta.className = `hud-delta ${wageDelta > 0 ? 'text-positive' : wageDelta < 0 ? 'text-negative' : 'text-neutral'}`;

        elements.hudYd.innerHTML = `${last.YD_real.toFixed(1)} <span class="unit">兆円</span>`;
        const ydDelta = last.YD_real - 360.0;
        elements.hudYdDelta.textContent = `${ydDelta >= 0 ? '▲' : '▼'} ${Math.abs(ydDelta).toFixed(1)} (対期首)`;
        elements.hudYdDelta.className = `hud-delta ${ydDelta > 0 ? 'text-positive' : ydDelta < 0 ? 'text-negative' : 'text-neutral'}`;

        elements.hudLoan.innerHTML = `${last.Cost_loan.toFixed(2)} <span class="unit">兆円/期</span>`;
        const loanDelta = last.Cost_loan - first.Cost_loan;
        elements.hudLoanDelta.textContent = `${loanDelta > 0 ? '▲ 負担増' : loanDelta < 0 ? '▼ 負担減' : '安定'}`;
        elements.hudLoanDelta.className = `hud-delta ${loanDelta > 0 ? 'text-negative' : loanDelta < 0 ? 'text-positive' : 'text-neutral'}`;

        elements.hudGap.innerHTML = `${last.Gap_wage.toFixed(1)} <span class="unit">%</span>`;
        const gapDelta = last.Gap_wage - 30.0;
        elements.hudGapDelta.textContent = `${gapDelta > 0 ? '▲ 拡大' : gapDelta < 0 ? '▼ 縮小' : '不変'}`;
        elements.hudGapDelta.className = `hud-delta ${gapDelta > 0 ? 'text-negative' : gapDelta < 0 ? 'text-positive' : 'text-neutral'}`;

        elements.hudPenalty.innerHTML = `${last.L_penalty.toFixed(2)} <span class="unit">%</span>`;
        elements.hudPenaltyDelta.textContent = last.L_penalty > 0.0 ? "就業時間の下押し発生" : "安定稼働";
        elements.hudPenaltyDelta.className = `hud-delta ${last.L_penalty > 0 ? 'text-negative' : 'text-positive'}`;

        elements.hudInflation.innerHTML = `${last.pi_living.toFixed(2)} <span class="unit">%</span>`;
        const infDelta = last.pi_living - last.pi_clamped;
        elements.hudInflationDelta.textContent = infDelta > 0.0 ? `実質物価差: +${infDelta.toFixed(2)}% (円安影響)` : "マクロ連動";
        elements.hudInflationDelta.className = `hud-delta ${infDelta > 0 ? 'text-negative' : 'text-neutral'}`;

        // トグルクラスの更新（生活実感インフレ）
        const inflationCard = document.querySelector("#hud-inflation");
        if (inflationCard) {
            if (last.pi_living >= 3.0) {
                inflationCard.style.borderLeft = "4px solid #c2593f"; // 警告赤
            } else {
                inflationCard.style.borderLeft = "4px solid #4a6b5d"; // フォレストモス
            }
        }

        // チャートの更新
        const labels = history.map(h => `期 ${h.step}`);

        charts.wage.data.labels = labels;
        charts.wage.data.datasets[0].data = history.map(h => h.W_nominal);
        charts.wage.data.datasets[1].data = history.map(h => h.W_real);
        charts.wage.update();

        charts.household.data.labels = labels;
        charts.household.data.datasets[0].data = history.map(h => h.YD_real);
        charts.household.data.datasets[1].data = history.map(h => h.Cost_loan);
        charts.household.data.datasets[2].data = history.map(h => h.Inc_deposit);
        charts.household.update();

        charts.labor.data.labels = labels;
        charts.labor.data.datasets[0].data = history.map(h => h.Gap_wage);
        charts.labor.data.datasets[1].data = history.map(h => h.L_penalty);
        charts.labor.data.datasets[2].data = history.map(h => h.Y_s);
        charts.labor.data.datasets[3].data = history.map(h => h.Y_d);
        charts.labor.update();

        charts.macro.data.labels = labels;
        charts.macro.data.datasets[0].data = history.map(h => h.pi_clamped);
        charts.macro.data.datasets[1].data = history.map(h => h.r_policy);
        charts.macro.data.datasets[2].data = history.map(h => h.R_long);
        charts.macro.update();
    };

    // 🔄 6. UI同期・更新処理
    const handleSliderUpdate = () => {
        config.alpha_pass = parseFloat(elements.sliderPass.value);
        config.dMW = parseFloat(elements.sliderMw.value);
        config.dSocial = parseFloat(elements.sliderSocial.value);
        config.ETC = parseFloat(elements.sliderEtc.value);
        config.G_reskill = parseFloat(elements.sliderReskill.value);
        config.Loan_var = parseFloat(elements.sliderLoan.value);

        // シナリオに応じた為替等の更新
        const scenario = elements.scenario.value;
        config.scenario = scenario;
        switch(scenario) {
            case "high-inflation":
                config.E_current = 170.0;
                break;
            case "interest-rise":
                config.E_current = 135.0;
                break;
            case "stagflation":
                config.E_current = 165.0;
                break;
            case "baseline":
            default:
                config.E_current = 140.0;
                break;
        }

        // スライダーバッジ表示の更新
        elements.valPass.textContent = `${Math.round(config.alpha_pass * 100)}%`;
        elements.valMw.textContent = `${(config.dMW * 100).toFixed(1)}%`;
        
        const socialVal = config.dSocial;
        elements.valSocial.textContent = `${socialVal >= 0 ? '+' : ''}${(socialVal * 100).toFixed(1)}%`;
        
        elements.valEtc.textContent = `${config.ETC} 兆円`;
        elements.valReskill.textContent = `${config.G_reskill} 兆円`;
        elements.valLoan.textContent = `${Math.round(config.Loan_var * 100)}%`;

        updateMetricsAndCharts();
    };

    // 📞 7. イベントリスナーの設定
    const setupEventListeners = () => {
        const controls = [
            elements.scenario, elements.sliderPass, elements.sliderMw,
            elements.sliderSocial, elements.sliderEtc, elements.sliderReskill,
            elements.sliderLoan
        ];
        
        controls.forEach(control => {
            control.addEventListener("input", handleSliderUpdate);
            control.addEventListener("change", handleSliderUpdate);
        });
    };

    // 🚀 8. アプリケーション初期化起動
    const initApp = () => {
        setupEventListeners();
        
        const initialData = runSimulation();
        initCharts(initialData);
        
        handleSliderUpdate(); // スライダー初期バインド＆シミュレーション実行
    };

    initApp();
});

console.log("JAPAN-A_Living: Complete Dynamic Engine compiled successfully.");
