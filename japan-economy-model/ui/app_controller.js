import { updateMacroState } from '../core_macro_engine/macro_math.js';

// DOMの参照を取得
const inputG = document.getElementById('input_G');
const inputTau = document.getElementById('input_tau');
const inputDeltaRMax = document.getElementById('input_delta_r_max');
const inputPiTarget = document.getElementById('input_pi_target');
const inputYPotential = document.getElementById('input_Y_potential');
const inputSteps = document.getElementById('input_steps');
const inputOp = document.getElementById('input_Op');
const btnExportCSV = document.getElementById('btn_export_csv');
const btnCopyURL = document.getElementById('btn_copy_url');
const toastNotification = document.getElementById('toast_notification');

// 初期状態 (t=0) 入力DOMの参照
const inputY0 = document.getElementById('input_Y0');
const inputB0 = document.getElementById('input_B0');
const inputPi0 = document.getElementById('input_pi0');
const inputR0 = document.getElementById('input_r0');
const inputE0 = document.getElementById('input_E0');
const inputBOJ0 = document.getElementById('input_BOJ0');

const valG = document.getElementById('val_G');
const valTau = document.getElementById('val_tau');
const valDeltaRMax = document.getElementById('val_delta_r_max');
const valPiTarget = document.getElementById('val_pi_target');
const valYPotential = document.getElementById('val_Y_potential');
const valSteps = document.getElementById('val_steps');
const valOp = document.getElementById('val_Op');

const footerTimeAxis = document.getElementById('footer_time_axis');
const canvas = document.getElementById('viewport');
const ctx = canvas.getContext('2d');

// 経済指標の上品なソリッドカラーパレット (モダン・クリーン・スタジオテーマ)
const COLORS = {
    Y: '#2d6a4f',   // GDP (ディープエメラルド)
    B: '#9b2c2c',   // 政府債務 (クラシックバーガンディ)
    pi: '#b57a15',  // インフレ率 (アンバーマスタード)
    r: '#2b6cb0',   // 政策金利 (コバルトブルー)
    USDJPY: '#8b5cf6', // 為替レート (パープル)
    B_boj: '#d53f8c' // 日銀保有国債 (マゼンタ)
};

// 動的に入力された初期値から整合的な初期状態オブジェクトを構築 (Hydration)
function getHydratedInitialState() {
    const Y0 = parseFloat(inputY0.value);
    const B0 = parseFloat(inputB0.value);
    const pi0 = parseFloat(inputPi0.value) / 100; // %から割合へ
    const r0 = parseFloat(inputR0.value) / 100;   // %から割合へ
    const E0 = parseFloat(inputE0.value);
    const BOJ0 = parseFloat(inputBOJ0.value);

    // 民間保有国債
    const B_private = Math.max(0, B0 - BOJ0);
    // 日銀当座預金 (初期比率 543.6 / 588.4 をベースにスケーリング)
    const J_pos = BOJ0 * (543.6 / 588.4);
    
    // 初期長期金利 R0 の自動算出
    const market_share = B0 > 0 ? (B0 - BOJ0) / B0 : 0.486;
    const term_premium = 0.0275 + 0.05 * (market_share - (556.6 / 1145.0));
    const B_Y_ratio = B0 / Y0;
    const base_ratio = 1145.0 / 691.9;
    const R0 = Math.max(r0, r0 + term_premium + 0.08 * Math.tanh(0.3 * (B_Y_ratio - base_ratio)));

    return {
        Y: Y0,
        C: Y0 * 0.55,
        I: Y0 * (0.20 - 0.5 * Math.max(0, R0 - 0.03)),
        B: B0,
        T: 83.7 * (Y0 / 691.9), // GDPに応じた初期税収スケーリング
        B_boj: BOJ0,
        J_pos: J_pos,
        B_private: B_private,
        pi: pi0,
        r: r0,
        R: R0,
        USDJPY: E0,
        delta_Y: 0,
        R_initial: R0,   // 利払い費平滑化用の初期長期金利をマウント
        E_initial: E0    // 為替インフレ効果用の初期為替レートをマウント
    };
}

// キャンバスのサイズを保持するグローバル変数
let logicalWidth = 900;
let logicalHeight = 580;

