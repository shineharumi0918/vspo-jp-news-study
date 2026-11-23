import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Volume2, Download, Trash2 } from 'lucide-react';
import { buildAnkiCsv } from '../utils/vocabStorage';
import { isTtsSupported, speakJapanese, stopSpeaking } from '../utils/tts';

const JLPT_FILTERS = ['全部', 'N1', 'N2', 'N3'];

export function VocabReviewModal({ isOpen, onClose, masteredMap, onRemoveVocab, onTtsUnavailable }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [jlptFilter, setJlptFilter] = useState('全部');
  const [speakingKey, setSpeakingKey] = useState(null);
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
      stopSpeaking();
      setSpeakingKey(null);
      if (prevFocus && typeof prevFocus.focus === 'function') {
        prevFocus.focus();
      }
    };
  }, [isOpen, onClose]);

  const allEntries = useMemo(() => {
    return Object.entries(masteredMap || {})
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => String(b.masteredAt || '').localeCompare(String(a.masteredAt || '')));
  }, [masteredMap]);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (jlptFilter !== '全部' && entry.jlpt !== jlptFilter) return false;
      if (!query) return true;
      return (
        String(entry.word || '').toLowerCase().includes(query) ||
        String(entry.reading || '').includes(query) ||
        String(entry.meaningZh || '').toLowerCase().includes(query)
      );
    });
  }, [allEntries, jlptFilter, searchTerm]);

  const handleSpeak = (key, text) => {
    if (speakingKey === key) {
      stopSpeaking();
      setSpeakingKey(null);
      return;
    }
    setSpeakingKey(key);
    speakJapanese(text, {
      rate: 0.95,
      onEnd: () => setSpeakingKey((cur) => (cur === key ? null : cur)),
      onNoVoice: onTtsUnavailable,
    });
  };

  const handleExportCsv = () => {
    if (allEntries.length === 0) return;
    const csv = buildAnkiCsv(allEntries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `jp-news-vocab-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const ttsAvailable = isTtsSupported();

  return (
    <div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-drawer-title"
      onClick={onClose}
    >
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2 id="review-drawer-title" className="drawer-title">
              跨日生詞複習本（{allEntries.length} 詞）
            </h2>
            <p className="drawer-subtitle">
              跨日期自動記住已標記的 N3–N1 生詞，支援語音朗讀與一鍵匯出 Anki CSV。
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn-icon-close"
            onClick={onClose}
            aria-label="關閉生詞複習本"
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
              placeholder="搜尋單字、平假名讀音或中文釋義"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="drawer-presets">
            {JLPT_FILTERS.map((level) => (
              <button
                key={level}
                type="button"
                className={`preset-btn ${jlptFilter === level ? 'active' : ''}`}
                onClick={() => setJlptFilter(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="drawer-body">
          {filteredEntries.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 32 }}>
              {allEntries.length === 0
                ? '尚未標記熟記生詞，點擊新聞單字卡右下角「標記熟記」即可自動收錄。'
                : '找不到符合條件的生詞。'}
            </p>
          ) : (
            filteredEntries.map((entry) => (
              <div key={entry.key} className="review-vocab-card">
                <div className="review-vocab-top">
                  <div className="vocab-word-line">
                    <span className="vocab-kanji jp-text">{entry.word}</span>
                    {entry.reading && (
                      <span className="vocab-reading jp-text">({entry.reading})</span>
                    )}
                    {ttsAvailable && (
                      <button
                        type="button"
                        className={`btn-tts ${speakingKey === entry.key ? 'is-speaking' : ''}`}
                        onClick={() => handleSpeak(entry.key, entry.reading || entry.word)}
                        aria-label={`朗讀 ${entry.word}`}
                        title="日語發音"
                      >
                        <Volume2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="vocab-badges">
                    {entry.jlpt && (
                      <span className={`jlpt-badge jlpt-${entry.jlpt}`}>{entry.jlpt}</span>
                    )}
                    {entry.pos && <span className="pos-badge">{entry.pos}</span>}
                  </div>
                </div>

                {entry.meaningZh && <div className="vocab-meaning">{entry.meaningZh}</div>}

                {entry.exampleJa && (
                  <div className="vocab-example">
                    <p className="vocab-example-ja jp-text">{entry.exampleJa}</p>
                    {entry.exampleZh && <p className="vocab-example-zh">{entry.exampleZh}</p>}
                  </div>
                )}

                <div className="review-vocab-meta">
                  <span>收錄日期：{entry.masteredAt || '—'}</span>
                  <button
                    type="button"
                    className="btn-remove-vocab"
                    onClick={() => onRemoveVocab(entry.key)}
                  >
                    <Trash2 size={12} />
                    <span>移除</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="drawer-footer">
          <div className="drawer-stats">
            目前顯示 <strong>{filteredEntries.length}</strong> / {allEntries.length} 詞
          </div>
          <button
            type="button"
            className="btn-apply-drawer"
            onClick={handleExportCsv}
            disabled={allEntries.length === 0}
          >
            <Download size={15} />
            <span>匯出 Anki CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
}
