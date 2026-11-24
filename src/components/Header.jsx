import { useState } from 'react';
import {
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Languages,
  Eye,
  EyeOff,
  Volume2,
} from 'lucide-react';
import { isTtsSupported } from '../utils/tts';

export function Header({
  date,
  activeView,
  onChangeView,
  showReadings,
  hideMeanings,
  slowSpeech,
  onToggleReadings,
  onToggleHideMeanings,
  onToggleSlowSpeech,
  masteredCount,
  totalVocabCount,
  totalSavedVocabCount,
  activeMembersCount,
  totalMembersCount,
  onOpenWeights,
  onOpenReview,
}) {
  const [controlsOpen, setControlsOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });
  const ttsAvailable = isTtsSupported();

  const collapseOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setControlsOpen(false);
    }
  };

  const handleSelectView = (view) => {
    onChangeView(view);
    collapseOnMobile();
    if (typeof window !== 'undefined' && window.scrollY > 120) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenWeights = () => {
    collapseOnMobile();
    onOpenWeights();
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="header-top-row">
          <div className="brand-group">
            <h1 className="brand-title">日語時事 × ぶいすぽっ！每日學習誌</h1>
            <p className="brand-sub">
              <span>{date} 更新</span>
              <span className="brand-sub-sep" aria-hidden="true">·</span>
              <span className="brand-sub-desc">
                新聞 N3–N1 生詞解析 × VTuber 24h 切り抜き聽力訓練
              </span>
            </p>
          </div>

          <div className="header-compact-bar">
            <button
              type="button"
              className="progress-chip"
              onClick={onOpenReview}
              title="開啟跨日生詞複習本與 Anki CSV 匯出"
            >
              <CheckCircle2 size={15} />
              <span>
                已熟記 {masteredCount}/{totalVocabCount} 詞
              </span>
              {totalSavedVocabCount > masteredCount && (
                <span className="progress-total-badge">共 {totalSavedVocabCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`btn-controls-toggle ${controlsOpen ? 'is-open' : ''}`}
              aria-expanded={controlsOpen}
              aria-controls="header-controls-panel"
              onClick={() => setControlsOpen((prev) => !prev)}
            >
              <span>顯示與設定</span>
              <ChevronDown size={15} className="toggle-chevron" />
            </button>
          </div>
        </div>

        <div
          id="header-controls-panel"
          className={`header-collapsible ${controlsOpen ? 'is-open' : ''}`}
          aria-hidden={!controlsOpen}
        >
          <div className="header-collapsible-inner">
            <div className="header-actions">
              <div className="header-control-group">
                <span className="header-control-label">顯示模組</span>
                <nav className="nav-pills" aria-label="學習區切換">
                  <button
                    type="button"
                    className={`nav-pill ${activeView === 'all' ? 'active' : ''}`}
                    onClick={() => handleSelectView('all')}
                  >
                    全部模組
                  </button>
                  <button
                    type="button"
                    className={`nav-pill ${activeView === 'news' ? 'active' : ''}`}
                    onClick={() => handleSelectView('news')}
                  >
                    日本新聞
                  </button>
                  <button
                    type="button"
                    className={`nav-pill ${activeView === 'vspo' ? 'active' : ''}`}
                    onClick={() => handleSelectView('vspo')}
                  >
                    VSPO! 切り抜き
                  </button>
                </nav>
              </div>

              <div className="header-control-group">
                <span className="header-control-label">全域學習</span>
                <div className="header-study-toggles" role="group" aria-label="全域學習顯示設定">
                  <button
                    type="button"
                    aria-pressed={showReadings}
                    className={`tray-toggle-btn ${showReadings ? 'active' : ''}`}
                    onClick={onToggleReadings}
                    title={showReadings ? '點擊隱藏全站假名讀音' : '點擊顯示全站假名讀音'}
                  >
                    <Languages size={14} />
                    <span className="toggle-label-desktop">
                      {showReadings ? '假名讀音' : '已藏讀音'}
                    </span>
                    <span className="toggle-label-mobile">假名讀音</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={hideMeanings}
                    className={`tray-toggle-btn ${hideMeanings ? 'active' : ''}`}
                    onClick={onToggleHideMeanings}
                    title="切換全站閃卡測驗模式（隱藏中文釋義與解析）"
                  >
                    {hideMeanings ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span className="toggle-label-desktop">閃卡測驗</span>
                    <span className="toggle-label-mobile">閃卡測驗</span>
                  </button>
                  {ttsAvailable && (
                    <button
                      type="button"
                      aria-pressed={slowSpeech}
                      className={`tray-toggle-btn ${slowSpeech ? 'active' : ''}`}
                      onClick={onToggleSlowSpeech}
                      title="切換全站日語朗讀語速（正常 1.0x / 慢速 0.8x）"
                    >
                      <Volume2 size={14} />
                      <span>{slowSpeech ? '語速 0.8x' : '語速 1.0x'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="header-control-group header-weight-group">
                <span className="header-control-label">剪輯抽選</span>
                <button
                  type="button"
                  className="btn-weight-trigger"
                  onClick={handleOpenWeights}
                >
                  <span className="weight-trigger-left">
                    <span className="weight-trigger-icon" aria-hidden="true">
                      <SlidersHorizontal size={14} />
                    </span>
                    <span>成員權重設定</span>
                  </span>
                  <span className="weight-trigger-right">
                    <span className="weight-count-pill">
                      <Sparkles size={11} />
                      <span>
                        {activeMembersCount}/{totalMembersCount}
                      </span>
                    </span>
                    <ChevronRight size={15} className="weight-trigger-arrow" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
