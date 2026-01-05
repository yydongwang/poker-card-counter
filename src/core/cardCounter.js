const cv = require('@u4/opencv4nodejs');
const fs = require('fs');
const path = require('path');
const { getAllPngFiles, calculateScaleInfo, nonMaximumSuppression } = require('../utils');
// 不同玩法的规则
const GAME_RULES = {
    paodekuai: {
        order: ['2', 'a', 'k', 'q', 'j', '10', '9', '8', '7', '6', '5', '4', '3'],
        count: {
            '2': 1,
            'a': 3,
            'k': 4,
            'q': 4,
            'j': 4,
            '10': 4,
            '9': 4,
            '8': 4,
            '7': 4,
            '6': 4,
            '5': 4,
            '4': 4,
            '3': 4,
        }
    },
    doudizhu: {
        order: ['2', 'a', 'k', 'q', 'j', '10', '9', '8', '7', '6', '5', '4', '3'],
        count: {
            '2': 4,
            'a': 4,
            'k': 4,
            'q': 4,
            'j': 4,
            '10': 4,
            '9': 4,
            '8': 4,
            '7': 4,
            '6': 4,
            '5': 4,
            '4': 4,
            '3': 4,
        }
    }
};
// value -> 剩余可用张数
const remainingCountMap = new Map();
const remainingCountMap_inend = new Map();
// 所有模板（模块加载时就准备好）看看能不能集成到本地缓存
const templateFiles = [];
function preloadTemplates(templateFolder) {
    const files = getAllPngFiles(templateFolder);
    files.forEach(p => {
        const fileName = path.basename(p, '.png');
        const match = fileName.match(pokerTemplateRegex);
        if (!match) return;
        const mat = cv.imread(p);
        templateFiles.push({
            path: p,
            fileName,
            suit: match[1],
            value: match[2],
            mat,        // 原始模板 Mat
        });
    });
    console.log(`📦 模板预加载完成：${templateFiles.length} 张`);
}
function startGame(gameType = 'paodekuai') {
    if (!templateFiles.length) {
        throw new Error('请先预加载模板');
    }
    isGameRunning = true;
    // 本局模板池：浅拷贝一份

    console.log('游戏开始');
}
function endGame() {
    isGameRunning = false;
    console.log('🛑 游戏结束');
    remainingCountMap.clear();
    return remainingCountMap_inend
}
//用来过滤分数误差标记模板出错
// 历史最优识别结果（一局游戏内）
const recognizedBestMap = new Map();
// key: templateKey (如 hongtao_A)
// value: { score, cardResult }
// ---------------------------
// 模板缓存
const templateCache = new Map();
// 过滤正则：只识别扑克牌模板
const pokerTemplateRegex = /^(fangkuai|heitao|hongtao|hongxin|meihua)_([a-zA-Z0-9]+)/i;


/**
 * 基于参考尺寸的智能识别（带NMS）
 * @param {string} imagePath - 要识别的图片路径
 * @param {string} templateFolder - 模板文件夹路径
 * @param {Object} referenceInfo - 参考图片信息（制作模板时的原图）
 * @param {Object} options - 配置选项
 * @returns {Object} 识别结果
 */