// Canvasの解像度自動フィッティング (Retina/High-DPI対応およびサイズ歪み防止)
function initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentNode;
    const rect = container.getBoundingClientRect();
    
    // コンテナ幅に論理サイズを合わせる
    logicalWidth = rect.width || 900;
    logicalHeight = rect.height || 580;
    
    // 最小高さを確保
    if (logicalHeight < 500) {
        logicalHeight = 500;
    }

    // 物理ピクセル数を設定してにじみを防ぐ
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    
    // CSS上の表示サイズを厳密に指定して拡大縮小によるボケを防ぐ
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    
    // 描画スケールをDPRに設定
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// シミュレーション計算
function calculateSimulation(policy, steps = 120) {
    let state = getHydratedInitialState();
    const history = [];
    history.push({ step: 0, ...state });

    for (let t = 1; t <= steps; t++) {
        state = updateMacroState(state, policy);
        history.push({ step: t, ...state });
    }
    return history;
}

// 各変数の描画スパン（min, max）を動的に決定（安全範囲あり）
function getScaleRange(key, values) {
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    let min = rawMin;
    let max = rawMax;

    switch (key) {
        case 'Y': // GDP
            min = Math.min(300, rawMin);
            max = Math.max(700, rawMax);
            break;
        case 'B': // 政府債務
            min = Math.min(800, rawMin);
            max = Math.max(1500, rawMax);
            break;
        case 'pi': // インフレ率 (割合表記)
            min = Math.min(-0.02, rawMin);
            max = Math.max(0.08, rawMax);
            break;
        case 'r': // 政策金利 (割合表記)
            min = 0; // 下限金利は0%
            max = Math.max(0.04, rawMax);
            break;
        case 'USDJPY': // 為替レート (円/ドル)
            min = Math.min(130, rawMin);
            max = Math.max(170, rawMax);
            break;
        case 'B_boj': // 日銀保有国債 (兆円)
            min = Math.min(300, rawMin);
            max = Math.max(1000, rawMax);
            break;
    }

    // 値が全く動かない場合のゼロ除算防止
    if (max - min < 1e-6) {
        max += 0.5;
        min -= 0.5;
    }

    // 上下に5%のマージンを追加
    const diff = max - min;
    min -= diff * 0.05;
    max += diff * 0.05;

    return { min, max };
}

