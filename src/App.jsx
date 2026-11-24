import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { DEFAULT_MEMBER_WEIGHTS, VSPO_MEMBERS } from './data/vspoMembers';
import { computeClipWeights, pickWeightedClip } from './utils/weightedPicker';
import { buildGoogleTranslateAudioLink } from './utils/tts';
import {
  MASTERED_STORAGE_KEY_V2,
  isVocabMastered,
  loadMasteredVocab,
  toggleMasteredVocabEntry,
} from './utils/vocabStorage';
import { Header } from './components/Header';
import { NewsSection } from './components/NewsSection';
import { VspoClipSection } from './components/VspoClipSection';
import { WeightDrawer } from './components/WeightDrawer';
import { VocabReviewModal } from './components/VocabReviewModal';
import { LoadingSkeleton } from './components/LoadingSkeleton';

const STORAGE_KEYS = {
  WEIGHTS: 'vspo_member_weights_v1',
  DAILY_PICK: 'vspo_daily_pick_v1',
  STUDY_PREFS: 'jp_study_prefs_v1',
};

const DEFAULT_STUDY_PREFS = {
  showReadings: true,
  hideMeanings: false,
  slowSpeech: false,
};

function loadJsonStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getInitialWeights() {
  const saved = loadJsonStorage(STORAGE_KEYS.WEIGHTS, null);
  return saved ? { ...DEFAULT_MEMBER_WEIGHTS, ...saved } : { ...DEFAULT_MEMBER_WEIGHTS };
}

function getInitialStudyPrefs() {
  const saved = loadJsonStorage(STORAGE_KEYS.STUDY_PREFS, null);
  if (!saved) return { ...DEFAULT_STUDY_PREFS };
  return {
    showReadings:
      typeof saved.showReadings === 'boolean' ? saved.showReadings : DEFAULT_STUDY_PREFS.showReadings,
    hideMeanings:
      typeof saved.hideMeanings === 'boolean' ? saved.hideMeanings : DEFAULT_STUDY_PREFS.hideMeanings,
    slowSpeech:
      typeof saved.slowSpeech === 'boolean' ? saved.slowSpeech : DEFAULT_STUDY_PREFS.slowSpeech,
  };
}

function resolveInitialPick(dailyData, weights) {
  const savedPick = loadJsonStorage(STORAGE_KEYS.DAILY_PICK, null);
  if (
    savedPick &&
    savedPick.date === dailyData.meta.date &&
    dailyData.clipCandidates.some((c) => c.id === savedPick.clipId)
  ) {
    return {
      clipId: savedPick.clipId,
      isZeroWeightFallback: Boolean(savedPick.isZeroWeightFallback),
    };
  }
  const initial = pickWeightedClip(dailyData.clipCandidates, weights);
  return {
    clipId: initial.selected?.clip.id || dailyData.clipCandidates[0]?.id,
    isZeroWeightFallback: initial.isZeroWeightFallback,
  };
}

