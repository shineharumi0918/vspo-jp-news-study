import { VSPO_MEMBERS } from '../../src/data/vspoMembers.js';

const MEMBER_ALIASES = {
  'kaga-sumire': ['花芽すみれ', 'すみれ', 'すーちゃん', 'すみー'],
  'kaga-nazuna': ['花芽なずな', 'なずな', 'なずぴ'],
  'kogara-toto': ['小雀とと', 'ととち'],
  'ichinose-uruha': ['一ノ瀬うるは', '一ノ瀬', 'うるは', 'のせさん', 'うーちゃん'],
  'kurumi-noa': ['胡桃のあ', 'のあちゃん', 'くーちゃん'],
  'tosaki-mimi': ['兎咲ミミ', 'みみたや', 'ミミちゃん'],
  'asumi-sena': ['空澄セナ', 'あすみ', 'せなちゃん', 'セナちゃん'],
  'tachibana-hinano': ['橘ひなの', 'ひなの', 'ひなーの'],
  'hanabusa-lisa': ['英リサ', 'はなぶさ', 'リサちゃん'],
  'kisaragi-ren': ['如月れん', 'きさらぎ', 'れんくん'],
  'kaminari-qpi': ['神成きゅぴ', 'きゅぴ', 'かみなり'],
  'yakumo-beni': ['八雲べに', 'やくも', 'べに様', 'べにちゃん'],
  'aizawa-ema': ['藍沢エマ', 'あいざわ', 'えまたそ', 'エマちゃん'],
  'shinomiya-runa': ['紫宮るな', 'しのみや', '紫宮', 'るなちゃん'],
  'nekota-tsuna': ['猫汰つな', 'ねこた', 'つなちゃん'],
  'shiranami-ramune': ['白波らむね', 'しらなみ', 'らむね', 'らむち'],
  'komori-met': ['小森めと', 'こもり', 'めっさん', 'めとちゃん'],
  'yumeno-akari': ['夢野あかり', 'あかりん', 'ゆめの'],
  'yano-kuromu': ['夜乃くろむ', 'くろむ', 'くろむん'],
  'tsumugi-kokage': ['紡木こかげ', 'つむぎ', 'こかげ'],
  'sendo-yuuhi': ['千燈ゆうひ', 'せんどう', 'ゆうひ'],
  'choya-hanabi': ['蝶屋はなび', 'ちょうや', 'はなび'],
  'amayui-moka': ['甘結もか', 'あまゆい', 'もかちゃん'],
  'ginjou-saine': ['銀城サイネ', 'ぎんじょう', 'サイネ'],
  'tatsumaki-chise': ['龍巻ちせ', 'たつまき', 'ちせ'],
};

/**
 * 依據影片標題、說明與 Holodex mentions 自動識別登場的ぶいすぽっ！成員 ID。
 */
export function matchVspoMembers({ title = '', description = '', mentions = [] } = {}) {
  const matched = new Set();
  const mentionText = mentions
    .map((m) => `${m?.name || ''} ${m?.english_name || ''}`)
    .join(' ');
  const primaryText = `${title} ${mentionText}`;
  const fullText = `${primaryText} ${description}`;

  // 優先在標題與 Holodex mentions 比對所有本名與安全別稱
  for (const member of VSPO_MEMBERS) {
    const aliases = MEMBER_ALIASES[member.id] || [member.name];
    if (aliases.some((alias) => primaryText.includes(alias))) {
      matched.add(member.id);
    }
  }

  // 若標題與 mentions 仍未命中 2 人以上，再於說明欄比對完整成員本名（避免說明欄常見單字誤判）
  for (const member of VSPO_MEMBERS) {
    if (fullText.includes(member.name)) {
      matched.add(member.id);
    }
  }

  return [...matched];
}

/**
 * 解析 ISO 8601 影片長度（如 PT4M18S）為 MM:SS，並回傳總秒數。
 */
export function parseIsoDuration(isoDuration = '') {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return { formatted: '03:00', seconds: 180 };
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  const displayMin = hours * 60 + minutes;
  const formatted = `${String(displayMin).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { formatted, seconds: totalSeconds };
}

export function formatSecondsDuration(totalSeconds = 180) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