// 描画メイン処理
function drawSimulation(history, steps = 120) {
    const width = logicalWidth;
    const height = logicalHeight;

    // パディング設定 (左端スケール表記および右端の複数行バッジ対応)
    const padLeft = 185; // 左端の最大・初期・最小リスト（約160px幅）が美しく収まるようにマージンを拡張
    const padRight = 210;
    const padTop = 50;
    const padBottom = 40;

    const graphWidth = width - padLeft - padRight;
    const graphHeight = height - padTop - padBottom;

    // キャンバスクリア
    ctx.clearRect(0, 0, width, height);

    // 背景グリッドの描画 (上品な薄いグレー)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 横軸の目盛り間隔をステップ数に応じて動的に決定
    let stepInterval = 30;
    if (steps <= 60) {
        stepInterval = 15;
    } else if (steps > 120) {
        stepInterval = 60;
    }

    // 横グリッド線（時間軸分割）
    for (let step = 0; step <= steps; step += stepInterval) {
        const x = padLeft + (step / steps) * graphWidth;
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, height - padBottom);
        ctx.stroke();

        // X軸時間ラベル
        ctx.fillStyle = '#718096';
        ctx.font = 'bold 10px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`t=${step}`, x, height - padBottom + 18);
    }

    // 縦グリッド線（値の基準分割）
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padTop + (i / gridLines) * graphHeight;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(width - padRight, y);
        ctx.stroke();
    }

    // 6つの指標ごとに折れ線を描画
    const keys = ['Y', 'B', 'pi', 'r', 'USDJPY', 'B_boj'];
    const finalValuesYPos = []; // 右端バッジの衝突回避用

    // 各変数の描画スパン（min, max）を動的に決定
    const scaleRanges = {};
    keys.forEach(key => {
        const values = history.map(item => item[key]);
        scaleRanges[key] = getScaleRange(key, values);
    });

    const startPoints = [];
    const endPoints = [];

    keys.forEach((key, keyIndex) => {
        const color = COLORS[key];
        const valRange = scaleRanges[key];
        const values = history.map(item => item[key]);
        
        const points = values.map((val, idx) => {
            const x = padLeft + (idx / steps) * graphWidth;
            const y = padTop + graphHeight - ((val - valRange.min) / (valRange.max - valRange.min)) * graphHeight;
            return { x, y };
        });

        // 線の描画
        ctx.strokeStyle = color;
        ctx.lineWidth = key === 'Y' ? 3.5 : 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // 始点・終点数値データの収集
        const startVal = history[0][key];
        const endVal = history[steps][key];
        const startX = points[0].x;
        const startY = points[0].y;
        const lastX = points[points.length - 1].x;
        const lastY = points[points.length - 1].y;

        // 各指標の表示数値フォーマット
        const formatExtremity = (v) => {
            if (key === 'Y' || key === 'B' || key === 'B_boj') return `${v.toFixed(1)}T`;
            if (key === 'pi' || key === 'r') return `${(v * 100).toFixed(2)}%`;
            if (key === 'USDJPY') return `${v.toFixed(1)}`;
            return v.toFixed(1);
        };

        startPoints.push({
            y: startY,
            text: `(${formatExtremity(startVal)})`,
            color: color
        });

        endPoints.push({
            y: lastY,
            text: `(${formatExtremity(endVal)})`,
            color: color
        });

        // 右端の動的バッジ描画
        const finalVal = endVal;
        const min = valRange.min;
        const max = valRange.max;

        // 右端バッジ重なり調整 (2行表示のため判定スパンを広めに)
        let adjustedY = lastY;
        for (let prevY of finalValuesYPos) {
            if (Math.abs(adjustedY - prevY) < 26) {
                adjustedY = prevY + (adjustedY > prevY ? 26 : -26);
            }
        }
        finalValuesYPos.push(adjustedY);

        // バッジレンダリング
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = color;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';

        // 表示数値のフォーマット
        let valText = '';
        let rangeText = '';
        const formatPercent = (v) => `${(v * 100).toFixed(2)}%`;
        const formatVal = (v) => v.toFixed(1);

        if (key === 'Y') {
            valText = `Y (GDP): ${formatVal(finalVal)}`;
            rangeText = `[${formatVal(min)} ~ ${formatVal(max)}]`;
        } else if (key === 'B') {
            // 政府債務が爆発した際の指数表示対応
            const displayVal = finalVal > 1e6 ? finalVal.toExponential(2) : formatVal(finalVal);
            const displayMin = min > 1e6 ? min.toExponential(2) : formatVal(min);
            const displayMax = max > 1e6 ? max.toExponential(2) : formatVal(max);
            valText = `B (債務): ${displayVal}`;
            rangeText = `[${displayMin} ~ ${displayMax}]`;
        } else if (key === 'pi') {
            valText = `π (インフレ): ${formatPercent(finalVal)}`;
            rangeText = `[${formatPercent(min)} ~ ${formatPercent(max)}]`;
        } else if (key === 'r') {
            valText = `r (金利): ${formatPercent(finalVal)}`;
            rangeText = `[${formatPercent(min)} ~ ${formatPercent(max)}]`;
        } else if (key === 'USDJPY') {
            valText = `E (為替): ${finalVal.toFixed(1)}円`;
            rangeText = `[${min.toFixed(1)} ~ ${max.toFixed(1)}]`;
        } else if (key === 'B_boj') {
            valText = `BOJ (日銀): ${formatVal(finalVal)}`;
            rangeText = `[${formatVal(min)} ~ ${formatVal(max)}]`;
        }

        // 最終値テキスト描画
        ctx.fillText(valText, lastX + 12, adjustedY - 2);
        
        // 現在のレンジ (Min/Max) を薄く併記
        ctx.fillStyle = '#718096';
        ctx.font = '10px sans-serif';
        ctx.fillText(rangeText, lastX + 12, adjustedY + 11);

        // 接続用補助ライン
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(lastX + 8, adjustedY + 2);
        ctx.stroke();

        // 表示数値のフォーマット (左端Min-Max/初期値視覚的ラベリング)
        let minLabel = '';
        let initialLabel = '';
        let maxLabel = '';
        
        const pct = (v) => `${(v * 100).toFixed(2)}%`;
        const val = (v) => v.toFixed(1);
        const initialVal = history[0][key];

        if (key === 'Y') {
            maxLabel = `🟢 GDP最大: ${val(max)} 兆円`;
            initialLabel = `🟢 GDP初期: ${val(initialVal)} 兆円`;
            minLabel = `🟢 GDP最小: ${val(min)} 兆円`;
        } else if (key === 'B') {
            const displayMin = min > 1e6 ? min.toExponential(2) : val(min);
            const displayMax = max > 1e6 ? max.toExponential(2) : val(max);
            const displayInitial = initialVal > 1e6 ? initialVal.toExponential(2) : val(initialVal);
            maxLabel = `🔴 国債最大: ${displayMax} 兆円`;
            initialLabel = `🔴 国債初期: ${displayInitial} 兆円`;
            minLabel = `🔴 国債最小: ${displayMin} 兆円`;
        } else if (key === 'pi') {
            maxLabel = `🟡 インフレ最大: ${pct(max)}`;
            initialLabel = `🟡 インフレ初期: ${pct(initialVal)}`;
            minLabel = `🟡 インフレ最小: ${pct(min)}`;
        } else if (key === 'r') {
            maxLabel = `🔵 金利最大: ${pct(max)}`;
            initialLabel = `🔵 金利初期: ${pct(initialVal)}`;
            minLabel = `🔵 金利最小: ${pct(min)}`;
        } else if (key === 'USDJPY') {
            maxLabel = `🟣 為替最大: ${max.toFixed(1)} 円`;
            initialLabel = `🟣 為替初期: ${initialVal.toFixed(1)} 円`;
            minLabel = `🟣 為替最小: ${min.toFixed(1)} 円`;
        } else if (key === 'B_boj') {
            maxLabel = `💗 日銀最大: ${val(max)} 兆円`;
            initialLabel = `💗 日銀初期: ${val(initialVal)} 兆円`;
            minLabel = `💗 日銀最小: ${val(min)} 兆円`;
        }

        // 【左端：縦軸スケール絶対値インジケータ】
        ctx.fillStyle = color;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';

        // 各指標の最大値・初期値・最小値ラベルを左端マージン(X=15)に縦3ブロックでプロット (6行用に12px行間調整)
        ctx.fillText(maxLabel, 15, padTop + (keyIndex * 12) + 4);
        ctx.fillText(initialLabel, 15, padTop + (graphHeight / 2) - 40 + (keyIndex * 12));
        ctx.fillText(minLabel, 15, height - padBottom - 75 + (keyIndex * 12));
    });

    // 端点衝突回避アルゴリズム (ソートして最小間隔12pxを維持)
    const startX = padLeft;
    const endX = padLeft + graphWidth;

    function resolveCollisions(points, minGap = 12) {
        points.sort((a, b) => a.y - b.y);
        for (let iter = 0; iter < 15; iter++) {
            let collisionFound = false;
            for (let i = 0; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];
                const diff = next.y - current.y;
                if (diff < minGap) {
                    collisionFound = true;
                    const overlap = minGap - diff;
                    current.y -= overlap / 2;
                    next.y += overlap / 2;
                }
            }
            if (!collisionFound) break;
        }
        // 上下はみ出しの制限
        points.forEach(p => {
            if (p.y < padTop + 8) p.y = padTop + 8;
            if (p.y > height - padBottom - 4) p.y = height - padBottom - 4;
        });
    }

    resolveCollisions(startPoints, 12);
    resolveCollisions(endPoints, 12);

    // 始点・終点数値の描画 (指示: 10px-11px、テーマカラー完全同調)
    ctx.font = 'bold 10px sans-serif';
    
    startPoints.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.textAlign = 'left';
        ctx.fillText(p.text, startX + 4, p.y + 3.5);
    });

    endPoints.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.textAlign = 'right';
        ctx.fillText(p.text, endX - 8, p.y + 3.5);
    });
}

