import { useEffect, useState } from 'react';
import {
  ExternalLink,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  Check,
  Volume2,
} from 'lucide-react';
import { getVocabKey, isVocabMastered } from '../utils/vocabStorage';
import { isTtsSupported, speakJapanese, stopSpeaking } from '../utils/tts';

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
  currentDate,
  showReadings,
  hideMeanings,
  ttsRate = 1.0,
  masteredVocab,
  onToggleMastered,
  onTtsUnavailable,
}) {
  const [vocabExpanded, setVocabExpanded] = useState(true);
  const [revealedIds, setRevealedIds] = useState({});
  const [speakingId, setSpeakingId] = useState(null);
  const ttsAvailable = isTtsSupported();

  // 切換閃卡測驗模式或更換文章時自動清空已掀開項目
  useEffect(() => {
    setRevealedIds({});
  }, [hideMeanings, article.id]);

  useEffect(() => () => stopSpeaking(), []);

  const toggleReveal = (vocabKey) => {
    setRevealedIds((prev) => ({ ...prev, [vocabKey]: !prev[vocabKey] }));
  };

  const handleSpeak = (id, text) => {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    speakJapanese(text, {
      rate: ttsRate,
      onEnd: () => setSpeakingId((cur) => (cur === id ? null : cur)),
      onNoVoice: onTtsUnavailable,
    });
  };

  const masteredInArticle = article.vocabulary.filter((v) =>
    isVocabMastered(masteredVocab, v)
  ).length;

  return (
    <article className="news-card">
      <div className="news-card-top">
        <div className="news-meta-row">
          <span className={`cat-badge ${CATEGORY_CLASS[article.categoryKey] || 'cat-society'}`}>
            {article.category}
          </span>
          <div className="news-meta-byline">
            <span className="source-name">{article.source}</span>
            <span className="meta-dot" aria-hidden="true">·</span>
            <span className="time-label">{article.publishedAt}</span>
          </div>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link"
          >
            <span>查看原文</span>
            <ExternalLink size={13} />
          </a>
        </div>

        <div className="news-title-row">
          <h3 className="news-title-ja jp-text">{article.titleJa}</h3>
          {ttsAvailable && (
            <button
              type="button"
              className={`btn-tts ${speakingId === `title:${article.id}` ? 'is-speaking' : ''}`}
              onClick={() => handleSpeak(`title:${article.id}`, article.titleJa)}
              aria-label="朗讀新聞日文標題"
              title="朗讀新聞標題"
            >
              <Volume2 size={14} />
            </button>
          )}
        </div>
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
              const vocabKey = getVocabKey(vocab);
              const revealKey = `${article.id}:${vocabKey}`;
              const isMastered = isVocabMastered(masteredVocab, vocab);
              const masteredRecord = masteredVocab?.[vocabKey] || masteredVocab?.[vocab.word];
              const isFromPreviousDay =
                isMastered &&
                masteredRecord?.masteredAt &&
                currentDate &&
                masteredRecord.masteredAt !== currentDate;
              const isMasked = hideMeanings && !revealedIds[revealKey];

              return (
                <div
                  key={vocabKey}
                  className={`vocab-card ${isMastered ? 'mastered' : ''}`}
                >
                  <div className="vocab-card-head">
                    <div className="vocab-head-main">
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
                    {ttsAvailable && (
                      <button
                        type="button"
                        className={`btn-tts ${speakingId === `word:${revealKey}` ? 'is-speaking' : ''}`}
                        onClick={() =>
                          handleSpeak(`word:${revealKey}`, vocab.reading || vocab.word)
                        }
                        aria-label={`朗讀單字 ${vocab.word}`}
                        title="朗讀單字發音"
                      >
                        <Volume2 size={13} />
                      </button>
                    )}
                  </div>

                  {isMasked ? (
                    <button
                      type="button"
                      className="meaning-masked"
                      onClick={() => toggleReveal(revealKey)}
                    >
                      <Eye size={13} />
                      <span>點擊顯示中文釋義</span>
                    </button>
                  ) : (
                    <div className="vocab-meaning">{vocab.meaningZh}</div>
                  )}

                  <div className="vocab-example">
                    <div className="vocab-example-row">
                      <p className="vocab-example-ja jp-text">
                        {renderHighlightedExample(vocab.exampleJa, vocab.word)}
                      </p>
                      {ttsAvailable && (
                        <button
                          type="button"
                          className={`btn-tts ${speakingId === `ex:${revealKey}` ? 'is-speaking' : ''}`}
                          onClick={() => handleSpeak(`ex:${revealKey}`, vocab.exampleJa)}
                          aria-label="朗讀日文例句"
                          title="朗讀日文例句"
                        >
                          <Volume2 size={13} />
                        </button>
                      )}
                    </div>
                    {!isMasked && <p className="vocab-example-zh">{vocab.exampleZh}</p>}
                  </div>

                  <p className="vocab-usage">{vocab.usageNote}</p>

                  <div className="vocab-footer">
                    {isFromPreviousDay && (
                      <span className="prior-mastered-tag">
                        已於 {masteredRecord.masteredAt} 學過
                      </span>
                    )}
                    <button
                      type="button"
                      className={`btn-master ${isMastered ? 'active' : ''}`}
                      onClick={() => onToggleMastered(vocab)}
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
