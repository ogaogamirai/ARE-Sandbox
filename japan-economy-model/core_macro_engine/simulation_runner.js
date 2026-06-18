import { updateMacroState } from './macro_math.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 指定ステップ数のシミュレーションを実行する関数 (日本経済実態モデル版)
 * @param {number} steps シミュレーションのステップ数 (デフォルト: 120)
 * @param {Object} [initialPolicy=null] カスタム政策パラメータ
 * @param {Object} [initialState=null] カスタム初期状態
 * @returns {Array<Object>} 各ステップ of 時系列データ
 */
export function runSimulation(steps = 120, initialPolicy = null, initialState = null) {
    const defaultPolicy = {
        G: 100,            // UI基準値 (内部でスケーリングされて G_policy = 91.0兆円)
        tau: 0.2,          // UI基準税率 (内部で実効適合されて 初期歳入83.7兆円)
        delta_r_max: 0.0025,
        pi_target: 0.02,
        Y_potential: 500,  // UI基準値 (内部でスケーリングされて Y_pot = 691.9兆円)
        Op: 6.0            // 日銀月間国債買い入れオペ額 (兆円/月)
    };

    const defaultState = {
        Y: 691.9,         // 名目GDP (令和8年度見通し)
        C: 380.5,         // GDPに占める消費 (名目GDPの約55%)
        I: 138.4,         // GDPに占める投資 (名目GDPの約20%)
        B: 1145.0,        // 普通国債残高 (令和8年度末見込)
        T: 83.7,          // フロー歳入
        B_boj: 588.4,     // 日銀保有国債ストック
        J_pos: 543.6,     // 日銀当座預金負債ストック
        B_private: 556.6, // 民間保有国債 (B - B_boj)
        pi: 0.02,         // 初期インフレ率 (2.0%)
        r: 0.0025,        // 政策金利 (0.25%)
        R: 0.03,          // 長期金利 (3.0%)
        USDJPY: 150.0,    // 為替レート (1ドル=150円)
        delta_Y: 0
    };

    const policy = { ...defaultPolicy, ...initialPolicy };
    let state = { ...defaultState, ...initialState };

    const history = [];

    // 初期状態 (t=0) を記録
    history.push({ step: 0, ...state });

    for (let t = 1; t <= steps; t++) {
        state = updateMacroState(state, policy);
        history.push({ step: t, ...state });
    }

    return history;
}

