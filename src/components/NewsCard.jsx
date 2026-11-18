import { useState } from 'react';
import {
  ExternalLink,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  Check,
} from 'lucide-react';

const CATEGORY_CLASS = {
  politics: 'cat-politics',
  economy: 'cat-economy',
  society: 'cat-society',
};

function renderHighlightedExample(sentence, word) {
  if (!word || !sentence.includes(word)) {
    return sentence;
  }
  const parts = sentence.split(word);
  return parts.map((part, idx) => (
    <span key={idx}>
      {part}
      {idx < parts.length - 1 && <span className="vocab-highlight">{word}</span>}
    </span>
  ));
}

export function NewsCard({
  article,
  showReadings,
  hideMeanings,
  masteredIds,
  onToggleMastered,
}) {
  const [vocabExpanded, setVocabExpanded] = useState(true);
  const [revealedIds, setRevealedIds] = useState({});

  const toggleReveal = (vocabKey) => {
    setRevealedIds((prev) => ({ ...prev, [vocabKey]: !prev[vocabKey] }));
  };

  const masteredInArticle = article.vocabulary.filter(
    (v) => masteredIds[`${article.id}:${v.word}`]
  ).length;

  return (
    <article className="news-card">
      <div className="news-card-top">
        <div className="news-meta-row">
          <div className="news-meta-left">
            <span className={`cat-badge ${CATEGORY_CLASS[article.categoryKey] || 'cat-society'}`}>
              {article.category}
            </span>
            <span className="source-badge">{article.source}</span>
            <span className="time-label">{article.publishedAt}</span>
          </div>

          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link"
          >
            <span>查看原文來源</span>
            <ExternalLink size={13} />
          </a>
        </div>

        <h3 className="news-title-ja jp-text">{article.titleJa}</h3>
        {showReadings && (
          <p className="news-title-reading jp-text">{article.titleReading}</p>
        )}
        <p className="news-title-zh">{article.titleZh}</p>

        <div className="summary-box">
          <div className="summary-header">
            <span>AI 重點概要</span>
            <span>{article.summaryZh.length} 字</span>
          </div>
          <p className="summary-text">{article.summaryZh}</p>
        </div>
      </div>

      <div className="vocab-panel">
        <div className="vocab-panel-bar">
          <div className="vocab-panel-title">
            <BookOpen size={16} />
            <span>
              N3–N1 核心生詞表（{article.vocabulary.length} 詞 · 已熟記 {masteredInArticle}/
              {article.vocabulary.length}）
            </span>
          </div>
          <button
            type="button"
            className="btn-collapse"
            onClick={() => setVocabExpanded((prev) => !prev)}
          >
            <span>{vocabExpanded ? '收合單字表' : '展開單字表'}</span>
            {vocabExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {vocabExpanded && (
          <div className="vocab-grid">
            {article.vocabulary.map((vocab) => {
              const vocabKey = `${article.id}:${vocab.word}`;
              const isMastered = Boolean(masteredIds[vocabKey]);
              const isMasked = hideMeanings && !revealedIds[vocabKey];

              return (
                <div
                  key={vocab.word}
                  className={`vocab-card ${isMastered ? 'mastered' : ''}`}
                >
                  <div className="vocab-card-head">
                    <div className="vocab-word-line">
                      <span className="vocab-kanji jp-text">{vocab.word}</span>
                      {showReadings && (
                        <span className="vocab-reading jp-text">({vocab.reading})</span>
                      )}
                    </div>
                    <div className="vocab-badges">
                      <span className={`jlpt-badge jlpt-${vocab.jlpt}`}>{vocab.jlpt}</span>
                      <span className="pos-badge">{vocab.pos}</span>
                    </div>
                  </div>

                  {isMasked ? (
                    <button
                      type="button"
                      className="meaning-masked"
                      onClick={() => toggleReveal(vocabKey)}
                    >
                      <Eye size={13} />
                      <span>點擊顯示中文釋義</span>
                    </button>
                  ) : (
                    <div className="vocab-meaning">{vocab.meaningZh}</div>
                  )}

                  <div className="vocab-example">
                    <p className="vocab-example-ja jp-text">
                      {renderHighlightedExample(vocab.exampleJa, vocab.word)}
                    </p>
                    {!isMasked && <p className="vocab-example-zh">{vocab.exampleZh}</p>}
                  </div>

                  <p className="vocab-usage">{vocab.usageNote}</p>

                  <div className="vocab-footer">
                    <button
                      type="button"
                      className={`btn-master ${isMastered ? 'active' : ''}`}
                      onClick={() => onToggleMastered(vocabKey)}
                    >
                      <Check size={13} />
                      <span>{isMastered ? '已記住' : '標記熟記'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