export default function App() {
  const [dailyData, setDailyData] = useState(null);
  const [activeView, setActiveView] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ttsNoticeText, setTtsNoticeText] = useState(null);

  const [memberWeights, setMemberWeights] = useState(getInitialWeights);
  const weightsRef = useRef(memberWeights);
  weightsRef.current = memberWeights;

  const [masteredVocab, setMasteredVocab] = useState(() => loadMasteredVocab());
  const [studyPrefs, setStudyPrefs] = useState(getInitialStudyPrefs);
  const [pickState, setPickState] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDailyContent() {
      try {
        const res = await fetch('./data/daily-content.json', { cache: 'no-store' });
        const json = res.ok ? await res.json() : null;
        if (
          !cancelled &&
          json &&
          Array.isArray(json.news) &&
          Array.isArray(json.clipCandidates) &&
          json.news.length > 0 &&
          json.clipCandidates.length > 0
        ) {
          setDailyData(json);
          setPickState(resolveInitialPick(json, weightsRef.current));
          return;
        }
      } catch {
        // 讀取失敗時動態載入內建 Mock Data，避免將假資料打進主 bundle
      }

      const { MOCK_DAILY_DATA } = await import('./data/mockDailyData');
      if (!cancelled) {
        setDailyData(MOCK_DAILY_DATA);
        setPickState(resolveInitialPick(MOCK_DAILY_DATA, weightsRef.current));
      }
    }

    loadDailyContent();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(memberWeights));
    } catch {
      // Ignore storage quota errors
    }
  }, [memberWeights]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MASTERED_STORAGE_KEY_V2, JSON.stringify(masteredVocab));
    } catch {
      // Ignore storage quota errors
    }
  }, [masteredVocab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.STUDY_PREFS, JSON.stringify(studyPrefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [studyPrefs]);

  useEffect(() => {
    if (!dailyData || !pickState?.clipId) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.DAILY_PICK,
        JSON.stringify({
          date: dailyData.meta.date,
          clipId: pickState.clipId,
          isZeroWeightFallback: pickState.isZeroWeightFallback,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [dailyData, pickState]);

  const scoredPool = useMemo(
    () => (dailyData ? computeClipWeights(dailyData.clipCandidates, memberWeights) : []),
    [dailyData, memberWeights]
  );

  const selectedScored = useMemo(
    () => scoredPool.find((item) => item.clip.id === pickState?.clipId) || scoredPool[0] || null,
    [scoredPool, pickState]
  );

  const candidateMemberIds = useMemo(() => {
    const ids = new Set();
    for (const clip of dailyData?.clipCandidates || []) {
      for (const id of clip.memberIds) {
        ids.add(id);
      }
    }
    return ids;
  }, [dailyData]);

  const totalVocabCount = useMemo(
    () => (dailyData?.news || []).reduce((sum, article) => sum + article.vocabulary.length, 0),
    [dailyData]
  );

  const masteredCount = useMemo(
    () =>
      (dailyData?.news || []).reduce(
        (sum, article) =>
          sum +
          article.vocabulary.filter((v) => isVocabMastered(masteredVocab, v)).length,
        0
      ),
    [dailyData, masteredVocab]
  );

  const totalSavedVocabCount = useMemo(
    () => Object.keys(masteredVocab).length,
    [masteredVocab]
  );

  const activeMembersCount = useMemo(
    () => VSPO_MEMBERS.filter((m) => (memberWeights[m.id] ?? 0) > 0).length,
    [memberWeights]
  );

  const handleToggleMastered = (vocab) => {
    setMasteredVocab((prev) =>
      toggleMasteredVocabEntry(prev, vocab, dailyData?.meta?.date)
    );
  };

  const handleRemoveVocab = (vocabKey) => {
    setMasteredVocab((prev) => {
      const next = { ...prev };
      delete next[vocabKey];
      return next;
    });
  };

  const handleChangeWeight = (memberId, value) => {
    setMemberWeights((prev) => ({
      ...prev,
      [memberId]: Math.max(0, Math.min(10, value)),
    }));
  };

  const handleSetAllWeights = (value) => {
    const next = {};
    for (const member of VSPO_MEMBERS) {
      next[member.id] = value;
    }
    setMemberWeights(next);
  };

  const handleRandomizeWeights = () => {
    const next = {};
    for (const member of VSPO_MEMBERS) {
      next[member.id] = Math.floor(Math.random() * 11);
    }
    setMemberWeights(next);
  };

  const handleReroll = () => {
    if (!dailyData) return;
    const result = pickWeightedClip(
      dailyData.clipCandidates,
      memberWeights,
      pickState?.clipId
    );
    if (result.selected) {
      setPickState({
        clipId: result.selected.clip.id,
        isZeroWeightFallback: result.isZeroWeightFallback,
      });
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    if (!dailyData || !selectedScored) return;
    const hasPositiveCandidate = scoredPool.some((item) => item.rawScore > 0);
    if (selectedScored.rawScore === 0 && hasPositiveCandidate) {
      handleReroll();
    }
  };

  const handleSelectPreview = (clipId) => {
    setPickState({
      clipId,
      isZeroWeightFallback: false,
    });
  };

  const handleApplyAndReroll = () => {
    handleReroll();
    setDrawerOpen(false);
  };

  const ttsRate = studyPrefs.slowSpeech ? 0.8 : 1.0;

  const toggleStudyPref = (key) => {
    setStudyPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-shell">
      <Header
        date={dailyData?.meta?.date || '載入中...'}
        activeView={activeView}
        onChangeView={setActiveView}
        showReadings={studyPrefs.showReadings}
        hideMeanings={studyPrefs.hideMeanings}
        slowSpeech={studyPrefs.slowSpeech}
        onToggleReadings={() => toggleStudyPref('showReadings')}
        onToggleHideMeanings={() => toggleStudyPref('hideMeanings')}
        onToggleSlowSpeech={() => toggleStudyPref('slowSpeech')}
        masteredCount={masteredCount}
        totalVocabCount={totalVocabCount}
        totalSavedVocabCount={totalSavedVocabCount}
        activeMembersCount={activeMembersCount}
        totalMembersCount={VSPO_MEMBERS.length}
        onOpenWeights={() => setDrawerOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
      />

      <main className="container main-content">
        {!dailyData ? (
          <LoadingSkeleton />
        ) : (
          <>
            {(activeView === 'all' || activeView === 'news') && (
              <NewsSection
                articles={dailyData.news}
                currentDate={dailyData.meta.date}
                showReadings={studyPrefs.showReadings}
                hideMeanings={studyPrefs.hideMeanings}
                ttsRate={ttsRate}
                masteredVocab={masteredVocab}
                onToggleMastered={handleToggleMastered}
                onTtsUnavailable={setTtsNoticeText}
              />
            )}

            {(activeView === 'all' || activeView === 'vspo') && (
              <VspoClipSection
                selectedScored={selectedScored}
                scoredPool={scoredPool}
                isZeroWeightFallback={Boolean(pickState?.isZeroWeightFallback)}
                isLiveMode={dailyData.meta.mode === 'live'}
                memberWeights={memberWeights}
                showReadings={studyPrefs.showReadings}
                hideMeanings={studyPrefs.hideMeanings}
                ttsRate={ttsRate}
                onReroll={handleReroll}
                onSelectPreview={handleSelectPreview}
                onOpenWeights={() => setDrawerOpen(true)}
                onTtsUnavailable={setTtsNoticeText}
              />
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <div
          className="container"
          style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
        >
          <span>
            日語時事 × ぶいすぽっ！每日學習誌 —{' '}
            {dailyData?.meta?.mode === 'live' ? '每日自動更新資料版' : '示範資料模式'}
          </span>
          <span>自動排程架構：GitHub Actions + NHK RSS / YouTube &amp; Holodex API + Gemini API</span>
        </div>
      </footer>

      <WeightDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        memberWeights={memberWeights}
        onChangeWeight={handleChangeWeight}
        onSetAllWeights={handleSetAllWeights}
        onRandomizeWeights={handleRandomizeWeights}
        onApplyAndReroll={handleApplyAndReroll}
        candidateMemberIds={candidateMemberIds}
      />

      <VocabReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        masteredMap={masteredVocab}
        showReadings={studyPrefs.showReadings}
        hideMeanings={studyPrefs.hideMeanings}
        slowSpeech={studyPrefs.slowSpeech}
        onToggleSlowSpeech={() => toggleStudyPref('slowSpeech')}
        onRemoveVocab={handleRemoveVocab}
        onTtsUnavailable={setTtsNoticeText}
      />

      {ttsNoticeText && (
        <div className="tts-toast" role="alert">
          <div className="tts-toast-body">
            <div className="tts-toast-title">未偵測到日語語音引擎（ja-JP）</div>
            <div>
              已攔截朗讀以避免以中文發音念漢字。建議改用 Chrome／Edge 開啟（內建線上日語語音），或於
              Windows「設定 → 時間與語言 → 語音」新增日文語音包。
            </div>
            <div className="tts-toast-actions">
              <a
                href={buildGoogleTranslateAudioLink(ttsNoticeText)}
                target="_blank"
                rel="noopener noreferrer"
                className="tts-toast-link"
              >
                <span>於 Google 翻譯聽「{ttsNoticeText.slice(0, 14)}{ttsNoticeText.length > 14 ? '…' : ''}」</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
          <button
            type="button"
            className="tts-toast-close"
            onClick={() => setTtsNoticeText(null)}
            aria-label="關閉語音提示"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
