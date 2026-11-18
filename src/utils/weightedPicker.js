/**
 * 計算候選切り抜き影片的加權分數與命中機率。
 * 若一部影片有多位成員同台，取參與成員的權重總和（若任一為 0 不影響其他同台成員；若全部為 0 則該影片權重為 0）。
 */
export function computeClipWeights(candidates, memberWeights) {
  const scored = candidates.map((clip) => {
    const memberBreakdown = clip.memberIds.map((id) => ({
      id,
      weight: Math.max(0, Number(memberWeights[id] ?? 0)),
    }));
    const rawScore = memberBreakdown.reduce((sum, item) => sum + item.weight, 0);
    return {
      clip,
      rawScore,
      memberBreakdown,
    };
  });

  const totalScore = scored.reduce((sum, item) => sum + item.rawScore, 0);

  return scored.map((item) => ({
    ...item,
    probability: totalScore > 0 ? (item.rawScore / totalScore) * 100 : 100 / candidates.length,
  }));
}

/**
 * 依據成員權重加權隨機抽選 1 部影片。
 * @param {Array} candidates 過去 24 小時內的切り抜き候選影片
 * @param {Object} memberWeights 成員 ID -> 權重 (0~10)
 * @param {string|null} excludeId 重抽時可選填，盡量避免連續抽中同一部（僅在有多個非 0 權重候選時生效）
 */
export function pickWeightedClip(candidates, memberWeights, excludeId = null) {
  if (!candidates || candidates.length === 0) {
    return { selected: null, scoredPool: [], isZeroWeightFallback: false };
  }

  const scoredPool = computeClipWeights(candidates, memberWeights);
  const nonZeroPool = scoredPool.filter((item) => item.rawScore > 0);

  if (nonZeroPool.length === 0) {
    const fallbackPool =
      excludeId && candidates.length > 1
        ? scoredPool.filter((item) => item.clip.id !== excludeId)
        : scoredPool;
    const randomIndex = Math.floor(Math.random() * fallbackPool.length);
    return {
      selected: fallbackPool[randomIndex],
      scoredPool,
      isZeroWeightFallback: true,
    };
  }

  const candidatePool =
    excludeId && nonZeroPool.length > 1
      ? nonZeroPool.filter((item) => item.clip.id !== excludeId)
      : nonZeroPool;

  const poolTotal = candidatePool.reduce((sum, item) => sum + item.rawScore, 0);
  let threshold = Math.random() * poolTotal;

  for (const item of candidatePool) {
    threshold -= item.rawScore;
    if (threshold <= 0) {
      return {
        selected: item,
        scoredPool,
        isZeroWeightFallback: false,
      };
    }
  }

  return {
    selected: candidatePool[candidatePool.length - 1],
    scoredPool,
    isZeroWeightFallback: false,
  };
}