function recognizeCardsWithReference(
    imagePath,
    referenceInfo = {
        width: 1920,    // 制作模板时的原图宽度
        height: 1080,   // 制作模板时的原图高度
        name: 'reference_1080p'  // 参考图片描述
    },
    options = {}
) {
    const startTime = Date.now();
    const {
        threshold = 0.8,
        saveResultDir = './test_results',
        debug = false,
        saveResultImage = false,
        scaleRange = 0.1,
        nmsEnabled = true,
        nmsOverlapThresh = 0.5,
        maxScales = 3,
        scaleMode = 'fixed', // ⭐ 新增：'fixed' | 'reference'
        earlyExit = true  // 新增：是否启用提前退出
    } = options;

    if (saveResultImage && !fs.existsSync(saveResultDir)) {
        fs.mkdirSync(saveResultDir, { recursive: true });
    }

    const img = cv.imread(imagePath);
    // 获取目标图片信息
    const targetInfo = {
        width: img.cols,
        height: img.rows,
        aspectRatio: img.cols / img.rows
    };

    // 计算缩放信息
    // const scaleInfo = calculateScaleInfo(targetInfo, referenceInfo);
    // 🚫 暂时关闭缩放：模板原尺寸匹配
    let scaleInfo = null;
    if (scaleMode === 'reference') {
        scaleInfo = calculateScaleInfo(targetInfo, referenceInfo);
    }
    if (debug) {
        console.log(`提前退出: ${earlyExit ? '启用' : '禁用'}`);
        console.log(`NMS启用: ${nmsEnabled}, 重叠阈值: ${nmsOverlapThresh}`);
    }
    if (debug && scaleInfo) {
        console.log('=== Scale Info ===');
        console.log('\n=== 缩放计算信息 ===');
        console.log(`目标图片: ${targetInfo.width}×${targetInfo.height} (宽高比: ${targetInfo.aspectRatio.toFixed(3)})`);
        console.log(`参考图片: ${referenceInfo.width}×${referenceInfo.height} (${referenceInfo.name})`);
        console.log(`宽度缩放: ${scaleInfo.widthScale.toFixed(3)}`);
        console.log(`高度缩放: ${scaleInfo.heightScale.toFixed(3)}`);
        console.log(`平均缩放: ${scaleInfo.avgScale.toFixed(3)}`);
        console.log(`宽高比差异: ${scaleInfo.aspectRatioDiff.toFixed(3)}`);
        console.log(`宽高比是否相似: ${scaleInfo.isAspectRatioSimilar ? '是' : '否'}`);
    }
    let allMatches = [];
    let firstTemplateSize = null;
    // 预计算缩放比例就是目标图片跟参考图片的缩放比例
    let baseScale;

    if (scaleMode === 'reference') {
        baseScale = scaleInfo.avgScale;
    } else {
        // fixed
        baseScale = 1; // 通常就是 1
    }
    const scales = [baseScale];

    if (scaleRange > 0 && maxScales > 1) {
        const scaleStep = (scaleRange * 2) / (maxScales - 1);
        for (let i = 1; i < maxScales; i++) {
            const scale = baseScale * (1 - scaleRange + (scaleStep * (i - 1)));
            if (Math.abs(scale - baseScale) > 0.05) {
                scales.push(scale);
            }
        }
    }

    if (debug) {
        console.log(`使用的缩放比例: ${scales.map(s => s.toFixed(3)).join(', ')}`);
    }
    // 分批处理模板
    const batchSize = 5;
    for (let batchStart = 0; batchStart < templateFiles.length; batchStart += batchSize) {
        const batchFiles = templateFiles.slice(batchStart, batchStart + batchSize);
        batchFiles.forEach(template => {
            const { suit, value, mat } = template;
            // 保存第一个模板尺寸
            if (firstTemplateSize === null) {
                firstTemplateSize = {
                    width: mat.cols,
                    height: mat.rows
                };
            }
            let bestMatch = { maxVal: 0, maxLoc: null, scale: 1 };
            // 使用预计算的缩放比例
            for (const scale of scales) {
                const scaledWidth = Math.round(mat.cols * scale);
                const scaledHeight = Math.round(mat.rows * scale);
                // 跳过过大的模板
                if (scaledWidth > img.cols || scaledHeight > img.rows) {
                    continue;
                }
                // 缩放模板
                const scaledTemplate = mat.resize(scaledHeight, scaledWidth);
                // 执行模板匹配
                const result = img.matchTemplate(scaledTemplate, cv.TM_CCOEFF_NORMED);
                const { maxVal, maxLoc } = result.minMaxLoc();
                if (maxVal > bestMatch.maxVal) {
                    bestMatch = { maxVal, maxLoc, scale };
                }
                // 提前退出优化：如果分数足够高就停止搜索其他缩放版本
                if (earlyExit && bestMatch.maxVal > 0.96) {
                    if (debug) {
                        console.log(`模板 ${suit}${value}: 提前退出，分数 ${bestMatch.maxVal.toFixed(3)}`);
                    }
                    break;
                }
            }
            // 检查是否达到阈值
            if (bestMatch.maxVal >= threshold) {
                const adjustedWidth = Math.round(mat.cols * bestMatch.scale);
                const adjustedHeight = Math.round(mat.rows * bestMatch.scale);
                allMatches.push({
                    suit,
                    value,
                    score: bestMatch.maxVal,
                    position: {
                        x: bestMatch.maxLoc.x,
                        y: bestMatch.maxLoc.y
                    },
                    size: {
                        width: adjustedWidth,
                        height: adjustedHeight
                    },
                    scale: bestMatch.scale
                });
            }
        });
        // 显示进度
        if (debug && batchStart + batchSize < templateFiles.length) {
            const progress = Math.min(batchStart + batchSize, templateFiles.length);
            console.log(`处理进度: ${progress}/${templateFiles.length}`);
        }
    }


    // 应用非极大值抑制
    let recognizedCards = nmsEnabled
        ? nonMaximumSuppression(allMatches, nmsOverlapThresh)
        : allMatches;

    // ===== 新增：和历史最优结果对比 ===== 
    // TODO 待测试这里可能可以还能优化速度就是在有第一次结果集之后后面就不用全部结果集循环只需要上面刚开始的时候第一次查看是否有该扑克就直接不标记true就行
    recognizedCards.forEach(card => {
        const { suit, value, score, templateRef } = card;
        const key = `${suit}_${value}`; // ✅ key 用花色+数字
        const prev = recognizedBestMap.get(key);
        if (!prev) {
            const remain = remainingCountMap.get(value);
            recognizedBestMap.set(key, { score, card });
            remainingCountMap.set(value, remain - 1);
        }
    });
    const matchCount = recognizedCards.length;
    if (debug) {
        console.log(`\n=== 匹配统计 ===`);
        console.log(`原始匹配数: ${allMatches.length}`);
        console.log(`NMS后匹配数: ${matchCount}`);
        console.log(`抑制了 ${allMatches.length - matchCount} 个重复匹配`);
    }

    let resultImagePath = null;
    if (saveResultImage) {
        const resultImg = img.copy();

        recognizedCards.forEach((card, index) => {
            const topLeft = new cv.Point(card.position.x, card.position.y);
            const bottomRight = new cv.Point(
                topLeft.x + card.size.width,
                topLeft.y + card.size.height
            );

            // 绘制矩形
            resultImg.drawRectangle(
                topLeft,
                bottomRight,
                new cv.Vec(0, 255, 0),
                2,
                cv.LINE_8
            );

            // 绘制文本标签
            const label = `${card.suit}`.slice(0, 2);
            resultImg.putText(
                label,
                new cv.Point(topLeft.x, topLeft.y - 5),
                cv.FONT_HERSHEY_SIMPLEX,
                0.6,
                new cv.Vec(0, 255, 0),
                2
            );

            // 绘制匹配分数（调试模式）
            if (debug) {
                const scoreText = `${card.score.toFixed(3)}`;
                resultImg.putText(
                    scoreText,
                    new cv.Point(topLeft.x, topLeft.y + card.size.height + 20),
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.4,
                    new cv.Vec(255, 200, 0),
                    1
                );
                // 绘制序号
                resultImg.putText(
                    `#${index + 1}`,
                    new cv.Point(topLeft.x + 5, topLeft.y + 15),
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    new cv.Vec(255, 255, 255),
                    1
                );
            }
        });
        // 保存结果图片
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        resultImagePath = path.join(saveResultDir, `result_${timestamp}.jpg`);
        cv.imwrite(resultImagePath, resultImg);
        if (debug) {
            console.log(`结果图片已保存: ${resultImagePath}`);
        }
    }

    // 按位置排序
    recognizedCards.sort((a, b) => {
        const rowThreshold = 50;
        if (Math.abs(a.position.y - b.position.y) < rowThreshold) {
            return a.position.x - b.position.x;
        }
        return a.position.y - b.position.y;
    });

    // 计算估算的卡片尺寸
    let estimatedCardSize = { width: 0, height: 0 };
    if (firstTemplateSize) {
        if (scaleMode === 'fixed') {
            // ✅ 固定模式：不缩放，模板即真实尺寸
            estimatedCardSize = {
                width: firstTemplateSize.width,
                height: firstTemplateSize.height
            };
        } else {
            // ✅ 自适应模式：按参考图比例缩放
            estimatedCardSize = {
                width: Math.round(firstTemplateSize.width * scaleInfo.avgScale),
                height: Math.round(firstTemplateSize.height * scaleInfo.avgScale)
            };
        }
    }

    const totalTime = Date.now() - startTime;
    console.log(`总耗时: ${totalTime}ms`);
    if (debug) {
        console.log(`\n=== 性能统计 ===`);
        console.log(`模板数量: ${templateFiles.length}`);
        console.log(`缩放版本数: ${scales.length}`);
        console.log(`总匹配次数: ${templateFiles.length * scales.length}`);
    }
    return {
        remainingCountMap,
        matchCount,
        resultImagePath,
        originalMatchesCount: allMatches.length,
        scaleInfo: {
            ...scaleInfo,
            estimatedCardSize: estimatedCardSize
        },
        imageInfo: targetInfo,
        referenceInfo: referenceInfo,
        performance: {
            totalTime,
            templateCount: templateFiles.length,
            scaleCount: scales.length
        }
    };
}
function init(templateFolder) {
    const rule = GAME_RULES['paodekuai'];
    rule.order.forEach(value => {
        remainingCountMap_inend.set(value, rule.count[value]);
        remainingCountMap.set(value, rule.count[value]);
    });
    preloadTemplates(templateFolder);
}
// 导出函数
module.exports = {
    init,
    startGame,
    endGame,
    recognizeCards: recognizeCardsWithReference,
    recognizeCardsWithReference,
    nonMaximumSuppression,
    calculateScaleInfo
};