// 直接実行された場合の処理
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('simulation_runner.js'))) {
    console.log("=== JAPAN-A_Core Macro Simulation Engine Phase 3.6 ===");
    console.log("日本経済実態データ適合モデル：シミュレーションを実行中... (120ステップ)");

    // コマンドライン実行時のデフォルト政策パラメータ
    const policy = {
        G: 100,            // UI基準値
        tau: 0.2,          // UI基準税率
        delta_r_max: 0.0025,
        pi_target: 0.02,
        Y_potential: 500,  // UI基準値
        Op: 6.0            // 日銀月間国債買い入れオペ額
    };

    // コマンドライン実行時のデフォルト初期状態 (ハイドレーション用)
    const initialState = {
        Y: 691.9,
        C: 380.5,
        I: 138.4,
        B: 1145.0,
        T: 83.7,
        B_boj: 588.4,
        J_pos: 543.6,
        B_private: 556.6,
        pi: 0.02,
        r: 0.0025,
        R: 0.03,
        USDJPY: 150.0,
        delta_Y: 0
    };

    const results = runSimulation(120, policy, initialState);

    // 最初の10ステップ（t=0〜10）をJSON形式でコンソール出力
    console.log("\n--- シミュレーション結果 (最初の10ステップ: JSON形式) ---");
    console.log(JSON.stringify(results.slice(0, 11), null, 2));

    // テーブル形式でも出力して可読性を高める
    console.log("\n--- シミュレーション結果 (最初の10ステップ: 表形式) ---");
    console.table(results.slice(0, 11).map(item => ({
        step: item.step,
        Y: item.Y.toFixed(1) + "T",
        B: item.B.toFixed(1) + "T",
        T: item.T.toFixed(1) + "T",
        pi: (item.pi * 100).toFixed(2) + "%",
        r: (item.r * 100).toFixed(2) + "%",
        R: (item.R * 100).toFixed(2) + "%",
        USDJPY: item.USDJPY ? item.USDJPY.toFixed(1) : "150.0",
        B_private: item.B_private ? item.B_private.toFixed(1) + "T" : "556.6T"
    })));

    // 全タイムシリーズデータをシミュレーション結果ファイルに保存
    const outputPath = path.join(__dirname, 'simulation_results.json');
    try {
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`\n[SUCCESS] 日本経済実態シミュレーション結果 (JSON形式: 全120ステップ) を保存しました: ${outputPath}`);
    } catch (error) {
        console.error(`結果の保存中にエラーが発生しました: ${error.message}`);
    }

    // CSVファイルの自動保存処理 (前提条件と結果の統合出力)
    const now = new Date();
    const formattedDate = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const fileTimestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const csvOutputPath = path.join(__dirname, `simulation_results_${fileTimestamp}.csv`);
    
    // t=0 (初期状態) の動的な取得
    const t0 = results[0];

    let csvContent = "";
    csvContent += "JAPAN-A_Core マクロ経済シミュレーション結果\n";
    csvContent += `エクスポート日時,${formattedDate}\n`;
    csvContent += "[前提条件 (Inputs)]\n";
    csvContent += "項目,設定値,単位,実態適合スケーリング後/説明\n";
    csvContent += `初期名目GDP(Y0),${t0.Y.toFixed(1)},兆円,開始時点(t=0)の名目GDP (実態適合)\n`;
    csvContent += `初期政府債務残高(B0),${t0.B.toFixed(1)},兆円,開始時点(t=0)の普通国債残高 (実態適合)\n`;
    csvContent += `初期インフレ率(pi0),${(t0.pi * 100).toFixed(2)},%,開始時点(t=0)の年率インフレ率\n`;
    csvContent += `初期政策金利(r0),${(t0.r * 100).toFixed(2)},%,開始時点(t=0)の政策金利\n`;
    csvContent += `初期長期金利(R0),${(t0.R * 100).toFixed(2)},%,開始時点(t=0)の長期金利 (リスクプレミアム加味)\n`;
    csvContent += `初期為替レート(E0),${t0.USDJPY.toFixed(1)},円/ドル,開始時点(t=0)の為替レート\n`;
    csvContent += `初期日銀国債保有量(BOJ0),${t0.B_boj.toFixed(1)},兆円,開始時点(t=0)の日銀保有国債残高\n`;
    csvContent += `初期民間保有国債(B_private0),${t0.B_private.toFixed(1)},兆円,開始時点(t=0)の民間部門保有国債残高\n`;
    csvContent += `政府支出(G),${policy.G},兆円,実態適合スケーリング後: ${(policy.G * (91.0 / 100)).toFixed(1)} 兆円 (令和8年度予算ベース)\n`;
    csvContent += `税率(tau),${(policy.tau * 100).toFixed(0)},%,実効税率調整係数込で初期税収 83.7 兆円に適合\n`;
    csvContent += `利上げ上限パルス(delta_r_max),${(policy.delta_r_max * 100).toFixed(2)},%,1期(四半期)あたりの最大金利変更幅\n`;
    csvContent += `目標インフレ率(pi_target),${(policy.pi_target * 100).toFixed(1)},%,中央銀行 of Japan の政策金利調整基準インフレ目標\n`;
    csvContent += `潜在GDP(Y_potential),${policy.Y_potential},兆円,実態適合スケーリング後: ${(policy.Y_potential * (691.9 / 500)).toFixed(1)} 兆円 (供給側上限)\n`;
    csvContent += `日銀国債買い入れ額(Op),${policy.Op.toFixed(1)},兆円/月,量的金融政策 (QT/QEの境界は 3.0 兆円/月)\n`;
    csvContent += `シミュレーション期間(steps),120,期,1期=四半期 (合計: 30.0 年間)\n`;
    csvContent += "\n";
    
    csvContent += "[シミュレーション時系列データ (Outputs)]\n";
    csvContent += "期 (step),名目GDP (Y) [兆円],消費 (C) [兆円],投資 (I) [兆円],政府債務残高 (B) [兆円],税収 (T) [兆円],日銀保有国債 (B_boj) [兆円],日銀当座預金負債 (J_pos) [兆円],民間保有国債 (B_private) [兆円],インフレ率 (pi) [%],政策金利 (r) [%],長期金利 (R) [%],為替レート (USDJPY) [円/ドル],利払い費 (interest_payment) [兆円],当座預金付利負担 (boj_interest_payment) [兆円]\n";

    results.forEach(state => {
        csvContent += `${state.step},` +
            `${state.Y.toFixed(4)},` +
            `${state.C.toFixed(4)},` +
            `${state.I.toFixed(4)},` +
            `${state.B.toFixed(4)},` +
            `${state.T.toFixed(4)},` +
            `${state.B_boj.toFixed(4)},` +
            `${state.J_pos.toFixed(4)},` +
            `${state.B_private.toFixed(4)},` +
            `${(state.pi * 100).toFixed(4)},` +
            `${(state.r * 100).toFixed(4)},` +
            `${(state.R * 100).toFixed(4)},` +
            `${state.USDJPY ? state.USDJPY.toFixed(4) : "150.0000"},` +
            `${state.interest_payment ? state.interest_payment.toFixed(4) : "34.3500"},` +
            `${state.boj_interest_payment ? state.boj_interest_payment.toFixed(4) : "1.3590"}\n`;
    });

    try {
        // Excel文字化け防止のため BOM付きUTF-8 で保存 (\ufeff を先頭に付与)
        fs.writeFileSync(csvOutputPath, '\ufeff' + csvContent, 'utf-8');
        console.log(`[SUCCESS] 日本経済実態シミュレーション結果 (BOM付CSV形式) を保存しました: ${csvOutputPath}`);
    } catch (error) {
        console.error(`CSV形式結果の保存中にエラーが発生しました: ${error.message}`);
    }
}
