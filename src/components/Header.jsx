import { SlidersHorizontal, CheckCircle2, Sparkles } from 'lucide-react';

export function Header({
  date,
  dataMode,
  activeView,
  onChangeView,
  masteredCount,
  totalVocabCount,
  activeMembersCount,
  totalMembersCount,
  onOpenWeights,
}) {
  const isLive = dataMode === 'live';

  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand-group">
          <div className="brand-seal jp-text" aria-hidden="true">
            日語
          </div>
          <div>
            <h1 className="brand-title">
              日語時事 × ぶいすぽっ！每日學習誌
              <span className={`phase-badge ${isLive ? 'is-live' : ''}`}>
                {isLive ? '每日自動更新 Live' : '示範資料模式'}
              </span>
            </h1>
            <p className="brand-sub">
              <span>{date} 更新</span>
              <span>•</span>
              <span>新聞 N3–N1 生詞解析 × VTuber 24h 切り抜き聽力訓練</span>
            </p>
          </div>
        </div>

        <div className="header-actions">
          <nav className="nav-pills" aria-label="學習區切換">
            <button
              type="button"
              className={`nav-pill ${activeView === 'all' ? 'active' : ''}`}
              onClick={() => onChangeView('all')}
            >
              全部模組
            </button>
            <button
              type="button"
              className={`nav-pill ${activeView === 'news' ? 'active' : ''}`}
              onClick={() => onChangeView('news')}
            >
              日本新聞
            </button>
            <button
              type="button"
              className={`nav-pill ${activeView === 'vspo' ? 'active' : ''}`}
              onClick={() => onChangeView('vspo')}
            >
              VSPO! 切り抜き
            </button>
          </nav>

          <div className="progress-chip" title="儲存於本機 localStorage">
            <CheckCircle2 size={15} />
            <span>
              已熟記 {masteredCount}/{totalVocabCount} 詞
            </span>
          </div>

          <button
            type="button"
            className="btn-weight-trigger"
            onClick={onOpenWeights}
          >
            <SlidersHorizontal size={15} />
            <span>成員權重設定</span>
            <span className="weight-count-pill">
              <Sparkles size={11} style={{ display: 'inline', marginRight: 3 }} />
              {activeMembersCount}/{totalMembersCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