// 可視化メインループ
function runVisualizationLoop() {
    // スライダーの最新値を取得
    const G = parseFloat(inputG.value);
    const tau = parseFloat(inputTau.value);
    const delta_r_max = parseFloat(inputDeltaRMax.value);
    const pi_target = parseFloat(inputPiTarget.value);
    const Y_potential = parseFloat(inputYPotential.value);
    const steps = parseInt(inputSteps.value, 10);
    const Op = parseFloat(inputOp.value);

    // バッジ数値の更新 (単位付きで動的結合)
    valG.textContent = G + ' 兆円';
    valTau.textContent = (tau * 100).toFixed(0) + '%';
    valDeltaRMax.textContent = (delta_r_max * 100).toFixed(2) + '%';
    valPiTarget.textContent = (pi_target * 100).toFixed(1) + '%';
    valYPotential.textContent = Y_potential + ' 兆円';
    valSteps.textContent = steps + ' 期';
    valOp.textContent = Op.toFixed(1) + ' 兆円/月';

    // フッター時間軸テキストの更新
    if (footerTimeAxis) {
        const years = (steps / 4).toFixed(1);
        footerTimeAxis.textContent = `時間軸 t = 0 ~ ${steps} (${years}年間)`;
    }

    // シミュレーション実行
    const policy = { G, tau, delta_r_max, pi_target, Y_potential, Op };
    const history = calculateSimulation(policy, steps);

    // キャンバスへ描画
    drawSimulation(history, steps);
}

