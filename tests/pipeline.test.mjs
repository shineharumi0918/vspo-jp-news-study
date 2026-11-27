import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRssFeed, decodeHtmlEntities } from '../scripts/lib/rssParser.mjs';
import { matchVspoMembers, parseIsoDuration, formatSecondsDuration } from '../scripts/lib/vspoMatcher.mjs';
import {
  buildUpdatedHistory,
  extractHistorySeenIds,
  extractPreviousSeenIds,
  isExcludedNewsTitle,
  normalizeNewsUrl,
  pickCategoryNewsItems,
  selectDiverseClipPool,
} from '../scripts/lib/deduplicator.mjs';

test('parseRssFeed extracts RSS 2.0 items and decodes CDATA/entities', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title><![CDATA[補正予算案 &amp; 審議が本格化]]></title>
        <link>https://news.web.nhk/news/item1</link>
        <description><![CDATA[<p>国会での協議が続いています。</p>]]></description>
        <pubDate>Wed, 18 Nov 2026 07:30:00 +0900</pubDate>
      </item>
    </channel>
  </rss>`;

  const items = parseRssFeed(sampleXml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, '補正予算案 & 審議が本格化');
  assert.equal(items[0].link, 'https://news.web.nhk/news/item1');
  assert.equal(items[0].description, '国会での協議が続いています。');
});

test('decodeHtmlEntities decodes numeric character references cleanly', () => {
  assert.equal(decodeHtmlEntities('&#26085;&#26412; &quot;NHK&quot;'), '日本 "NHK"');
});

test('matchVspoMembers identifies full names, safe nicknames, and ignores boilerplate full-roster descriptions', () => {
  const matched = matchVspoMembers({
    title: '【切り抜き】花芽すみれとひなーのの爆笑VALORANT',
    description:
      '▼ぶいすぽっ！メンバー一覧\n花芽すみれ 花芽なずな 小雀とと 一ノ瀬うるは 胡桃のあ 兎咲ミミ 空澄セナ 橘ひなの 英リサ 如月れん',
  });
  assert.deepEqual(matched.sort(), ['kaga-sumire', 'tachibana-hinano'].sort());

  // 標題未寫出成員時，才退回比對簡潔說明欄
  const descOnly = matchVspoMembers({
    title: '【ぶいすぽ切り抜き】深夜の神プレイ集',
    description: '元配信：一ノ瀬うるは さんのVALORANT配信より',
  });
  assert.deepEqual(descOnly, ['ichinose-uruha']);

  // 標題未寫成員但說明欄貼滿全體成員名單時，避免誤標為全員同台
  const boilerplateOnly = matchVspoMembers({
    title: '【ぶいすぽ切り抜き】大会ハイライト',
    description:
      '花芽すみれ 花芽なずな 小雀とと 一ノ瀬うるは 胡桃のあ 兎咲ミミ 空澄セナ 橘ひなの',
  });
  assert.deepEqual(boilerplateOnly, []);

  // 確保日文常見字詞「つなぐ」「れんしゅう」不會誤判為 猫汰つな 或 如月れん
  const noFalseMatch = matchVspoMembers({
    title: 'みんなで思いをつなぐ練習配信',
    description: '今日は楽しくゲームします',
  });
  assert.deepEqual(noFalseMatch, []);
});

test('parseIsoDuration and formatSecondsDuration normalize clip lengths', () => {
  assert.deepEqual(parseIsoDuration('PT4M18S'), { formatted: '04:18', seconds: 258 });
  assert.deepEqual(parseIsoDuration('PT1H2M5S'), { formatted: '62:05', seconds: 3725 });
  assert.equal(formatSecondsDuration(125), '02:05');
});

test('extractPreviousSeenIds collects previous news links and YouTube video IDs', () => {
  const seen = extractPreviousSeenIds({
    news: [{ sourceUrl: 'https://news.web.nhk/a' }, { link: 'https://news.web.nhk/b' }],
    clipCandidates: [{ youtubeId: 'vidA' }, { videoId: 'vidB' }],
  });
  assert.deepEqual([...seen.newsLinks].sort(), ['https://news.web.nhk/a', 'https://news.web.nhk/b']);
  assert.deepEqual([...seen.videoIds].sort(), ['vidA', 'vidB']);
});

test('pickCategoryNewsItems prioritizes unseen news links and falls back only when needed', () => {
  const prev = new Set(['https://news.web.nhk/old1', 'https://news.web.nhk/old2']);
  const candidates = [
    { title: '【動画】Pickup NEWS（11月20日）', link: 'https://news.web.nhk/pickup' },
    { title: '高市首相動静 2026年11月25日', link: 'https://news.web.nhk/shusho-dosei' },
    { title: 'Old 1', link: 'https://news.web.nhk/old1' },
    { title: 'New 1', link: 'https://news.web.nhk/new1' },
    { title: 'Old 2', link: 'https://news.web.nhk/old2' },
  ];

  assert.equal(isExcludedNewsTitle('【動画】Pickup NEWS（11月20日）'), true);
  assert.equal(isExcludedNewsTitle('高市首相動静 2026年11月25日'), true);
  assert.equal(isExcludedNewsTitle('首相動静（11月26日）'), true);
  assert.equal(isExcludedNewsTitle('首相動静―11月26日 - 朝日新聞'), true);
  assert.equal(isExcludedNewsTitle('高市総理の動静'), true);
  assert.equal(isExcludedNewsTitle('カイロスロケット4号機 来年1月打ち上げへ'), false);
  assert.equal(isExcludedNewsTitle('高市首相 補正予算案の早期成立を目指す'), false);

  const first = pickCategoryNewsItems(candidates, { previousNewsLinks: prev, targetCount: 1 });
  assert.equal(first.chosen.length, 1);
  assert.equal(first.chosen[0].link, 'https://news.web.nhk/new1');

  const needTwo = pickCategoryNewsItems(candidates, { previousNewsLinks: prev, targetCount: 2 });
  assert.deepEqual(
    needTwo.chosen.map((i) => i.link),
    ['https://news.web.nhk/new1', 'https://news.web.nhk/old1']
  );
});

test('selectDiverseClipPool filters previously seen videoIds and falls back if none are unseen', () => {
  const clips = [
    { youtubeId: 'seen1', memberIds: ['kaga-sumire'], publishedAtMs: 300 },
    { youtubeId: 'new1', memberIds: ['tachibana-hinano'], publishedAtMs: 200 },
    { youtubeId: 'new2', memberIds: ['kurumi-noa'], publishedAtMs: 100 },
  ];

  const res = selectDiverseClipPool(clips, 8, new Set(['seen1']));
  assert.equal(res.usedFallback, false);
  assert.equal(res.filteredOutCount, 1);
  assert.deepEqual(
    res.pool.map((c) => c.youtubeId),
    ['new1', 'new2']
  );

  const fallbackRes = selectDiverseClipPool(
    clips.slice(0, 1),
    8,
    new Set(['seen1'])
  );
  assert.equal(fallbackRes.usedFallback, true);
  assert.deepEqual(
    fallbackRes.pool.map((c) => c.youtubeId),
    ['seen1']
  );
});

test('extractHistorySeenIds and buildUpdatedHistory maintain a 7-day rolling deduplication window', () => {
  const nowMs = Date.UTC(2026, 10, 23); // 2026-11-23
  const history = {
    entries: [
      { date: '2026-11-22', newsLinks: ['https://nhk/recent'], videoIds: ['vidRecent'] },
      { date: '2026-11-10', newsLinks: ['https://nhk/expired'], videoIds: ['vidExpired'] },
    ],
  };

  const seen = extractHistorySeenIds(
    history,
    { news: [{ sourceUrl: 'https://nhk/today' }], clipCandidates: [{ youtubeId: 'vidToday' }] },
    { nowMs, retentionDays: 7 }
  );
  assert.equal(seen.newsLinks.has('https://nhk/recent'), true);
  assert.equal(seen.newsLinks.has('https://nhk/today'), true);
  assert.equal(seen.newsLinks.has('https://nhk/expired'), false);
  assert.equal(seen.videoIds.has('vidRecent'), true);
  assert.equal(seen.videoIds.has('vidExpired'), false);

  const updated = buildUpdatedHistory(
    history,
    { date: '2026-11-23', newsLinks: ['https://nhk/new'], videoIds: ['vidNew'] },
    { nowMs, retentionDays: 7 }
  );
  assert.deepEqual(
    updated.entries.map((e) => e.date),
    ['2026-11-23', '2026-11-22']
  );
});

test('selectDiverseClipPool merges non-empty YouTube description with Holodex member tags', () => {
  const clips = [
    {
      youtubeId: 'clipSame',
      memberIds: ['kaga-sumire', 'tachibana-hinano'],
      description: '',
      publishedAtMs: 500,
    },
    {
      youtubeId: 'clipSame',
      memberIds: ['kaga-sumire'],
      description: 'VALORANTの連携プレイ切り抜きです！',
      publishedAtMs: 500,
    },
  ];

  const res = selectDiverseClipPool(clips, 8, new Set());
  assert.equal(res.pool.length, 1);
  assert.deepEqual(res.pool[0].memberIds, ['kaga-sumire', 'tachibana-hinano']);
  assert.equal(res.pool[0].description, 'VALORANTの連携プレイ切り抜きです！');
});

test('normalizeNewsUrl strips tracking params and pickCategoryNewsItems deduplicates by normalized link and title', () => {
  assert.equal(
    normalizeNewsUrl('https://news.web.nhk/item/123?utm_source=rss&id=5#top'),
    'https://news.web.nhk/item/123?id=5'
  );

  const res = pickCategoryNewsItems(
    [
      { title: '既出ニュース', link: 'https://news.web.nhk/item/123?utm_source=rss&id=5' },
      { title: '同標題別網域', link: 'https://news.google.com/articles/abc' },
      { title: '全新ニュース', link: 'https://news.web.nhk/item/999' },
    ],
    {
      previousNewsLinks: new Set(['https://news.web.nhk/item/123?id=5']),
      previousNewsTitles: new Set(['同標題別網域']),
      targetCount: 1,
    }
  );
  assert.equal(res.chosen.length, 1);
  assert.equal(res.chosen[0].title, '全新ニュース');
  assert.equal(res.skippedCount, 2);
});
