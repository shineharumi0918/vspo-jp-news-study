export const DEFAULT_HISTORY_RETENTION_DAYS = 7;

const TRACKING_PARAM_PATTERN = /^(?:utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;

export function normalizeNewsUrl(rawUrl = '') {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM_PATTERN.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function normalizeNewsTitle(rawTitle = '') {
  return String(rawTitle || '').replace(/\s+/g, ' ').trim();
}

function parseDateToUtcMs(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return NaN;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * 從既有 daily-content.json 擷取前次已出現過的新聞連結、標題與 YouTube 影片 ID。
 */
export function extractPreviousSeenIds(existingData) {
  const newsLinks = new Set();
  const newsTitles = new Set();
  const videoIds = new Set();

  if (!existingData || typeof existingData !== 'object') {
    return { newsLinks, newsTitles, videoIds };
  }

  for (const article of existingData.news || []) {
    const link = normalizeNewsUrl(article?.sourceUrl || article?.link || '');
    if (link) {
      newsLinks.add(link);
    }
    const title = normalizeNewsTitle(article?.titleJa || article?.title || '');
    if (title) {
      newsTitles.add(title);
    }
  }

  for (const clip of existingData.clipCandidates || []) {
    const videoId = (clip?.youtubeId || clip?.videoId || '').trim();
    if (videoId) {
      videoIds.add(videoId);
    }
  }

  return { newsLinks, newsTitles, videoIds };
}

/**
 * 合併近 N 天（預設 7 天）history.json 與現有 daily-content.json 的去重集合。
 */
export function extractHistorySeenIds(
  historyData,
  existingDailyData,
  { nowMs = Date.now(), retentionDays = DEFAULT_HISTORY_RETENTION_DAYS } = {}
) {
  const { newsLinks, newsTitles, videoIds } = extractPreviousSeenIds(existingDailyData);
  const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1000;

  for (const entry of historyData?.entries || []) {
    const entryMs = parseDateToUtcMs(entry?.date);
    if (!Number.isNaN(entryMs) && entryMs < cutoffMs) continue;

    for (const link of entry?.newsLinks || []) {
      const normalized = normalizeNewsUrl(link);
      if (normalized) newsLinks.add(normalized);
    }
    for (const title of entry?.newsTitles || []) {
      const normalized = normalizeNewsTitle(title);
      if (normalized) newsTitles.add(normalized);
    }
    for (const vid of entry?.videoIds || []) {
      const normalized = String(vid || '').trim();
      if (normalized) videoIds.add(normalized);
    }
  }

  return { newsLinks, newsTitles, videoIds };
}

/**
 * 寫入當日紀錄並修剪超過 retentionDays 天的歷史項目。
 */
export function buildUpdatedHistory(
  historyData,
  { date, newsLinks = [], newsTitles = [], videoIds = [] },
  { nowMs = Date.now(), retentionDays = DEFAULT_HISTORY_RETENTION_DAYS } = {}
) {
  const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  const byDate = new Map();

  for (const entry of historyData?.entries || []) {
    const entryDate = String(entry?.date || '').trim();
    const entryMs = parseDateToUtcMs(entryDate);
    if (!entryDate || Number.isNaN(entryMs) || entryMs < cutoffMs) continue;
    byDate.set(entryDate, {
      date: entryDate,
      newsLinks: new Set((entry.newsLinks || []).map((x) => normalizeNewsUrl(x)).filter(Boolean)),
      newsTitles: new Set((entry.newsTitles || []).map((x) => normalizeNewsTitle(x)).filter(Boolean)),
      videoIds: new Set((entry.videoIds || []).map((x) => String(x).trim()).filter(Boolean)),
    });
  }

  const current = byDate.get(date) || {
    date,
    newsLinks: new Set(),
    newsTitles: new Set(),
    videoIds: new Set(),
  };
  for (const link of newsLinks) {
    const normalized = normalizeNewsUrl(link);
    if (normalized) current.newsLinks.add(normalized);
  }
  for (const title of newsTitles) {
    const normalized = normalizeNewsTitle(title);
    if (normalized) current.newsTitles.add(normalized);
  }
  for (const vid of videoIds) {
    const normalized = String(vid || '').trim();
    if (normalized) current.videoIds.add(normalized);
  }
  byDate.set(date, current);

  const entries = [...byDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      date: e.date,
      newsLinks: [...e.newsLinks],
      newsTitles: [...e.newsTitles],
      videoIds: [...e.videoIds],
    }));

  return {
    updatedAt: new Date(nowMs).toISOString(),
    retentionDays,
    entries,
  };
}

const EXCLUDED_NEWS_TITLE_PATTERNS = [/【動画】\s*Pickup\s*NEWS/i, /\bPickup\s*NEWS\b/i];

export function isExcludedNewsTitle(title = '') {
  const normalized = String(title).trim();
  return EXCLUDED_NEWS_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * 單一分類新聞去重挑選：優先挑未出現於 previousNewsLinks 的最新新聞，
 * 僅在該分類所有來源的全新新聞不足 targetCount 時，才以最新文章補齊缺口。
 */
export function pickCategoryNewsItems(
  candidates,
  {
    previousNewsLinks = new Set(),
    previousNewsTitles = new Set(),
    seenTitles = new Set(),
    seenLinks = new Set(),
    targetCount = 1,
  } = {}
) {
  const normalizedPrevLinks = new Set(
    [...previousNewsLinks].map((link) => normalizeNewsUrl(link)).filter(Boolean)
  );
  const normalizedPrevTitles = new Set(
    [...previousNewsTitles].map((title) => normalizeNewsTitle(title)).filter(Boolean)
  );
  const chosen = [];
  const fallbackPool = [];

  for (const item of candidates) {
    if (chosen.length >= targetCount) break;
    const link = normalizeNewsUrl(item.link || '');
    const title = normalizeNewsTitle(item.title || '');
    if (!link || !title || isExcludedNewsTitle(title)) continue;
    if (seenTitles.has(title) || seenLinks.has(link)) continue;

    if (normalizedPrevLinks.has(link) || normalizedPrevTitles.has(title)) {
      fallbackPool.push(item);
      continue;
    }

    seenTitles.add(title);
    seenLinks.add(link);
    chosen.push(item);
  }

  for (const item of fallbackPool) {
    if (chosen.length >= targetCount) break;
    const link = normalizeNewsUrl(item.link || '');
    const title = normalizeNewsTitle(item.title || '');
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
    } else {
      const mergedDescription =
        String(clip.description || '').trim().length > String(prev.description || '').trim().length
          ? clip.description
          : prev.description;
      const mergedMemberIds =
        clip.memberIds.length > prev.memberIds.length ? clip.memberIds : prev.memberIds;
      byId.set(clip.youtubeId, {
        ...prev,
        description: mergedDescription,
        memberIds: mergedMemberIds,
      });
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