// 初期化およびイベント登録
window.addEventListener('DOMContentLoaded', () => {
    initCanvas();

    // URLパラメータのハイドレーション処理
    const urlParams = new URLSearchParams(window.location.search);
    const paramMapping = [
        { key: 'G', dom: inputG },
        { key: 'tau', dom: inputTau },
        { key: 'delta_r_max', dom: inputDeltaRMax },
        { key: 'pi_target', dom: inputPiTarget },
        { key: 'Y_potential', dom: inputYPotential },
        { key: 'steps', dom: inputSteps },
        { key: 'Op', dom: inputOp },
        { key: 'Y0', dom: inputY0 },
        { key: 'B0', dom: inputB0 },
        { key: 'pi0', dom: inputPi0 },
        { key: 'r0', dom: inputR0 },
        { key: 'E0', dom: inputE0 },
        { key: 'BOJ0', dom: inputBOJ0 }
    ];

    paramMapping.forEach(item => {
        if (urlParams.has(item.key) && item.dom) {
            item.dom.value = urlParams.get(item.key);
        }
    });

    runVisualizationLoop();

    // 全てのスライダーおよび初期値入力に即時再計算イベントを適用
    const inputs = [
        inputG, inputTau, inputDeltaRMax, inputPiTarget, inputYPotential, inputSteps, inputOp,
        inputY0, inputB0, inputPi0, inputR0, inputE0, inputBOJ0
    ];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('input', runVisualizationLoop);
            input.addEventListener('change', runVisualizationLoop);
        }
    });

    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', exportToCSV);
    }

    if (btnCopyURL) {
        btnCopyURL.addEventListener('click', copyShareURL);
    }
});

// ウィンドウリサイズ対応
window.addEventListener('resize', () => {
    initCanvas();
    runVisualizationLoop();
});

