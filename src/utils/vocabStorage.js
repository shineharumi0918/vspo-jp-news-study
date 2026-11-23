export const MASTERED_STORAGE_KEY_V2 = 'jp_study_mastered_vocab_v2';
export const LEGACY_MASTERED_KEY_V1 = 'jp_study_mastered_vocab_v1';

export function getVocabKey(vocab) {
  const word = String(vocab?.word || '').trim();
  const reading = String(vocab?.reading || '').trim();
  return reading ? `${word}:${reading}` : word;
}

export function isVocabMastered(masteredMap, vocab) {
  if (!masteredMap || !vocab) return false;
  const key = getVocabKey(vocab);
  return Boolean(masteredMap[key] || (vocab.word && masteredMap[vocab.word]));
}

export function loadMasteredVocab(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return {};

  try {
    const rawV2 = storage.getItem(MASTERED_STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // 忽略損毀資料
  }

  // 相容舊版 v1（key 格式為 "news-YYYYMMDD-01:word"）
  try {
    const rawV1 = storage.getItem(LEGACY_MASTERED_KEY_V1);
    if (!rawV1) return {};
    const legacy = JSON.parse(rawV1);
    if (!legacy || typeof legacy !== 'object') return {};

    const migrated = {};
    for (const [legacyKey, flag] of Object.entries(legacy)) {
      if (!flag) continue;
      const word = legacyKey.includes(':') ? legacyKey.split(':').slice(1).join(':') : legacyKey;
      const trimmed = word.trim();
      if (!trimmed) continue;
      migrated[trimmed] = {
        word: trimmed,
        reading: '',
        jlpt: '',
        pos: '',
        meaningZh: '',
        exampleJa: '',
        exampleZh: '',
        masteredAt: new Date().toISOString().slice(0, 10),
      };
    }
    return migrated;
  } catch {
    return {};
  }
}

export function toggleMasteredVocabEntry(masteredMap, vocab, currentDate) {
  const key = getVocabKey(vocab);
  const next = { ...masteredMap };

  if (next[key] || (vocab.word && next[vocab.word])) {
    delete next[key];
    if (vocab.word) delete next[vocab.word];
    return next;
  }

  next[key] = {
    word: vocab.word || '',
    reading: vocab.reading || '',
    jlpt: vocab.jlpt || '',
    pos: vocab.pos || '',
    meaningZh: vocab.meaningZh || '',
    exampleJa: vocab.exampleJa || '',
    exampleZh: vocab.exampleZh || '',
    masteredAt: currentDate || new Date().toISOString().slice(0, 10),
  };
  return next;
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildAnkiCsv(entries) {
  const header = ['Front', 'Back', 'JLPT', 'POS', 'ExampleJa', 'ExampleZh', 'MasteredAt'];
  const rows = entries.map((entry) => {
    const front = entry.reading ? `${entry.word}（${entry.reading}）` : entry.word;
    return [
      front,
      entry.meaningZh || '',
      entry.jlpt || '',
      entry.pos || '',
      entry.exampleJa || '',
      entry.exampleZh || '',
      entry.masteredAt || '',
    ].map(escapeCsvCell);
  });

  return `\uFEFF${[header.join(','), ...rows.map((r) => r.join(','))].join('\r\n')}`;
}
