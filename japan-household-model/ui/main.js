/* ==========================================================================
   JAPAN-A_Living: 数理シミュレーションエンジン & UI制御 (main.js)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // 📊 1. マクロ経済シナリオデータの定義 (30期分: 7.5年)
    const generateMacroData = (scenario) => {
        const data = {
            pi: [],       // インフレ率
            r: [],        // 政策金利
            R: [],        // 長期金利
            g_real: [],   // 実質成長率
            Y: [],        // 名目GDP
            E: []         // 為替レート
        };

        for (let t = 0; t < 30; t++) {
            let pi_t, r_t, R_t, g_real_t, Y_t, E_t;
            const t_ratio = t / 30;

            switch(scenario) {
                case "high-inflation":
                    // 高インフレ円安シナリオ (金融緩和継続・輸入コスト高)
                    pi_t = 0.03 + 0.01 * Math.sin(t_ratio * Math.PI);
                    r_t = 0.0025 + 0.0025 * t_ratio;
                    R_t = 0.01 + 0.005 * t_ratio;
                    g_real_t = 0.005 - 0.01 * t_ratio;
                    E_t = 150.0 + 20.0 * t_ratio + 5.0 * Math.sin(t_ratio * Math.PI);
                    Y_t = 600.0 * Math.pow(1 + (g_real_t + pi_t) * 0.25, t);
                    break;
                case "interest-rise":
                    // 日銀利上げ・金利上昇シナリオ (金融引き締め・インフレ鎮静・成長下押し)
                    r_t = 0.0025 + 0.0275 * t_ratio; // 3.0%へ利上げ
                    pi_t = Math.max(0.01, 0.025 - 0.02 * t_ratio); // インフレ率低下
                    R_t = 0.008 + 0.027 * t_ratio; // 長期金利3.5%へ
                    g_real_t = 0.01 - 0.015 * t_ratio; // 利払い負担で成長マイナス
                    E_t = 150.0 - 25.0 * t_ratio; // 円高方向へ
                    Y_t = 600.0 * Math.pow(1 + (g_real_t + pi_t) * 0.25, t);
                    break;
                case "stagflation":
                    // スタグフレーション (ゼロ成長・物価高・財政リスク金利上昇)
                    pi_t = 0.04 + 0.01 * Math.cos(t_ratio * Math.PI);
                    r_t = 0.0025 + 0.0375 * t_ratio; // 4.0%へ後追い利上げ
                    R_t = 0.008 + 0.042 * t_ratio; // 長期金利5.0%へ暴騰
                    g_real_t = 0.008 - 0.028 * t_ratio; // -2.0%リセッション
                    E_t = 150.0 + 15.0 * t_ratio;
                    Y_t = 600.0 * Math.pow(1 + (g_real_t + pi_t) * 0.25, t);
                    break;
                case "baseline":
                default:
                    // 標準シナリオ (緩やかな物価上昇・マイルドな金利)
                    pi_t = 0.015 + 0.005 * t_ratio; // 2.0%で安定
                    r_t = 0.0025 + 0.0075 * t_ratio; // 1.0%へ収束
                    R_t = 0.008 + 0.010 * t_ratio; // 1.8%へ安定
                    g_real_t = 0.01 + 0.005 * Math.sin(t_ratio * Math.PI); // 1.0%〜1.5%
                    E_t = 150.0 - 10.0 * t_ratio; // 緩やかに140円へ
                    Y_t = 600.0 * Math.pow(1 + (g_real_t + pi_t) * 0.25, t);
                    break;
            }

            data.pi.push(pi_t);
            data.r.push(r_t);
            data.R.push(R_t);
            data.g_real.push(g_real_t);
            data.Y.push(Y_t);
            data.E.push(E_t);
        }
        return data;
    };

    // 🧱 2. UI要素の取得
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

    // 🧠 3. シミュレーション実行コアエンジン
    const runSimulation = () => {
        // スライダー入力値の取得
        const inputs = {
            alpha_pass: parseFloat(elements.sliderPass.value),
            dMW: parseFloat(elements.sliderMw.value),
            dSocial: parseFloat(elements.sliderSocial.value),
            ETC: parseFloat(elements.sliderEtc.value),
            G_reskill: parseFloat(elements.sliderReskill.value),
            Loan_var: parseFloat(elements.sliderLoan.value)
        };

        // マクロ基本シナリオデータのロード
        const macro = generateMacroData(elements.scenario.value);

        // 結果格納用配列
        const results = {
            t: Array.from({length: 30}, (_, i) => `期 ${i}`),
            W_nominal: [],
            W_real: [],
            Cost_loan: [],
            Inc_deposit: [],
            YD: [],
            YD_real: [],
            Gap_wage: [],
            L_penalty: [],
            pi_living: []
        };

        // 初期値ハイドレーション
        let W_nominal_t = 100.0;
        let Gap_wage_t = 30.0; // 30%格差

        const Balance_loan = 80.0;    // 住宅ローン残高 (兆円)
        const Balance_deposit = 200.0;// 家計預金残高 (兆円)
        const R_init = 0.015;         // 固定金利ローン基準値 (1.5%)
        const Self_Suff = 0.38;       // 食料自給率 (38%)

        for (let t = 0; t < 30; t++) {
            // マクロ変数のロード
            const pi_t = macro.pi[t];
            const r_t = macro.r[t];
            const R_t = macro.R[t];
            const g_real_t = macro.g_real[t];
            const E_t = macro.E[t];

            // 簡易的GDPギャップ率の推定 (成長率が潜在成長率1%から乖離した分)
            const gdpGap_t = g_real_t - 0.01;

            // 1. 賃金上昇率の決定方程式
            // リスキル支援規模に応じて中長期(t > 8)に生産性向上効果を付加
            const reskill_boost = (t > 8) ? 0.001 * inputs.G_reskill : -0.0005 * inputs.G_reskill; // 投資期は微細な摩擦コスト
            const g_w = 0.0025 + 0.4 * pi_t + 0.1 * gdpGap_t + 0.015 * (inputs.alpha_pass - 0.5) + 0.05 * inputs.dMW + reskill_boost;
            W_nominal_t = W_nominal_t * (1 + g_w);
            const W_real_t = W_nominal_t / (1 + pi_t);

            // 2. 賃金格差 (価格転嫁率が低いほど中小企業の賃上げが遅れる)
            const dGap = 0.02 * (1 - inputs.alpha_pass) - 0.005 * inputs.dMW;
            Gap_wage_t = Math.max(5.0, Gap_wage_t * (1 + dGap));

            // 3. 金利の二面性 (住宅ローン vs 預金)
            const Cost_loan_t = Balance_loan * (inputs.Loan_var * r_t + (1 - inputs.Loan_var) * R_init) * 0.25;
            const Inc_deposit_t = Balance_deposit * (r_t * 0.5) * 0.25;

            // 4. 税・社会保険料および可処分所得の算出
            const gross_income = W_nominal_t * 3.6; // 賃金指数から雇用者所得規模(兆円)へのスケール
            const Tax_t = gross_income * 0.10;     // 簡易的実効税率10%
            const Social_t = gross_income * (0.15 + inputs.dSocial); // 基準社会保険料率15%にスライダーを加算
            const YD_t = gross_income + Inc_deposit_t - Cost_loan_t - Tax_t - Social_t + inputs.ETC;

            // 5. 生活実感インフレ率 (自給率と為替連動)
            const pi_living_t = pi_t + 0.12 * Math.max(0, (E_t - 150.0) / 150.0) * (1 - Self_Suff);
            const YD_real_t = YD_t / (1 + pi_living_t);

            // 6. 年収の壁ペナルティ (最低賃金上昇に伴う就業調整)
            const L_penalty_t = Math.max(0, 0.04 * (inputs.dMW / 0.03) * (1 - 0.20) * 100); // 簡易壁見直し対策20%として固定

            // 結果の保存
            results.W_nominal.push(W_nominal_t);
            results.W_real.push(W_real_t);
            results.Cost_loan.push(Cost_loan_t);
            results.Inc_deposit.push(Inc_deposit_t);
            results.YD.push(YD_t);
            results.YD_real.push(YD_real_t);
            results.Gap_wage.push(Gap_wage_t);
            results.L_penalty.push(L_penalty_t);
            results.pi_living.push(pi_living_t);
        }

        return { results, macro };
    };

    // 📈 4. チャートインスタンスの管理
    let charts = {};

    const initCharts = (data) => {
        const ctxWages = document.getElementById("chart-wages").getContext("2d");
        const ctxDisposable = document.getElementById("chart-disposable").getContext("2d");
        const ctxLabor = document.getElementById("chart-labor").getContext("2d");
        const ctxMacro = document.getElementById("chart-macro").getContext("2d");

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: "#374151" }, ticks: { color: "#9ca3af" } },
                y: { grid: { color: "#374151" }, ticks: { color: "#9ca3af" } }
            },
            plugins: {
                legend: { labels: { color: "#f3f4f6" } }
            }
        };

        // 1. 賃金推移チャート (名目 vs 実質)
        charts.wages = new Chart(ctxWages, {
            type: "line",
            data: {
                labels: data.results.t,
                datasets: [
                    { label: "平均名目賃金", data: data.results.W_nominal, borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", tension: 0.1 },
                    { label: "平均実質賃金", data: data.results.W_real, borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", tension: 0.1 }
                ]
            },
            options: chartOptions
        });

        // 2. 所得・利払い構成チャート
        charts.disposable = new Chart(ctxDisposable, {
            type: "line",
            data: {
                labels: data.results.t,
                datasets: [
                    { label: "実質可処分所得", data: data.results.YD_real, borderColor: "#06b6d4", tension: 0.1 },
                    { label: "住宅ローン支払負担", data: data.results.Cost_loan, borderColor: "#f43f5e", borderDash: [5, 5], tension: 0.1 },
                    { label: "預金利息受取", data: data.results.Inc_deposit, borderColor: "#10b981", borderDash: [2, 2], tension: 0.1 }
                ]
            },
            options: chartOptions
        });

        // 3. 格差と就業調整ペナルティ
        charts.labor = new Chart(ctxLabor, {
            type: "line",
            data: {
                labels: data.results.t,
                datasets: [
                    { label: "大中小賃金格差 (%)", data: data.results.Gap_wage, borderColor: "#3b82f6", tension: 0.1 },
                    { label: "就業調整ペナルティ (%)", data: data.results.L_penalty, borderColor: "#f59e0b", tension: 0.1 }
                ]
            },
            options: chartOptions
        });

        // 4. マクロ金利・インフレ状態チャート
        charts.macro = new Chart(ctxMacro, {
            type: "line",
            data: {
                labels: data.results.t,
                datasets: [
                    { label: "マクロインフレ率 (%)", data: data.macro.pi.map(v => v * 100), borderColor: "#f59e0b", tension: 0.1 },
                    { label: "政策金利 (%)", data: data.macro.r.map(v => v * 100), borderColor: "#3b82f6", tension: 0.1 },
                    { label: "長期金利 (%)", data: data.macro.R.map(v => v * 100), borderColor: "#f43f5e", tension: 0.1 }
                ]
            },
            options: chartOptions
        });
    };

    const updateCharts = (data) => {
        charts.wages.data.datasets[0].data = data.results.W_nominal;
        charts.wages.data.datasets[1].data = data.results.W_real;
        charts.wages.update();

        charts.disposable.data.datasets[0].data = data.results.YD_real;
        charts.disposable.data.datasets[1].data = data.results.Cost_loan;
        charts.disposable.data.datasets[2].data = data.results.Inc_deposit;
        charts.disposable.update();

        charts.labor.data.datasets[0].data = data.results.Gap_wage;
        charts.labor.data.datasets[1].data = data.results.L_penalty;
        charts.labor.update();

        charts.macro.data.datasets[0].data = data.macro.pi.map(v => v * 100);
        charts.macro.data.datasets[1].data = data.macro.r.map(v => v * 100);
        charts.macro.data.datasets[2].data = data.macro.R.map(v => v * 100);
        charts.macro.update();
    };

    // 📋 5. HUD表示更新ロジック
    const updateHUD = (data) => {
        const lastIdx = 29;
        
        // 平均実質賃金
        const wageVal = data.results.W_real[lastIdx];
        const wageDelta = wageVal - 100.0;
        elements.hudWage.innerHTML = `${wageVal.toFixed(1)} <span class="unit">指数</span>`;
        elements.hudWageDelta.textContent = `${wageDelta >= 0 ? '▲' : '▼'} ${Math.abs(wageDelta).toFixed(1)} (対期首)`;
        elements.hudWageDelta.className = `hud-delta ${wageDelta > 0 ? 'text-positive' : wageDelta < 0 ? 'text-negative' : 'text-neutral'}`;

        // 実質可処分所得
        const ydVal = data.results.YD_real[lastIdx];
        const ydDelta = ydVal - 360.0;
        elements.hudYd.innerHTML = `${ydVal.toFixed(1)} <span class="unit">兆円</span>`;
        elements.hudYdDelta.textContent = `${ydDelta >= 0 ? '▲' : '▼'} ${Math.abs(ydDelta).toFixed(1)} (対期首)`;
        elements.hudYdDelta.className = `hud-delta ${ydDelta > 0 ? 'text-positive' : ydDelta < 0 ? 'text-negative' : 'text-neutral'}`;

        // ローン負担
        const loanVal = data.results.Cost_loan[lastIdx];
        const loanInitVal = data.results.Cost_loan[0];
        const loanDelta = loanVal - loanInitVal;
        elements.hudLoan.innerHTML = `${loanVal.toFixed(2)} <span class="unit">兆円/期</span>`;
        elements.hudLoanDelta.textContent = `${loanDelta > 0 ? '▲ 負担増' : loanDelta < 0 ? '▼ 負担減' : '安定'}`;
        elements.hudLoanDelta.className = `hud-delta ${loanDelta > 0 ? 'text-negative' : loanDelta < 0 ? 'text-positive' : 'text-neutral'}`;

        // 格差
        const gapVal = data.results.Gap_wage[lastIdx];
        const gapDelta = gapVal - 30.0;
        elements.hudGap.innerHTML = `${gapVal.toFixed(1)} <span class="unit">%</span>`;
        elements.hudGapDelta.textContent = `${gapDelta > 0 ? '▲ 拡大' : gapDelta < 0 ? '▼ 縮小' : '不変'}`;
        elements.hudGapDelta.className = `hud-delta ${gapDelta > 0 ? 'text-negative' : gapDelta < 0 ? 'text-positive' : 'text-neutral'}`;

        // 就業調整
        const penaltyVal = data.results.L_penalty[lastIdx];
        elements.hudPenalty.innerHTML = `${penaltyVal.toFixed(2)} <span class="unit">%</span>`;
        elements.hudPenaltyDelta.textContent = penaltyVal > 0.0 ? "就業時間の下押し発生" : "安定稼働";
        elements.hudPenaltyDelta.className = `hud-delta ${penaltyVal > 0 ? 'text-negative' : 'text-positive'}`;

        // 生活実感インフレ
        const infVal = data.results.pi_living[lastIdx] * 100;
        const infDelta = infVal - (data.macro.pi[lastIdx] * 100);
        elements.hudInflation.innerHTML = `${infVal.toFixed(2)} <span class="unit">%</span>`;
        elements.hudInflationDelta.textContent = infDelta > 0.0 ? `実質物価差: +${infDelta.toFixed(2)}% (円安影響)` : "マクロ連動";
        elements.hudInflationDelta.className = `hud-delta ${infDelta > 0 ? 'text-negative' : 'text-neutral'}`;
    };

    // 🔄 6. UI同期・更新処理
    const handleSliderUpdate = () => {
        // スライダー横の数値表示を更新
        elements.valPass.textContent = `${Math.round(elements.sliderPass.value * 100)}%`;
        elements.valMw.textContent = `${(elements.sliderMw.value * 100).toFixed(1)}%`;
        
        const socialVal = parseFloat(elements.sliderSocial.value);
        elements.valSocial.textContent = `${socialVal >= 0 ? '+' : ''}${(socialVal * 100).toFixed(1)}%`;
        
        elements.valEtc.textContent = `${elements.sliderEtc.value} 兆円`;
        elements.valReskill.textContent = `${elements.sliderReskill.value} 兆円`;
        elements.valLoan.textContent = `${Math.round(elements.sliderLoan.value * 100)}%`;

        // 再シミュレーションの実行
        const simData = runSimulation();
        
        // 描画更新
        updateCharts(simData);
        updateHUD(simData);
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
        
        // 初期シミュレーションの実行
        const initialData = runSimulation();
        
        // チャートおよびHUDの初期描画
        initCharts(initialData);
        updateHUD(initialData);
        
        // 初期スライダーバッジ表記の同期
        elements.valPass.textContent = `${Math.round(elements.sliderPass.value * 100)}%`;
        elements.valMw.textContent = `${(elements.sliderMw.value * 100).toFixed(1)}%`;
        elements.valSocial.textContent = `+0.0%`;
        elements.valEtc.textContent = `${elements.sliderEtc.value} 兆円`;
        elements.valReskill.textContent = `${elements.sliderReskill.value} 兆円`;
        elements.valLoan.textContent = `${Math.round(elements.sliderLoan.value * 100)}%`;
    };

    initApp();
});