// CSVエクスポート処理
function exportToCSV() {
    const G = parseFloat(inputG.value);
    const tau = parseFloat(inputTau.value);
    const delta_r_max = parseFloat(inputDeltaRMax.value);
    const pi_target = parseFloat(inputPiTarget.value);
    const Y_potential = parseFloat(inputYPotential.value);
    const steps = parseInt(inputSteps.value, 10);
    const Op = parseFloat(inputOp.value);

    const Y0 = parseFloat(inputY0.value);
    const B0 = parseFloat(inputB0.value);
    const pi0 = parseFloat(inputPi0.value);
    const r0 = parseFloat(inputR0.value);
    const E0 = parseFloat(inputE0.value);
    const BOJ0 = parseFloat(inputBOJ0.value);

    // シミュレーション実行
    const policy = { G, tau, delta_r_max, pi_target, Y_potential, Op };
    const history = calculateSimulation(policy, steps);

    // 日時フォーマット生成
    const now = new Date();
    const formattedDate = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const fileTimestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;

    let csvContent = "";
    
    // 1. 前提条件（メタデータ）の出力
    csvContent += "JAPAN-A_Core マクロ経済シミュレーション結果\n";
    csvContent += `エクスポート日時,${formattedDate}\n`;
    csvContent += "[前提条件 (Inputs)]\n";
    csvContent += "項目,設定値,単位,実態適合スケーリング後/説明\n";
    csvContent += `初期名目GDP(Y0),${Y0},兆円,開始時点(t=0)の名目GDP\n`;
    csvContent += `初期政府債務残高(B0),${B0},兆円,開始時点(t=0)の普通国債残高\n`;
    csvContent += `初期インフレ率(pi0),${pi0},%,開始時点(t=0)の年率インフレ率\n`;
    csvContent += `初期政策金利(r0),${r0},%,開始時点(t=0)の政策金利\n`;
    csvContent += `初期為替レート(E0),${E0},円/ドル,開始時点(t=0)の為替レート\n`;
    csvContent += `初期日銀国債保有量(BOJ0),${BOJ0},兆円,開始時点(t=0)の日銀保有国債残高\n`;
    csvContent += `政府支出(G),${G},兆円,実態適合スケーリング後: ${(G * (91.0 / 100)).toFixed(1)} 兆円 (令和8年度予算ベース)\n`;
    csvContent += `税率(tau),${(tau * 100).toFixed(0)},%,実効税率調整係数込で初期税収に適合\n`;
    csvContent += `利上げ上限パルス(delta_r_max),${(delta_r_max * 100).toFixed(2)},%,1期(四半期)あたりの最大金利変更幅\n`;
    csvContent += `目標インフレ率(pi_target),${(pi_target * 100).toFixed(1)},%,中央銀行の政策金利調整基準インフレ目標\n`;
    csvContent += `潜在GDP(Y_potential),${Y_potential},兆円,実態適合スケーリング後: ${(Y_potential * (691.9 / 500)).toFixed(1)} 兆円 (供給側上限)\n`;
    csvContent += `日銀国債買い入れ額(Op),${Op.toFixed(1)},兆円/月,量的金融政策 (QT/QEの境界は 3.0 兆円/月)\n`;
    csvContent += `シミュレーション期間(steps),${steps},期,1期=四半期 (合計: ${(steps / 4).toFixed(1)} 年間)\n`;
    csvContent += "\n";
    
    // 2. データヘッダー
    csvContent += "[シミュレーション時系列データ (Outputs)]\n";
    csvContent += "期 (step),名目GDP (Y) [兆円],消費 (C) [兆円],投資 (I) [兆円],政府債務残高 (B) [兆円],税収 (T) [兆円],日銀保有国債 (B_boj) [兆円],日銀当座預金負債 (J_pos) [兆円],民間保有国債 (B_private) [兆円],インフレ率 (pi) [%],政策金利 (r) [%],長期金利 (R) [%],為替レート (USDJPY) [円/ドル],利払い費 (interest_payment) [兆円],当座預金付利負担 (boj_interest_payment) [兆円]\n";

    // 3. データテーブル
    history.forEach(state => {
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
            `${state.USDJPY.toFixed(4)},` +
            `${state.interest_payment ? state.interest_payment.toFixed(4) : "34.3500"},` +
            `${state.boj_interest_payment ? state.boj_interest_payment.toFixed(4) : "1.3590"}\n`;
    });

    // BOM付きUTF-8としてBlob生成 (Excelでの文字化け防止)
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
    
    // ダウンロードトリガー
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `japan_macro_sim_results_${fileTimestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// URLコピー処理
function copyShareURL() {
    const params = new URLSearchParams();
    
    params.set('G', inputG.value);
    params.set('tau', inputTau.value);
    params.set('delta_r_max', inputDeltaRMax.value);
    params.set('pi_target', inputPiTarget.value);
    params.set('Y_potential', inputYPotential.value);
    params.set('steps', inputSteps.value);
    params.set('Op', inputOp.value);
    params.set('Y0', inputY0.value);
    params.set('B0', inputB0.value);
    params.set('pi0', inputPi0.value);
    params.set('r0', inputR0.value);
    params.set('E0', inputE0.value);
    params.set('BOJ0', inputBOJ0.value);

    const shareURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    // クリップボードへのコピー
    navigator.clipboard.writeText(shareURL).then(() => {
        // ボタンのテキスト変更によるフィードバック
        const originalText = btnCopyURL.textContent;
        btnCopyURL.textContent = "コピー完了！";
        btnCopyURL.style.backgroundColor = "#2d6a4f"; // 緑色に一時変更
        btnCopyURL.style.borderColor = "#2d6a4f";
        
        showToast("共有URLをクリップボードにコピーしました！");
        
        setTimeout(() => {
            btnCopyURL.textContent = originalText;
            btnCopyURL.style.backgroundColor = ""; // 元に戻す
            btnCopyURL.style.borderColor = "";
        }, 1500);
    }).catch(err => {
        console.error("URLコピーに失敗しました:", err);
        showToast("コピーに失敗しました。URLを選択して手動でコピーしてください。");
    });
}

function showToast(message) {
    if (toastNotification) {
        toastNotification.textContent = message;
        toastNotification.classList.add('show');
        setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 2500);
    }
}
