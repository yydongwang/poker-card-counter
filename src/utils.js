const fs = require('fs');
const path = require('path');
/**
 * 过滤已超出最大数量的牌
 * @param recognizedCards 本次识别出的牌数组
 * @param recognizedBestMap 历史最优识别结果 Map
 * @param cardMaxCountMap 每张牌最大数量配置
 * @returns 过滤后的可用牌数组
 */
function filterByHistory(
  recognizedCards,
  recognizedBestMap,
  cardMaxCountMap
) {
  const filtered = [];
  recognizedCards.forEach(card => {
    const key = `${card.suit}_${card.value}`;
    const maxCount = cardMaxCountMap[card.value] || 4; // 默认4张
    const history = recognizedBestMap.get(key);
    const usedCount = history ? 1 : 0;
    // 还没用满
    if (usedCount < maxCount) {
      filtered.push(card);
    }
  });
  return filtered;
}
// 递归获取目录下所有 PNG 文件
function getAllPngFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(getAllPngFiles(fullPath));
    } else if (file.isFile() && file.name.endsWith('.png')) {
      results.push(fullPath);
    }
  }
  return results;
}
// 计算缩放信息
function calculateScaleInfo(targetImageInfo, referenceImageInfo) {
  const widthScale = targetImageInfo.width / referenceImageInfo.width;
  const heightScale = targetImageInfo.height / referenceImageInfo.height;
  const avgScale = (widthScale + heightScale) / 2;
  const aspectRatioDiff = Math.abs((targetImageInfo.width / targetImageInfo.height) - (referenceImageInfo.width / referenceImageInfo.height));
  return { widthScale, heightScale, avgScale, aspectRatioDiff, isAspectRatioSimilar: aspectRatioDiff < 0.1 };
}
// 非极大值抑制 (NMS)
function nonMaximumSuppression(matches, overlapThresh = 0.5) {
  if (matches.length === 0) return [];
  const sortedMatches = [...matches].sort((a, b) => b.score - a.score);
  const suppressedMatches = [];
  while (sortedMatches.length > 0) {
    const currentMatch = sortedMatches.shift();
    suppressedMatches.push(currentMatch);
    const currentRect = {
      x1: currentMatch.position.x,
      y1: currentMatch.position.y,
      x2: currentMatch.position.x + currentMatch.size.width,
      y2: currentMatch.position.y + currentMatch.size.height
    };
    const remainingMatches = [];
    for (const match of sortedMatches) {
      const matchRect = {
        x1: match.position.x,
        y1: match.position.y,
        x2: match.position.x + match.size.width,
        y2: match.position.y + match.size.height
      };
      const xOverlap = Math.max(0, Math.min(currentRect.x2, matchRect.x2) - Math.max(currentRect.x1, matchRect.x1));
      const yOverlap = Math.max(0, Math.min(currentRect.y2, matchRect.y2) - Math.max(currentRect.y1, matchRect.y1));
      const intersection = xOverlap * yOverlap;

      const currentArea = (currentRect.x2 - currentRect.x1) * (currentRect.y2 - currentRect.y1);
      const matchArea = (matchRect.x2 - matchRect.x1) * (matchRect.y2 - matchRect.y1);
      const union = currentArea + matchArea - intersection;

      const overlap = intersection / union;

      if (overlap < overlapThresh) {
        remainingMatches.push(match);
      }
    }

    sortedMatches.length = 0;
    sortedMatches.push(...remainingMatches);
  }
  return suppressedMatches;
}// 导出函数
module.exports = {
  filterByHistory,
  getAllPngFiles,
  calculateScaleInfo,
  nonMaximumSuppression
};