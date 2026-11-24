import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VSPO_MEMBER_MAP } from '../src/data/vspoMembers.js';
import { MOCK_DAILY_DATA } from '../src/data/mockDailyData.js';
import { parseRssFeed, decodeHtmlEntities, formatJstTimestamp } from './lib/rssParser.mjs';
import { matchVspoMembers, parseIsoDuration, formatSecondsDuration } from './lib/vspoMatcher.mjs';
import { analyzeNewsBatch, analyzeVspoClipsBatch } from './lib/geminiClient.mjs';
import {
  buildUpdatedHistory,
  extractHistorySeenIds,
  isExcludedNewsTitle,
  normalizeNewsTitle,
  normalizeNewsUrl,
  pickCategoryNewsItems,
  selectDiverseClipPool,
} from './lib/deduplicator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'daily-content.json');
const HISTORY_PATH = path.join(ROOT_DIR, 'public', 'data', 'history.json');

const NEWS_FEED_CONFIGS = [
  {
    category: '政治',
    categoryKey: 'politics',
    targetCount: 1,
    feeds: [
      { source: 'NHK NEWS WEB', url: 'https://news.web.nhk/n-data/conf/na/rss/cat4.xml' },
      { source: 'NHK NEWS WEB', url: 'https://www.nhk.or.jp/rss/news/cat4.xml' },
      { source: 'Google ニュース (日本政治)', url: 'https://news.google.com/rss/headlines/section/topic/POLITICS?hl=ja&gl=JP&ceid=JP:ja' },
    ],
  },
  {
    category: '經濟',
    categoryKey: 'economy',
    targetCount: 1,
    feeds: [
      { source: 'NHK NEWS WEB', url: 'https://news.web.nhk/n-data/conf/na/rss/cat5.xml' },
      { source: 'NHK NEWS WEB', url: 'https://www.nhk.or.jp/rss/news/cat5.xml' },
      { source: 'Google ニュース (日本経済)', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ja&gl=JP&ceid=JP:ja' },
    ],
  },
  {
    category: '民生・社會',
    categoryKey: 'society',
    targetCount: 2,
    feeds: [
      { source: 'NHK NEWS WEB', url: 'https://news.web.nhk/n-data/conf/na/rss/cat1.xml' },
      { source: 'NHK NEWS WEB', url: 'https://www.nhk.or.jp/rss/news/cat1.xml' },
      { source: 'Google ニュース (日本社会)', url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=ja&gl=JP&ceid=JP:ja' },
    ],
  },
];

async function loadLocalEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    const content = raw.replace(/^\uFEFF/, '');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim().replace(/^export\s+/, '');
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env 不存在時略過
  }
}

