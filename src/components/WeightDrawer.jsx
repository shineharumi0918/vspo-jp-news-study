import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, RotateCcw, Shuffle, Minus, Plus } from 'lucide-react';
import { VSPO_MEMBERS } from '../data/vspoMembers';

const GENERATIONS = [
  '全部',
  '初期成員',
  '2020年加入',
  '2021年加入',
  '2022–2023年加入',
  '2024–2026年加入',
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

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (prevFocus && typeof prevFocus.focus === 'function') {
        prevFocus.focus();
      }
    };
  }, [isOpen, onClose]);

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
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
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
          <div className="search-input-wrap">
            <Search size={15} className="search-input-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="搜尋成員名稱、平假名讀音或常玩遊戲（如 VALORANT）"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="drawer-presets">
            {GENERATIONS.map((gen) => (
              <button
                key={gen}
                type="button"
                className={`preset-btn ${selectedGen === gen ? 'active' : ''}`}
                onClick={() => setSelectedGen(gen)}
              >
                {gen}
              </button>
            ))}
          </div>

          <div className="drawer-presets">
            <button
              type="button"
              className={`preset-btn ${onlyTodayPool ? 'active' : ''}`}
              onClick={() => setOnlyTodayPool((prev) => !prev)}
            >
              僅看今日 24h 候選成員 ({candidateMemberIds.size})
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => onSetAllWeights(5)}
            >
              <RotateCcw size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
              全部重設為 5
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => onSetAllWeights(0)}
            >
              全部歸零（方便開單推）
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={onRandomizeWeights}
            >
              <Shuffle size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
              隨機體驗權重
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
