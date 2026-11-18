import { useMemo, useState } from 'react';
import { Newspaper, EyeOff, Eye, Languages } from 'lucide-react';
import { NewsCard } from './NewsCard';

const CATEGORY_FILTERS = [
  { key: 'all', label: '全部領域' },
  { key: 'politics', label: '政治' },
  { key: 'economy', label: '經濟' },
  { key: 'society', label: '民生・社會' },
];

export function NewsSection({ articles, masteredIds, onToggleMastered }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showReadings, setShowReadings] = useState(true);
  const [hideMeanings, setHideMeanings] = useState(false);

  const counts = useMemo(() => {
    const map = { all: articles.length, politics: 0, economy: 0, society: 0 };
    for (const item of articles) {
      if (map[item.categoryKey] !== undefined) {
        map[item.categoryKey] += 1;
      }
    }
    return map;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'all') return articles;
    return articles.filter((item) => item.categoryKey === selectedCategory);
  }, [articles, selectedCategory]);

  return (
    <section id="news-section" aria-labelledby="news-heading">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">
            <Newspaper size={14} />
            <span>Daily Japan News Briefing</span>
          </div>
          <h2 id="news-heading" className="section-title">
            每日日本時事新聞學習區
          </h2>
          <p className="section-desc">
            精選民生・社會、政治與經濟領域報導，自動過濾 N5–N4 基礎字彙，聚焦 N3–N1 核心生詞與新聞語境例句。
          </p>
        </div>
      </div>

      <div className="toolbar-row">
        <div className="filter-tabs" role="tablist" aria-label="新聞分類篩選">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.key}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.key}
              className={`filter-btn ${selectedCategory === cat.key ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.key)}
            >
              {cat.label} ({counts[cat.key]})
            </button>
          ))}
        </div>

        <div className="study-toggles">
          <button
            type="button"
            className={`toggle-btn ${showReadings ? 'active' : ''}`}
            onClick={() => setShowReadings((prev) => !prev)}
          >
            <Languages size={14} />
            <span>{showReadings ? '顯示平假名讀音' : '已隱藏讀音'}</span>
          </button>
          <button
            type="button"
            className={`toggle-btn ${hideMeanings ? 'active' : ''}`}
            onClick={() => setHideMeanings((prev) => !prev)}
          >
            {hideMeanings ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{hideMeanings ? '閃卡測驗模式：開啟' : '閃卡測驗模式'}</span>
          </button>
        </div>
      </div>

      <div className="news-grid">
        {filteredArticles.map((article) => (
          <NewsCard
            key={article.id}
            article={article}
            showReadings={showReadings}
            hideMeanings={hideMeanings}
            masteredIds={masteredIds}
            onToggleMastered={onToggleMastered}
          />
        ))}
      </div>
    </section>
  );
}
