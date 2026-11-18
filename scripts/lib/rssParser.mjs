const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITY_MAP[m] ?? m)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tagName) {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? decodeHtmlEntities(match[1]) : '';
}

function extractAtomLink(block) {
  const linkMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return linkMatch ? decodeHtmlEntities(linkMatch[1]) : '';
}

/**
 * 解析 RSS 2.0 (<item>) 或 Atom (<entry>) XML 字串。
 */
export function parseRssFeed(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') {
    return [];
  }

  const itemMatches = [...xmlText.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  if (itemMatches.length > 0) {
    return itemMatches.map((m) => {
      const block = m[1];
      return {
        title: extractTag(block, 'title'),
        link: extractTag(block, 'link'),
        description: extractTag(block, 'description'),
        pubDate: extractTag(block, 'pubDate') || extractTag(block, 'dc:date'),
      };
    }).filter((item) => item.title && item.link);
  }

  const entryMatches = [...xmlText.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  return entryMatches.map((m) => {
    const block = m[1];
    return {
      title: extractTag(block, 'title'),
      link: extractAtomLink(block) || extractTag(block, 'link'),
      description: extractTag(block, 'summary') || extractTag(block, 'content'),
      pubDate: extractTag(block, 'updated') || extractTag(block, 'published'),
    };
  }).filter((item) => item.title && item.link);
}

/**
 * 格式化新聞發布時間為 JST 顯示字串。
 */
export function formatJstTimestamp(pubDateStr) {
  const date = pubDateStr ? new Date(pubDateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '今日更新';
  }
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatter.format(date)} JST`;
}
