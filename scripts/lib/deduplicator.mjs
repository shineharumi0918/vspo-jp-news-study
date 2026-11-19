/**
 * 從既有 daily-content.json 擷取前次已出現過的新聞連結與 YouTube 影片 ID。
 */
export function extractPreviousSeenIds(existingData) {
  const newsLinks = new Set();
  const videoIds = new Set();

  if (!existingData || typeof existingData !== 'object') {
    return { newsLinks, videoIds };
  }

  for (const article of existingData.news || []) {
    const link = (article?.sourceUrl || article?.link || '').trim();
    if (link) {
      newsLinks.add(link);
    }
  }

  for (const clip of existingData.clipCandidates || []) {
    const videoId = (clip?.youtubeId || clip?.videoId || '').trim();
    if (videoId) {
      videoIds.add(videoId);
    }
  }

  return { newsLinks, videoIds };
}

/**
 * 單一分類新聞去重挑選：優先挑未出現於 previousNewsLinks 的最新新聞，
 * 僅在該分類所有來源的全新新聞不足 targetCount 時，才以最新文章補齊缺口。
 */
export function pickCategoryNewsItems(
  candidates,
  { previousNewsLinks = new Set(), seenTitles = new Set(), seenLinks = new Set(), targetCount = 1 } = {}
) {
  const chosen = [];
  const fallbackPool = [];

  for (const item of candidates) {
    if (chosen.length >= targetCount) break;
    const link = (item.link || '').trim();
    const title = (item.title || '').trim();
    if (!link || !title) continue;
    if (seenTitles.has(title) || seenLinks.has(link)) continue;

    if (previousNewsLinks.has(link)) {
      fallbackPool.push(item);
      continue;
    }

    seenTitles.add(title);
    seenLinks.add(link);
    chosen.push(item);
  }

  for (const item of fallbackPool) {
    if (chosen.length >= targetCount) break;
    const link = (item.link || '').trim();
    const title = (item.title || '').trim();
    if (seenTitles.has(title) || seenLinks.has(link)) continue;
    seenTitles.add(title);
    seenLinks.add(link);
    chosen.push(item);
  }

  return { chosen, skippedCount: fallbackPool.length };
}

function pickDiverseFromPool(sortedClips, maxPool) {
  const chosen = [];
  const coveredMembers = new Set();

  for (const clip of sortedClips) {
    if (chosen.length >= maxPool) break;
    if (clip.memberIds.some((id) => !coveredMembers.has(id))) {
      chosen.push(clip);
      clip.memberIds.forEach((id) => coveredMembers.add(id));
    }
  }

  for (const clip of sortedClips) {
    if (chosen.length >= maxPool) break;
    if (!chosen.some((c) => c.youtubeId === clip.youtubeId)) {
      chosen.push(clip);
    }
  }

  return chosen;
}

/**
 * 挑選最多 maxPool 部涵蓋不同成員的 24 小時切り抜き候選池，
 * 優先過濾掉前次已出現的 videoId；僅在無任何新片時退回保留候選。
 */
export function selectDiverseClipPool(clips, maxPool = 8, previousVideoIds = new Set()) {
  const byId = new Map();
  for (const clip of clips) {
    const prev = byId.get(clip.youtubeId);
    if (!prev) {
      byId.set(clip.youtubeId, clip);
    } else if (clip.memberIds.length > prev.memberIds.length) {
      byId.set(clip.youtubeId, { ...prev, memberIds: clip.memberIds });
    }
  }

  const unique = [...byId.values()].filter((c) => c.memberIds.length > 0);
  unique.sort((a, b) => b.publishedAtMs - a.publishedAtMs);

  const unseen = unique.filter((c) => !previousVideoIds.has(c.youtubeId));
  if (unseen.length > 0) {
    return {
      pool: pickDiverseFromPool(unseen, maxPool),
      filteredOutCount: unique.length - unseen.length,
      usedFallback: false,
    };
  }

  return {
    pool: pickDiverseFromPool(unique, maxPool),
    filteredOutCount: 0,
    usedFallback: unique.length > 0 && previousVideoIds.size > 0,
  };
}
