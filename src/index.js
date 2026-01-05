const { recognizeCardsWithReference, startGame, init } = require('./core/cardCounter.js');
const fs = require('fs');
// 参数设置
const templateFolder = './templates';
const referenceInfo = { width: 1040, height: 629, name: '原始截图' };
const options = {
    threshold: 0.9,
    debug: true,
    saveResultImage: true,
    scaleMode: 'fixed', // ⭐ 新增：'fixed' | 'reference'
    scaleRange: 0.1,      // ±10%缩放范围
    maxScales: 2,         // 3个缩放版本
    earlyExit: true,      // 启用提前退出
    nmsEnabled: true,
    nmsOverlapThresh: 0.5
};
init(templateFolder)
startGame()
// 循环处理所有图片
fs.readdirSync('./screenshots').forEach(file => {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
        const imagePath = `./screenshots/${file}`;
        try {
            const result = recognizeCardsWithReference(imagePath, referenceInfo, options);
            console.log(result.remainingCountMap);
        } catch (e) {
            console.log(`  错误: ${e.message}`);
        }
    }
});