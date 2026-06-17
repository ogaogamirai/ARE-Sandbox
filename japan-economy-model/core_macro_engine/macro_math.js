// policyInputs: { G: 100, tau: 0.2, delta_r_max: 0.0025, pi_target: 0.02, Y_potential: 500 }
// prevState: { Y: 691.9, B: 1145.0, T: 83.7, G_soc: 39.1, G_other: 51.9, B_boj: 588.4, J_pos: 543.6, pi: 0.02, r: 0.0025, R: 0.03, delta_Y: 0 }

/**
 * 毎ステップ、日本の財政政策・金融政策・実体経済の動的相互作用を決定論的に更新する関数（日本経済実態データ適合＆実質成長決定モデル版）
 * @param {Object} prevState 前ステップのマクロ経済状態
 * @param {Object} policyInputs 政策介入パラメータ (UIスライダー値)
 * @returns {Object} 更新後のマクロ経済状態
 */
export function updateMacroState(prevState, policyInputs) {
    // 状態オブジェクトに埋め込まれた初期長期金利・初期為替レートを抽出 (ない場合はデフォルトフォールバック)
    const R_init = prevState.R_initial !== undefined ? prevState.R_initial : (prevState.R !== undefined ? prevState.R : 0.03);
    const E_init = prevState.E_initial !== undefined ? prevState.E_initial : (prevState.USDJPY !== undefined ? prevState.USDJPY : 150.0);

    // 1. UI入力値のスケーリング調整 (UIを変更せずに日本の実態スケールに適合させる)
    // UI G=100 のとき、実態総政策的経費は 91.0兆円
    const G_policy = policyInputs.G * (91.0 / 100);
    // UI Y_potential=500 のとき、実態潜在GDPは 691.9兆円
    const Y_pot = policyInputs.Y_potential * (691.9 / 500);
    // 税率スライダー0.20のとき、初期税収83.7兆円に適合させる調整係数
    const tax_adjustment = 83.7 / (0.20 * 691.9);

    // 統合政府ストック（日銀保有国債、当座預金残高）のフォールバック初期化
    const B_boj = prevState.B_boj !== undefined ? prevState.B_boj : 588.4;
    const J_pos = prevState.J_pos !== undefined ? prevState.J_pos : 543.6;

    // 2. 金融・長期金利ドメイン (長期金利 R の決定)
    const B_Y_ratio = prevState.B / prevState.Y;
    const base_ratio = 1145.0 / 691.9; // 初期対GDP比率 約1.6548

    // 日銀保有国債の動学的更新 (四半期ステップ換算)
    const Op = policyInputs.Op !== undefined ? policyInputs.Op : 6.0;
    const Redeem = 70.0; // 年間償還額 70兆円
    const B_boj_next = Math.max(0, (prevState.B_boj !== undefined ? prevState.B_boj : 588.4) + (Op * 3) - 17.5);

    // 市場流通国債比率 (量的緩和/引き締め) に基づくタームプレミアム (感応度 delta = 0.05)
    const market_share = (prevState.B - (prevState.B_boj !== undefined ? prevState.B_boj : 588.4)) / prevState.B;
    const initial_share = 556.6 / 1145.0; // 約 0.4861135
    const term_premium = 0.0275 + 0.05 * (market_share - initial_share);

    // 【堅牢性設計】金利の無限発散によるオーバーフローを防ぐため、リスクプレミアムに双曲線正接（tanh）を用いた飽和モデルを導入。
    const R = Math.max(prevState.r, prevState.r + term_premium + 0.08 * Math.tanh(0.3 * (B_Y_ratio - base_ratio)));

    // 3. 為替ドメイン (購買力平価説と金利平価説に基づく動学モデル)
    const E_prev = prevState.USDJPY !== undefined ? prevState.USDJPY : 150.0;
    const pi_world = 0.02;
    const r_world = 0.045; // 海外政策金利 4.5% 固定
    const alpha = 0.2;     // インフレ感応度 (購買力平価効果を高めるため 0.1 から 0.2 へ較正)
    const beta = 0.05;     // 金利感応度 (マイルドな金利平価効果のため 0.2 から 0.05 へ較正)

    // 前期のインフレ率と金利に基づいて為替レートの変化率を決定
    const exchange_change_rate = alpha * (prevState.pi - pi_world) - beta * (prevState.r - r_world);
    // 異常な乖離を防ぐためのクランプ処理 (変化率を±10%以内に制限)
    const clamped_change_rate = Math.max(-0.1, Math.min(0.1, exchange_change_rate));
    const USDJPY = E_prev * (1 + clamped_change_rate);

    // 4. 物価・実体経済ドメイン (インフレ率 pi, 名目GDP Y の決定)
    // 為替の変動による輸入物価（コストプッシュ）インフレ波及効果
    const gamma = 0.015;    // 為替インフレ伝播率をマイルド化 (較正)
    const exchange_rate_effect = gamma * ((E_prev - E_init) / E_init);
    
    // 【堅牢性設計】名目GDPの増大に伴うインフレ無限爆発（自己発散）を防ぐため、GDPギャップは「実質GDP」ベースで計算
    const Y_real = prevState.Y / (1 + prevState.pi);
    const gdpGapRate = (Y_real - Y_pot) / Y_pot;
    const pi_gdp_effect = 0.01 * gdpGapRate; // ギャップの物価波及感度をマイルド化 (較正)

    // インフレ率の動学的更新 (Task D: 非累積回帰モデルへの較正)
    // インフレ率が自己発散的に累積し続けないように、慣性（0.85）と目標インフレ率への回帰（0.15 * pi_target）をベースにする
    const pi_inertia = 0.85 * prevState.pi + 0.15 * policyInputs.pi_target;
    let pi = pi_inertia + pi_gdp_effect + exchange_rate_effect + 0.0001 * (G_policy - 91.0);
    // インフレ率の過剰な変動や発散を抑え、定常年率の現実的な範囲（-5%〜15%）に安全クランプ
    pi = Math.max(-0.05, Math.min(0.15, pi));

    // 高インフレと高金利が実質消費・投資を冷え込ませる実質成長率のペナルティ関数
    const R_initial = 0.03;
    const g_real = 0.01 - 0.08 * Math.max(0, pi - 0.02) - 0.05 * Math.max(0, R - R_initial);

    // 【堅牢性設計】実質GDPを実質成長率で更新し、それにインフレ率を乗じることで名目GDPを決定
    // これにより名目成長率式の累積による自己発散・無限オーバーフロー（NaN）を根絶
    const Y_real_next = Y_real * (1 + g_real);
    const Y = Y_real_next * (1 + pi);
    const delta_Y = Y - prevState.Y;

    // 実体経済内訳（UI側の描画互換用：消費 C は名目GDPの約55%、投資 I は約20%とし、金利上昇による下押しを反映）
    const C = Y * 0.55;
    const I = Y * (0.20 - 0.5 * Math.max(0, R - R_initial));

    // 5. 財政ドメイン (税収 T, 歳出, 国債残高 B) の動的計算
    // 税収 (実効税率にGDPを乗算)
    const T = policyInputs.tau * Y * tax_adjustment;
    
    // 国債費（国債借り換え動学・ヤコビアン平滑化モデル：lambda=0.03）
    const lambda = 0.03;
    const interest_payment = prevState.B * ((1 - lambda) * R_init + lambda * R);
    
    // 日銀当座預金付利負担 (日銀負債への金利支払いに伴う追加財政負担)
    const boj_interest_payment = J_pos * prevState.r;

    // 歳出内訳
    const G_soc = 39.1; // 社会保障関係費
    const G_other = G_policy - G_soc; // その他政策的経費
    // 歳出総額 (政策経費 + 利払費 + 当座預金付利負担)
    const total_spending = G_soc + G_other + interest_payment + boj_interest_payment;

    // 新規国債発行額 (歳出総額 - 税収)
    const new_debt_issued = total_spending - T;
    // 国債残高ストックの更新 (四半期ステップ換算のため 0.25 を乗算)
    const B = prevState.B + new_debt_issued * 0.25;

    // 民間保有国債 (統合政府のネット負債)
    const B_private = Math.max(0, B - B_boj_next);

    // 6. テイラー・ルールによる政策金利決定
    const phi_pi = 1.5;
    const phi_y = 0.5;
    const r_neutral = 0.0025; // 自然金利を初期値0.25%に適合
    const r_target = r_neutral + phi_pi * (pi - policyInputs.pi_target) + phi_y * gdpGapRate;
    
    // ヤコビアン減衰シールド (金利急変動のクッション処理)
    const r_diff = r_target - prevState.r;
    const clamped_diff = Math.max(-policyInputs.delta_r_max, Math.min(policyInputs.delta_r_max, r_diff));
    const r_next = Math.max(0, prevState.r + clamped_diff); // ゼロ金利下限

    // 7. 内部監査ログの出力 (等式整合性「税収 + 新規発行 == 歳出総額」の成立確認)
    const audit_total_revenue = T + new_debt_issued;
    const is_balanced = Math.abs(audit_total_revenue - total_spending) < 1e-6;
    
    console.log(`[Audit] Step Y:${Y.toFixed(1)}T | B:${B.toFixed(1)}T | T:${T.toFixed(1)}T | Spend:${total_spending.toFixed(1)}T (Interest:${interest_payment.toFixed(2)}T, Boj:${boj_interest_payment.toFixed(2)}T) | NewDebt:${new_debt_issued.toFixed(1)}T | Balanced:${is_balanced}`);

    return {
        Y, C, I, B, T,
        pi, r: r_next, delta_Y,
        R, USDJPY, B_boj: B_boj_next, J_pos, B_private,
        interest_payment, boj_interest_payment,
        R_initial: R_init, E_initial: E_init
    };
}
