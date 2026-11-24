import { useMemo, useRef, useState } from 'react';
import { X, Search, RotateCcw, Shuffle, Minus, Plus, CircleOff } from 'lucide-react';
import { VSPO_MEMBERS } from '../data/vspoMembers';
import { useDrawerDialog } from '../hooks/useDrawerDialog';

const GENERATIONS = [
  { value: '全部', label: '全部' },
  { value: '初期成員', label: '初期' },
  { value: '2020年加入', label: '2020' },
  { value: '2021年加入', label: '2021' },
  { value: '2022–2023年加入', label: '22–23' },
  { value: '2024–2026年加入', label: '24–26' },
];

export function WeightDrawer({
  isOpen,
  onClose,
  memberWeights,
  onChangeWeight,
  onSetAllWeights,
  onRandomizeWeights,
  onApplyAndReroll,
  candidateMemberIds,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGen, setSelectedGen] = useState('全部');
  const [onlyTodayPool, setOnlyTodayPool] = useState(false);
  const closeBtnRef = useRef(null);
  const panelRef = useRef(null);

  useDrawerDialog({
    isOpen,
    onClose,
    panelRef,
    initialFocusRef: closeBtnRef,
  });

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return VSPO_MEMBERS.filter((member) => {
      if (onlyTodayPool && !candidateMemberIds.has(member.id)) {
        return false;
      }
      if (selectedGen !== '全部' && member.generation !== selectedGen) {
        return false;
      }
      if (!query) return true;
      return (
        member.name.toLowerCase().includes(query) ||
        member.reading.includes(query) ||
        member.games.some((g) => g.toLowerCase().includes(query))
      );
    });
  }, [searchTerm, selectedGen, onlyTodayPool, candidateMemberIds]);

  const activeCount = useMemo(
    () => VSPO_MEMBERS.filter((m) => (memberWeights[m.id] ?? 0) > 0).length,
    [memberWeights]
  );

  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onClick={onClose}
    >
      <div ref={panelRef} className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2 id="drawer-title" className="drawer-title">
              ぶいすぽっ！成員偏好權重設定
            </h2>
            <p className="drawer-subtitle">
              調整滑桿（0～10）決定每日切り抜き的加權抽選比例，設定即時儲存於本機 localStorage。
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn-icon-close"
            onClick={onClose}
            aria-label="關閉權重設定面板"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-controls">
          <div className="drawer-search-row">
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="搜尋成員、讀音或遊戲"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              aria-pressed={onlyTodayPool}
              className={`preset-btn drawer-today-btn ${onlyTodayPool ? 'active' : ''}`}
              onClick={() => setOnlyTodayPool((prev) => !prev)}
              title="僅顯示今日 24 小時剪輯候選池中的成員"
            >
              今日候選 ({candidateMemberIds.size})
            </button>
          </div>

          <div className="drawer-gen-tabs" role="tablist" aria-label="加入年份篩選">
            {GENERATIONS.map((gen) => (
              <button
                key={gen.value}
                type="button"
                role="tab"
                aria-selected={selectedGen === gen.value}
                className={`preset-btn ${selectedGen === gen.value ? 'active' : ''}`}
                onClick={() => setSelectedGen(gen.value)}
              >
                {gen.label}
              </button>
            ))}
          </div>

          <div className="drawer-batch-bar">
            <button
              type="button"
              className="preset-btn drawer-batch-btn"
              onClick={() => onSetAllWeights(5)}
            >
              <RotateCcw size={12} />
              <span>重設為 5</span>
            </button>
            <button
              type="button"
              className="preset-btn drawer-batch-btn"
              onClick={() => onSetAllWeights(0)}
              title="將全員權重歸零，方便只拉高單推成員"
            >
              <CircleOff size={12} />
              <span>全部歸零</span>
            </button>
            <button
              type="button"
              className="preset-btn drawer-batch-btn"
              onClick={onRandomizeWeights}
            >
              <Shuffle size={12} />
              <span>隨機權重</span>
            </button>
          </div>
        </div>

        <div className="drawer-body">
          {filteredMembers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 32 }}>
              找不到符合條件的成員，請嘗試清除搜尋條件。
            </p>
          ) : (
            filteredMembers.map((member) => {
              const weight = memberWeights[member.id] ?? 0;
              const isInPool = candidateMemberIds.has(member.id);

              return (
                <div
                  key={member.id}
                  className={`member-weight-row ${weight === 0 ? 'is-zero' : ''}`}
                >
                  <div className="member-row-top">
                    <div className="member-identity">
                      <span
                        className="member-color-swatch"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="member-name jp-text">{member.name}</span>
                      <span className="member-reading jp-text">({member.reading})</span>
                      {isInPool && <span className="in-pool-badge">今日候選</span>}
                    </div>
                    <span
                      className={`weight-value-badge mono-text ${weight === 0 ? 'is-zero' : ''}`}
                    >
                      {weight === 0 ? '0 不抽' : `權重 ${weight}`}
                    </span>
                  </div>

                  <div className="slider-row">
                    <button
                      type="button"
                      className="btn-step-weight"
                      disabled={weight <= 0}
                      aria-label={`減少 ${member.name} 權重`}
                      onClick={() => onChangeWeight(member.id, weight - 1)}
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={weight}
                      aria-label={`${member.name} 出現權重`}
                      className="weight-slider"
                      style={{ '--member-accent': member.color }}
                      onChange={(e) => onChangeWeight(member.id, Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="btn-step-weight"
                      disabled={weight >= 10}
                      aria-label={`增加 ${member.name} 權重`}
                      onClick={() => onChangeWeight(member.id, weight + 1)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="drawer-footer">
          <div className="drawer-stats">
            已啟用 <strong>{activeCount}</strong> / {VSPO_MEMBERS.length} 位成員參與抽選
          </div>
          <button type="button" className="btn-apply-drawer" onClick={onApplyAndReroll}>
            套用權重並重新抽選每日影片
          </button>
        </div>
      </div>
    </div>
  );
}
