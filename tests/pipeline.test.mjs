import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRssFeed, decodeHtmlEntities } from '../scripts/lib/rssParser.mjs';
import { matchVspoMembers, parseIsoDuration, formatSecondsDuration } from '../scripts/lib/vspoMatcher.mjs';
import {
  extractPreviousSeenIds,
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

test('matchVspoMembers identifies full names, safe nicknames, and avoids substring false positives', () => {
  const matched = matchVspoMembers({
    title: '【切り抜き】花芽すみれとひなーのの爆笑VALORANT',
    description: '一ノ瀬うるはさんも参戦',
  });
  assert.deepEqual(
    matched.sort(),
    ['ichinose-uruha', 'kaga-sumire', 'tachibana-hinano'].sort()
  );

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
    { title: 'Old 1', link: 'https://news.web.nhk/old1' },
    { title: 'New 1', link: 'https://news.web.nhk/new1' },
    { title: 'Old 2', link: 'https://news.web.nhk/old2' },
  ];

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