function getJstDateString() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function fetchTextWithTimeout(url, headers = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'vspo-jp-news-study-bot/1.0',
        ...headers,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} (${url})`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArticleExcerpt(url) {
  if (!url.includes('nhk.or.jp') && !url.includes('news.web.nhk')) {
    return '';
  }
  try {
    const html = await fetchTextWithTimeout(url, {}, 8000);
    const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => decodeHtmlEntities(m[1]))
      .filter((p) => p.length >= 25 && !p.includes('NHK'));
    return paragraphs.slice(0, 6).join(' ').slice(0, 1200);
  } catch {
    return '';
  }
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadPreviousSeenState() {
  const [historyData, dailyData] = await Promise.all([
    readJsonSafe(HISTORY_PATH),
    readJsonSafe(OUTPUT_PATH),
  ]);
  const seen = extractHistorySeenIds(historyData, dailyData);
  return { historyData, seen };
}

async function fetchDailyNewsItems(previousNewsLinks = new Set(), previousNewsTitles = new Set()) {
  const collected = [];
  const seenTitles = new Set();
  const seenLinks = new Set();

  for (const cfg of NEWS_FEED_CONFIGS) {
    const categoryCandidates = [];

    for (const feed of cfg.feeds) {
      try {
        const xml = await fetchTextWithTimeout(feed.url);
        const items = parseRssFeed(xml)
          .filter((item) => !isExcludedNewsTitle(item.title))
          .map((item) => ({ ...item, source: feed.source }));
        categoryCandidates.push(...items);

        // 若目前抓到的未重複新文章已達標，就不必再打備援 RSS
        const unseenSoFar = categoryCandidates.filter((item) => {
          const normLink = normalizeNewsUrl(item.link);
          const normTitle = normalizeNewsTitle(item.title);
          return (
            !previousNewsLinks.has(normLink) &&
            !previousNewsTitles.has(normTitle) &&
            !seenLinks.has(normLink) &&
            !seenTitles.has(normTitle)
          );
        });
        if (unseenSoFar.length >= cfg.targetCount) {
          break;
        }
      } catch (err) {
        console.warn(`[News RSS] 讀取失敗 ${feed.url}: ${err.message}`);
      }
    }

    const { chosen, skippedCount } = pickCategoryNewsItems(categoryCandidates, {
      previousNewsLinks,
      previousNewsTitles,
      seenTitles,
      seenLinks,
      targetCount: cfg.targetCount,
    });

    if (skippedCount > 0) {
      console.log(`  - [${cfg.category}] 已過濾 ${skippedCount} 則前次出現過的新聞`);
    }

    const enrichedItems = await Promise.all(
      chosen.map(async (item) => ({
        category: cfg.category,
        categoryKey: cfg.categoryKey,
        source: item.source,
        publishedAt: formatJstTimestamp(item.pubDate),
        titleJa: item.title,
        description: item.description,
        bodyExcerpt: await fetchArticleExcerpt(item.link),
        sourceUrl: item.link,
      }))
    );
    collected.push(...enrichedItems);
  }

  return collected;
}

async function fetchHolodexVspoClips(apiKey, cutoffMs) {
  if (!apiKey) return [];
  const url = 'https://holodex.net/api/v2/videos?org=VSpo&type=clip&lang=ja&include=mentions&max_upcoming_hours=0&limit=50';
  const raw = await fetchTextWithTimeout(url, { 'X-APIKEY': apiKey });
  const videos = JSON.parse(raw);
  if (!Array.isArray(videos)) return [];

  const results = [];
  for (const v of videos) {
    const publishedTime = new Date(v.available_at || v.published_at || 0).getTime();
    if (!publishedTime || publishedTime < cutoffMs) continue;
    if ((v.duration || 0) < 60 || (v.duration || 0) > 1800) continue;

    const memberIds = matchVspoMembers({
      title: v.title || '',
      mentions: v.mentions || [],
    });

    results.push({
      youtubeId: v.id,
      titleJa: v.title,
      description: '',
      channelName: v.channel?.name || 'VSPO! 切り抜き',
      publishedAtMs: publishedTime,
      publishedHoursAgo: Math.max(1, Math.round((Date.now() - publishedTime) / 3600000)),
      duration: formatSecondsDuration(v.duration),
      memberIds,
    });
  }
  return results;
}

async function fetchYouTubeVspoClips(apiKey, cutoffIso, cutoffMs) {
  if (!apiKey) return [];
  const queries = ['ぶいすぽ 切り抜き', 'ぶいすぽっ 切り抜き'];
  const videoIdSet = new Set();

  for (const q of queries) {
    const searchParams = new URLSearchParams({
      part: 'snippet',
      q,
      type: 'video',
      videoEmbeddable: 'true',
      order: 'date',
      relevanceLanguage: 'ja',
      regionCode: 'JP',
      maxResults: '30',
      publishedAfter: cutoffIso,
      key: apiKey,
    });

    const searchRaw = await fetchTextWithTimeout(
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
    );
    const searchJson = JSON.parse(searchRaw);
    for (const item of searchJson.items || []) {
      if (item.id?.videoId) {
        videoIdSet.add(item.id.videoId);
      }
    }
  }

  const videoIds = [...videoIdSet].slice(0, 50);
  if (videoIds.length === 0) return [];

  const detailsParams = new URLSearchParams({
    part: 'snippet,contentDetails,status',
    id: videoIds.join(','),
    key: apiKey,
  });

  const detailsRaw = await fetchTextWithTimeout(
    `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`
  );
  const detailsJson = JSON.parse(detailsRaw);

  const results = [];
  for (const v of detailsJson.items || []) {
    if (v.status?.embeddable === false) continue;
    const snippet = v.snippet || {};
    if (snippet.liveBroadcastContent && snippet.liveBroadcastContent !== 'none') continue;
    const titleJa = snippet.title || '';
    const description = snippet.description || '';
    const publishedTime = new Date(snippet.publishedAt || 0).getTime();
    if (!publishedTime || publishedTime < cutoffMs) continue;

    // 必須是日文標題（含平假名或片假名）以符合日文切り抜き學習需求
    if (!/[\u3040-\u30ff]/.test(titleJa)) continue;

    const { formatted, seconds } = parseIsoDuration(v.contentDetails?.duration || '');
    if (seconds < 60 || seconds > 1800) continue; // 排除 Shorts (<60s) 與完整直播檔 (>30m)

    const memberIds = matchVspoMembers({ title: titleJa, description });
    // 確保影片與ぶいすぽっ！相關
    const isVspoRelated =
      memberIds.length > 0 ||
      /ぶいすぽ|vspo/i.test(`${titleJa} ${description}`);
    if (!isVspoRelated) continue;

    results.push({
      youtubeId: v.id,
      titleJa,
      description,
      channelName: snippet.channelTitle || 'YouTube 切り抜き',
      publishedAtMs: publishedTime,
      publishedHoursAgo: Math.max(1, Math.round((Date.now() - publishedTime) / 3600000)),
      duration: formatted,
      memberIds,
    });
  }
  return results;
}

async function seedMockData() {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(MOCK_DAILY_DATA, null, 2), 'utf8');
  console.log(`已寫入初始 Mock 資料至 ${OUTPUT_PATH}`);
}

async function main() {
  await loadLocalEnv();

  if (process.argv.includes('--seed-mock')) {
    await seedMockData();
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  const holodexKey = process.env.HOLODEX_API_KEY;

  if (!geminiKey) {
    throw new Error('請設定 GEMINI_API_KEY（或先使用 --seed-mock 產出靜態測試資料）。');
  }
  if (!youtubeKey && !holodexKey) {
    throw new Error('請至少設定 YOUTUBE_API_KEY 或 HOLODEX_API_KEY 以抓取過去 24 小時 ぶいすぽっ！切り抜き。');
  }

  const todayJst = getJstDateString();
  const compactDate = todayJst.replace(/-/g, '');
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const { historyData, seen: previousSeen } = await loadPreviousSeenState();
  console.log(
    `[去重檢查] 載入近 7 日紀錄：新聞連結 ${previousSeen.newsLinks.size} 筆、YouTube 影片 ${previousSeen.videoIds.size} 部`
  );

  console.log(`[1/4] 抓取 ${todayJst} 日本時事新聞 RSS...`);
  const rawNews = await fetchDailyNewsItems(previousSeen.newsLinks, previousSeen.newsTitles);
  if (rawNews.length === 0) {
    throw new Error('無法從 RSS 取得任何日本新聞');
  }

  console.log(`[2/4] 使用 Gemini 批次分析 ${rawNews.length} 篇新聞（生成摘要與 N3–N1 生詞）...`);
  const { data: newsBatch, model: newsModel } = await analyzeNewsBatch(geminiKey, rawNews);
  const newsByIndex = new Map((newsBatch.items || []).map((x) => [x.index, x]));
  const analyzedNews = rawNews.map((item, i) => {
    const analyzed = newsByIndex.get(i) || newsBatch.items?.[i];
    if (!analyzed) {
      throw new Error(`Gemini 新聞回傳缺少第 ${i + 1} 篇解析`);
    }
    return {
      id: `news-${compactDate}-${String(i + 1).padStart(2, '0')}`,
      category: item.category,
      categoryKey: item.categoryKey,
      source: item.source,
      publishedAt: item.publishedAt,
      titleJa: item.titleJa,
      titleReading: analyzed.titleReading,
      titleZh: analyzed.titleZh,
      summaryZh: analyzed.summaryZh,
      sourceUrl: item.sourceUrl,
      vocabulary: analyzed.vocabulary,
    };
  });
  console.log(`  - ${analyzedNews.length} 篇新聞解析完成 [${newsModel}]`);

  console.log('[3/4] 搜尋過去 24 小時 ぶいすぽっ！日文切り抜き...');
  const [holodexClips, youtubeClips] = await Promise.all([
    fetchHolodexVspoClips(holodexKey, cutoffMs).catch((err) => {
      console.warn(`[Holodex] 抓取警告: ${err.message}`);
      return [];
    }),
    fetchYouTubeVspoClips(youtubeKey, cutoffIso, cutoffMs).catch((err) => {
      console.warn(`[YouTube] 抓取警告: ${err.message}`);
      return [];
    }),
  ]);

  const {
    pool: clipPool,
    filteredOutCount,
    usedFallback,
  } = selectDiverseClipPool([...holodexClips, ...youtubeClips], 8, previousSeen.videoIds);
  if (filteredOutCount > 0) {
    console.log(`  - [VSPO 剪輯] 已過濾 ${filteredOutCount} 部前次出現過的影片`);
  }
  if (usedFallback) {
    console.warn('  - [VSPO 剪輯] 過去 24 小時內暫無未出現過的新剪輯，保留既有候選作為備援');
  }
  if (clipPool.length === 0) {
    throw new Error('過去 24 小時內找不到符合條件且已標記成員的 ぶいすぽっ！切り抜き影片');
  }

  console.log(`[4/4] 使用 Gemini 批次生成 ${clipPool.length} 部切り抜き候選池的口語單字與文法解析...`);
  const analyzedClips = [];
  const chunkSize = 4;
  for (let start = 0; start < clipPool.length; start += chunkSize) {
    const slice = clipPool.slice(start, start + chunkSize).map((clip) => ({
      ...clip,
      memberNames: clip.memberIds.map((id) => VSPO_MEMBER_MAP[id]?.name || id),
    }));
    const { data: clipBatch, model: clipModel } = await analyzeVspoClipsBatch(geminiKey, slice);
    const clipByIndex = new Map((clipBatch.items || []).map((x) => [x.index, x]));

    slice.forEach((clip, localIdx) => {
      const analyzed = clipByIndex.get(localIdx) || clipBatch.items?.[localIdx];
      if (!analyzed) {
        throw new Error(`Gemini 剪輯回傳缺少第 ${start + localIdx + 1} 部解析`);
      }
      analyzedClips.push({
        id: `clip-${compactDate}-${String(start + localIdx + 1).padStart(2, '0')}`,
        youtubeId: clip.youtubeId,
        titleJa: clip.titleJa,
        titleZh: analyzed.titleZh,
        channelName: clip.channelName,
        publishedHoursAgo: clip.publishedHoursAgo,
        duration: clip.duration,
        memberIds: clip.memberIds,
        gameOrTopic: analyzed.gameOrTopic,
        contextSummaryZh: analyzed.contextSummaryZh,
        slangVocab: analyzed.slangVocab,
        grammarPoints: analyzed.grammarPoints,
      });
    });

    console.log(
      `  - 剪輯 ${start + 1}–${start + slice.length}/${clipPool.length} 解析完成 [${clipModel}]`
    );
    if (start + chunkSize < clipPool.length) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  const output = {
    meta: {
      date: todayJst,
      generatedAt: new Date().toISOString(),
      mode: 'live',
      note: '由 GitHub Actions 自動抓取 NHK/Google News RSS 與 24h VSPO! 切り抜き，並經 Gemini API 解析生成。',
    },
    news: analyzedNews,
    clipCandidates: analyzedClips,
  };

  const updatedHistory = buildUpdatedHistory(historyData, {
    date: todayJst,
    newsLinks: analyzedNews.map((n) => n.sourceUrl),
    newsTitles: analyzedNews.map((n) => n.titleJa),
    videoIds: analyzedClips.map((c) => c.youtubeId),
  });

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  await fs.writeFile(HISTORY_PATH, JSON.stringify(updatedHistory, null, 2), 'utf8');
  console.log(
    `完成！已更新 ${OUTPUT_PATH} 與 ${HISTORY_PATH}（新聞 ${analyzedNews.length} 篇、切り抜き候選 ${analyzedClips.length} 部）`
  );
}

main().catch((err) => {
  console.error('[update-daily 失敗]', err);
  process.exit(1);
});
