import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_MASTERED_KEY_V1,
  MASTERED_STORAGE_KEY_V2,
  buildAnkiCsv,
  getVocabKey,
  isVocabMastered,
  loadMasteredVocab,
  toggleMasteredVocabEntry,
} from '../src/utils/vocabStorage.js';
import {
  getActiveSpeakingId,
  isJapaneseVoice,
  parseTimestampToSeconds,
  selectJapaneseVoice,
  stopSpeaking,
  subscribeActiveSpeakingId,
} from '../src/utils/tts.js';

function createMemoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
  };
}

test('loadMasteredVocab migrates legacy v1 article-scoped keys to cross-day vocab entries', () => {
  const storage = createMemoryStorage({
    [LEGACY_MASTERED_KEY_V1]: JSON.stringify({
      'news-20261118-01:懸念': true,
      'news-20261118-02:無視': false,
    }),
  });

  const migrated = loadMasteredVocab(storage);
  assert.equal(isVocabMastered(migrated, { word: '懸念', reading: 'けねん' }), true);
  assert.equal(isVocabMastered(migrated, { word: '無視', reading: 'むし' }), false);
});

test('toggleMasteredVocabEntry stores full metadata and toggles cleanly across days', () => {
  const vocab = {
    word: '懸念',
    reading: 'けねん',
    jlpt: 'N1',
    pos: '名詞・サ変',
    meaningZh: '憂慮、擔憂',
    exampleJa: '景気後退が懸念されている。',
    exampleZh: '景氣衰退令人憂慮。',
    usageNote: '新聞常見於經濟與政策風險報導。',
  };

  const added = toggleMasteredVocabEntry({}, vocab, '2026-11-23');
  assert.equal(isVocabMastered(added, vocab), true);
  assert.equal(added[getVocabKey(vocab)].masteredAt, '2026-11-23');
  assert.equal(added[getVocabKey(vocab)].usageNote, '新聞常見於經濟與政策風險報導。');

  const removed = toggleMasteredVocabEntry(added, vocab, '2026-11-24');
  assert.equal(isVocabMastered(removed, vocab), false);
});

test('loadMasteredVocab prefers v2 storage when present', () => {
  const storage = createMemoryStorage({
    [MASTERED_STORAGE_KEY_V2]: JSON.stringify({
      '継続:けいぞく': { word: '継続', reading: 'けいぞく', jlpt: 'N2', masteredAt: '2026-11-20' },
    }),
  });
  const loaded = loadMasteredVocab(storage);
  assert.equal(isVocabMastered(loaded, { word: '継続', reading: 'けいぞく' }), true);
});

test('buildAnkiCsv outputs UTF-8 BOM CSV with proper escaping', () => {
  const csv = buildAnkiCsv([
    {
      word: '懸念',
      reading: 'けねん',
      jlpt: 'N1',
      pos: '名詞',
      meaningZh: '憂慮, "擔憂"',
      exampleJa: '影響が懸念される。',
      exampleZh: '影響令人擔憂。',
      masteredAt: '2026-11-23',
    },
  ]);

  assert.ok(csv.startsWith('\uFEFFFront,Back,JLPT,POS,ExampleJa,ExampleZh,MasteredAt'));
  assert.ok(csv.includes('懸念（けねん）,"憂慮, ""擔憂""",N1,名詞'));
});

test('parseTimestampToSeconds parses mm:ss and hh:mm:ss timestamps', () => {
  assert.equal(parseTimestampToSeconds('01:30'), 90);
  assert.equal(parseTimestampToSeconds('00:00'), 0);
  assert.equal(parseTimestampToSeconds('1:02:05'), 3725);
  assert.equal(parseTimestampToSeconds('invalid'), null);
});

test('selectJapaneseVoice rejects Chinese/English voices and prioritizes Japanese voices', () => {
  const onlyZhEn = [
    { name: 'Microsoft Hanhan - Chinese (Traditional, Taiwan)', lang: 'zh-TW' },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
  ];
  assert.equal(isJapaneseVoice(onlyZhEn[0]), false);
  assert.equal(selectJapaneseVoice(onlyZhEn), null);

  const mixed = [
    ...onlyZhEn,
    { name: 'Microsoft Haruka - Japanese (Japan)', lang: 'ja-JP' },
    { name: 'Microsoft Nanami Online (Natural) - Japanese (Japan)', lang: 'ja-JP' },
  ];
  assert.equal(selectJapaneseVoice(mixed)?.name, 'Microsoft Nanami Online (Natural) - Japanese (Japan)');
});

test('subscribeActiveSpeakingId and stopSpeaking maintain clean global playback state', () => {
  const seen = [];
  const unsubscribe = subscribeActiveSpeakingId((id) => seen.push(id));
  assert.equal(getActiveSpeakingId(), null);
  stopSpeaking();
  assert.equal(getActiveSpeakingId(), null);
  unsubscribe();
  assert.deepEqual(seen, []);
});
