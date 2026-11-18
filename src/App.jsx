import { useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_DAILY_DATA } from './data/mockDailyData';
import { DEFAULT_MEMBER_WEIGHTS, VSPO_MEMBERS } from './data/vspoMembers';
import { computeClipWeights, pickWeightedClip } from './utils/weightedPicker';
import { Header } from './components/Header';
import { NewsSection } from './components/NewsSection';
import { VspoClipSection } from './components/VspoClipSection';
import { WeightDrawer } from './components/WeightDrawer';

const STORAGE_KEYS = {
  WEIGHTS: 'vspo_member_weights_v1',
  DAILY_PICK: 'vspo_daily_pick_v1',
  MASTERED: 'jp_study_mastered_vocab_v1',
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

function getInitialPick(dailyData, weights) {
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
  const [dailyData, setDailyData] = useState(MOCK_DAILY_DATA);
  const [activeView, setActiveView] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [memberWeights, setMemberWeights] = useState(getInitialWeights);
  const weightsRef = useRef(memberWeights);
  weightsRef.current = memberWeights;

  const [masteredIds, setMasteredIds] = useState(() =>
    loadJsonStorage(STORAGE_KEYS.MASTERED, {})
  );
  const [pickState, setPickState] = useState(() =>
    getInitialPick(MOCK_DAILY_DATA, getInitialWeights())
  );

  useEffect(() => {
    let cancelled = false;
    fetch('./data/daily-content.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (
          cancelled ||
          !json ||
          !Array.isArray(json.news) ||
          !Array.isArray(json.clipCandidates) ||
          json.news.length === 0 ||
          json.clipCandidates.length === 0
        ) {
          return;
        }
        setDailyData(json);
        setPickState(getInitialPick(json, weightsRef.current));
      })
      .catch(() => {
        // 找不到或無法讀取 daily-content.json 時自動維持內建 Mock Data
      });

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
      window.localStorage.setItem(STORAGE_KEYS.MASTERED, JSON.stringify(masteredIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [masteredIds]);

  useEffect(() => {
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
  }, [dailyData.meta.date, pickState]);

  const scoredPool = useMemo(
    () => computeClipWeights(dailyData.clipCandidates, memberWeights),
    [dailyData.clipCandidates, memberWeights]
  );

  const selectedScored = useMemo(
    () => scoredPool.find((item) => item.clip.id === pickState.clipId) || scoredPool[0],
    [scoredPool, pickState.clipId]
  );

  const candidateMemberIds = useMemo(() => {
    const ids = new Set();
    for (const clip of dailyData.clipCandidates) {
      for (const id of clip.memberIds) {
        ids.add(id);
      }
    }
    return ids;
  }, [dailyData.clipCandidates]);

  const totalVocabCount = useMemo(
    () => dailyData.news.reduce((sum, article) => sum + article.vocabulary.length, 0),
    [dailyData.news]
  );

  const masteredCount = useMemo(
    () =>
      dailyData.news.reduce(
        (sum, article) =>
          sum +
          article.vocabulary.filter((v) => Boolean(masteredIds[`${article.id}:${v.word}`])).length,
        0
      ),
    [dailyData.news, masteredIds]
  );

  const activeMembersCount = useMemo(
    () => VSPO_MEMBERS.filter((m) => (memberWeights[m.id] ?? 0) > 0).length,
    [memberWeights]
  );

  const handleToggleMastered = (vocabKey) => {
    setMasteredIds((prev) => ({
      ...prev,
      [vocabKey]: !prev[vocabKey],
    }));
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
    const result = pickWeightedClip(
      dailyData.clipCandidates,
      memberWeights,
      pickState.clipId
    );
    if (result.selected) {
      setPickState({
        clipId: result.selected.clip.id,
        isZeroWeightFallback: result.isZeroWeightFallback,
      });
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

  return (
    <div className="app-shell">
      <Header
        date={dailyData.meta.date}
        dataMode={dailyData.meta.mode}
        activeView={activeView}
        onChangeView={setActiveView}
        masteredCount={masteredCount}
        totalVocabCount={totalVocabCount}
        activeMembersCount={activeMembersCount}
        totalMembersCount={VSPO_MEMBERS.length}
        onOpenWeights={() => setDrawerOpen(true)}
      />

      <main className="container main-content">
        {(activeView === 'all' || activeView === 'news') && (
          <NewsSection
            articles={dailyData.news}
            masteredIds={masteredIds}
            onToggleMastered={handleToggleMastered}
          />
        )}

        {(activeView === 'all' || activeView === 'vspo') && (
          <VspoClipSection
            selectedScored={selectedScored}
            scoredPool={scoredPool}
            isZeroWeightFallback={pickState.isZeroWeightFallback}
            isLiveMode={dailyData.meta.mode === 'live'}
            memberWeights={memberWeights}
            onReroll={handleReroll}
            onSelectPreview={handleSelectPreview}
            onOpenWeights={() => setDrawerOpen(true)}
          />
        )}
      </main>

      <footer className="site-footer">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>
            日語時事 × ぶいすぽっ！每日學習誌 —{' '}
            {dailyData.meta.mode === 'live' ? '每日自動更新資料版' : '示範資料模式'}
          </span>
          <span>自動排程架構：GitHub Actions + NHK RSS / YouTube &amp; Holodex API + Gemini API</span>
        </div>
      </footer>

      <WeightDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        memberWeights={memberWeights}
        onChangeWeight={handleChangeWeight}
        onSetAllWeights={handleSetAllWeights}
        onRandomizeWeights={handleRandomizeWeights}
        onApplyAndReroll={handleApplyAndReroll}
        candidateMemberIds={candidateMemberIds}
      />
    </div>
  );
}
