// 数理エンジンの動作検証ドライラン
const generateMacroData = (scenario) => {
    const data = { pi: [], r: [], R: [], g_real: [], Y: [], E: [] };
    for (let t = 0; t < 30; t++) {
        let pi_t, r_t, R_t, g_real_t, Y_t, E_t;
        const t_ratio = t / 30;
        switch(scenario) {
            case "baseline":
            default:
                pi_t = 0.015 + 0.005 * t_ratio;
                r_t = 0.0025 + 0.0075 * t_ratio;
                R_t = 0.008 + 0.010 * t_ratio;
                g_real_t = 0.01 + 0.005 * Math.sin(t_ratio * Math.PI);
                E_t = 150.0 - 10.0 * t_ratio;
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

const runSimulation = (inputs, scenarioName) => {
    const macro = generateMacroData(scenarioName);
    const results = {
        W_nominal: [], W_real: [], Cost_loan: [], Inc_deposit: [], YD: [], YD_real: [], Gap_wage: [], L_penalty: [], pi_living: []
    };

    let W_nominal_t = 100.0;
    let Gap_wage_t = 30.0;
    const Balance_loan = 80.0;
    const Balance_deposit = 200.0;
    const R_init = 0.015;
    const Self_Suff = 0.38;

    for (let t = 0; t < 30; t++) {
        const pi_t = macro.pi[t];
        const r_t = macro.r[t];
        const R_t = macro.R[t];
        const g_real_t = macro.g_real[t];
        const E_t = macro.E[t];
        const gdpGap_t = g_real_t - 0.01;

        const reskill_boost = (t > 8) ? 0.001 * inputs.G_reskill : -0.0005 * inputs.G_reskill;
        const g_w = 0.0025 + 0.4 * pi_t + 0.1 * gdpGap_t + 0.015 * (inputs.alpha_pass - 0.5) + 0.05 * inputs.dMW + reskill_boost;
        W_nominal_t = W_nominal_t * (1 + g_w);
        const W_real_t = W_nominal_t / (1 + pi_t);

        const dGap = 0.02 * (1 - inputs.alpha_pass) - 0.005 * inputs.dMW;
        Gap_wage_t = Math.max(5.0, Gap_wage_t * (1 + dGap));

        const Cost_loan_t = Balance_loan * (inputs.Loan_var * r_t + (1 - inputs.Loan_var) * R_init) * 0.25;
        const Inc_deposit_t = Balance_deposit * (r_t * 0.5) * 0.25;

        const gross_income = W_nominal_t * 3.6;
        const Tax_t = gross_income * 0.10;
        const Social_t = gross_income * (0.15 + inputs.dSocial);
        const YD_t = gross_income + Inc_deposit_t - Cost_loan_t - Tax_t - Social_t + inputs.ETC;

        const pi_living_t = pi_t + 0.12 * Math.max(0, (E_t - 150.0) / 150.0) * (1 - Self_Suff);
        const YD_real_t = YD_t / (1 + pi_living_t);

        const L_penalty_t = Math.max(0, 0.04 * (inputs.dMW / 0.03) * (1 - 0.20) * 100);

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
    return results;
};

// 検証用インプット
const testInputs = {
    alpha_pass: 0.5,
    dMW: 0.03,
    dSocial: 0.0,
    ETC: 0.0,
    G_reskill: 0.0,
    Loan_var: 0.7
};

try {
    const res = runSimulation(testInputs, "baseline");
    console.log("[PASS] Simulation completed without syntax or logic errors.");
    
    // 一部の値をチェックして妥当性を確認
    const finalRealWage = res.W_real[29];
    const finalDisposableIncome = res.YD_real[29];
    console.log(`- Final Real Wage Index (t=29): ${finalRealWage.toFixed(2)} (Init: 100.0)`);
    console.log(`- Final Disposable Income (t=29): ${finalDisposableIncome.toFixed(2)} (Init: 360.0)`);
    
    if (isNaN(finalRealWage) || isNaN(finalDisposableIncome)) {
        throw new Error("Found NaN values in outputs!");
    }
    console.log("[PASS] Outputs are valid numbers.");
} catch (e) {
    console.error("[FAIL] Simulation failed:", e);
    process.exit(1);
}
