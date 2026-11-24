import { useEffect, useState } from 'react';
import {
  Tv,
  Shuffle,
  SlidersHorizontal,
  MessageSquareQuote,
  Sparkles,
  Clock,
  Gamepad2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  Volume2,
  Play,
  Eye,
} from 'lucide-react';
import { VSPO_MEMBER_MAP } from '../data/vspoMembers';
import { parseTimestampToSeconds } from '../utils/tts';
import { useTtsPlayer } from '../hooks/useTtsPlayer';

export function VspoClipSection({
  selectedScored,
  scoredPool,
  isZeroWeightFallback,
  isLiveMode,
  memberWeights,
  showReadings = true,
  hideMeanings = false,
  ttsRate = 1.0,
  onReroll,
  onSelectPreview,
  onOpenWeights,
  onTtsUnavailable,
}) {
  const [poolExpanded, setPoolExpanded] = useState(false);
  const [seekState, setSeekState] = useState(null);
  const [revealedIds, setRevealedIds] = useState({});
  const { speakingId, ttsAvailable, toggleSpeak } = useTtsPlayer({
    rate: ttsRate,
    onNoVoice: onTtsUnavailable,
  });

  const currentClipId = selectedScored?.clip?.id || null;

  useEffect(() => {
    setSeekState(null);
  }, [currentClipId]);

  useEffect(() => {
    setRevealedIds({});
  }, [hideMeanings, currentClipId]);

  if (!selectedScored) {
    return null;
  }

  const { clip, probability, rawScore } = selectedScored;

  const handleSpeak = (id, text) => toggleSpeak(id, text);
  const toggleReveal = (key) => {
    setRevealedIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleJumpTimestamp = (timestamp) => {
    const seconds = parseTimestampToSeconds(timestamp);
    if (seconds === null) return;
    setSeekState({ seconds, nonce: Date.now() });
  };

  const embedUrl =
    seekState !== null
      ? `https://www.youtube.com/embed/${clip.youtubeId}?rel=0&start=${seekState.seconds}&autoplay=1`
      : `https://www.youtube.com/embed/${clip.youtubeId}?rel=0`;

  const youtubeActionUrl = isLiveMode
    ? `https://www.youtube.com/watch?v=${clip.youtubeId}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${clip.memberIds.map((id) => VSPO_MEMBER_MAP[id]?.name || '').join(' ')} ぶいすぽ 切り抜き`
      )}`;

  return (
    <section id="vspo-section" className="vspo-section" aria-labelledby="vspo-heading">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">
            <Tv size={14} />
            <span>VSPO! 24h Clip Listening Lab</span>
          </div>
          <h2 id="vspo-heading" className="section-title">
            ぶいすぽっ！每日切り抜き聽力學習區
          </h2>
          <p className="section-desc">
            從過去 24 小時內發布的日文切り抜き候選池中，依據你的成員偏好權重加權抽選每日精選 1 部。
          </p>
        </div>

        <div className="vspo-header-actions">
          <button type="button" className="btn-dark-ghost" onClick={onOpenWeights}>
            <SlidersHorizontal size={15} />
            <span>調整成員權重</span>
          </button>
          <button type="button" className="btn-reroll" onClick={onReroll}>
            <Shuffle size={15} />
            <span>依權重重新抽選</span>
          </button>
        </div>
      </div>

      {isZeroWeightFallback && (
        <div className="zero-weight-alert" role="status">
          <div>
            <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
            目前今日 24h 候選池內的成員權重總和為 0，已暫時採「全體均等機率」隨機挑選示範影片。
          </div>
          <button type="button" className="btn-dark-ghost" onClick={onOpenWeights}>
            前往調高成員權重
          </button>
        </div>
      )}

      <div className="vspo-theater-grid">
        {/* Left: Player + Metadata */}
        <div className="player-card">
          <div className="video-frame-wrap">
            <iframe
              key={`${clip.youtubeId}-${seekState?.nonce || 'init'}`}
              src={embedUrl}
              title={clip.titleJa}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="clip-info-body">
            <div className="clip-tags-row">
              <div className="member-pills">
                {clip.memberIds.map((memberId) => {
                  const member = VSPO_MEMBER_MAP[memberId];
                  if (!member) return null;
                  const weight = memberWeights[memberId] ?? 0;
                  return (
                    <span key={memberId} className="member-pill">
                      <span
                        className="member-dot"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="jp-text">{member.name}</span>
                      <span style={{ opacity: 0.72, fontSize: '0.72rem' }}>
                        權重 {weight}
                      </span>
                    </span>
                  );
                })}
              </div>

              <span className="prob-badge" title={`總分 ${rawScore} · 依目前權重計算`}>
                本次中選機率 {probability.toFixed(1)}%
              </span>
            </div>

            <h3 className="clip-title-ja jp-text">{clip.titleJa}</h3>
            <p className="clip-title-zh">{clip.titleZh}</p>

            <div className="clip-meta-sub">
              <span>頻道：{clip.channelName}</span>
              <span>
                <Clock size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                {clip.publishedHoursAgo} 小時前發布 · 時長 {clip.duration}
              </span>
              <span>
                <Gamepad2 size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                {clip.gameOrTopic}
              </span>
            </div>

            <div className="clip-context-box">{clip.contextSummaryZh}</div>

            <div className="mock-video-footnote">
              <span>
                {isLiveMode
                  ? '資料來源：過去 24 小時內發布的 ぶいすぽっ！日文切り抜き候選池（依權重抽選）'
                  : '示範資料模式：目前內嵌官方公開示範影片，執行排程更新後將載入即時剪輯。'}
              </span>
              <a href={youtubeActionUrl} target="_blank" rel="noopener noreferrer">
                {isLiveMode ? '在 YouTube 開啟原片' : '在 YouTube 搜尋相關切り抜き'}{' '}
                <ExternalLink size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
              </a>
            </div>
          </div>
        </div>

        {/* Right: 5 Slang Vocab + 3 Grammar Notes */}
        <div className="listening-aid-stack">
          <div className="aid-panel">
            <h3 className="aid-panel-title">
              <MessageSquareQuote size={17} color="#9be7c4" />
              <span>聽懂這段必備：口語單字 / VTuber 常用語（{clip.slangVocab.length}）</span>
            </h3>
            <div className="slang-list">
              {clip.slangVocab.map((item) => {
                const seekSeconds = parseTimestampToSeconds(item.timestamp);
                const canJump = seekSeconds !== null && seekSeconds > 0;
                const termSpeakId = `slang:${clip.id}:${item.term}`;
                const exSpeakId = `slang-ex:${clip.id}:${item.term}`;
                const revealKey = `slang:${clip.id}:${item.term}`;
                const isMasked = hideMeanings && !revealedIds[revealKey];

                return (
                  <div key={item.term} className="slang-item">
                    <div className="slang-top">
                      <div className="slang-head-main">
                        <div className="slang-term-group">
                          <span className="slang-term jp-text">{item.term}</span>
                          {showReadings && item.reading && (
                            <span className="slang-reading jp-text">({item.reading})</span>
                          )}
                        </div>
                        <div className="slang-tags">
                          <span className="slang-tag">{item.tag}</span>
                          {canJump ? (
                            <button
                              type="button"
                              className="timestamp-chip is-clickable mono-text"
                              onClick={() => handleJumpTimestamp(item.timestamp)}
                              title={`跳轉播放器至參考時間點 ${item.timestamp}`}
                            >
                              <Play size={10} />
                              <span>{item.timestamp}</span>
                            </button>
                          ) : (
                            <span className="timestamp-chip mono-text">{item.timestamp}</span>
                          )}
                        </div>
                      </div>
                      {ttsAvailable && (
                        <button
                          type="button"
                          className={`btn-tts is-dark ${speakingId === termSpeakId ? 'is-speaking' : ''}`}
                          onClick={() => handleSpeak(termSpeakId, item.reading || item.term)}
                          aria-label={`朗讀口語 ${item.term}`}
                          title="朗讀發音"
                        >
                          <Volume2 size={13} />
                        </button>
                      )}
                    </div>
                    {isMasked ? (
                      <button
                        type="button"
                        className="meaning-masked is-dark"
                        onClick={() => toggleReveal(revealKey)}
                      >
                        <Eye size={13} />
                        <span>點擊顯示中文釋義</span>
                      </button>
                    ) : (
                      <p className="slang-meaning">{item.meaningZh}</p>
                    )}
                    <div className="dark-example">
                      <div className="dark-example-row">
                        <p className="dark-example-ja jp-text">{item.exampleJa}</p>
                        {ttsAvailable && (
                          <button
                            type="button"
                            className={`btn-tts is-dark ${speakingId === exSpeakId ? 'is-speaking' : ''}`}
                            onClick={() => handleSpeak(exSpeakId, item.exampleJa)}
                            aria-label="朗讀口語例句"
                            title="朗讀例句"
                          >
                            <Volume2 size={13} />
                          </button>
                        )}
                      </div>
                      {!isMasked && <p className="dark-example-zh">{item.exampleZh}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="aid-panel">
            <h3 className="aid-panel-title">
              <Sparkles size={17} color="#ffd480" />
              <span>實用口語文法 / 語氣助詞解析（{clip.grammarPoints.length}）</span>
            </h3>
            <div className="grammar-list">
              {clip.grammarPoints.map((gp) => {
                const gpSpeakId = `grammar-ex:${clip.id}:${gp.pattern}`;
                const revealKey = `grammar:${clip.id}:${gp.pattern}`;
                const isMasked = hideMeanings && !revealedIds[revealKey];

                return (
                  <div key={gp.pattern} className="grammar-item">
                    <div className="grammar-pattern jp-text">{gp.pattern}</div>
                    <div className="grammar-meta">
                      <span>接續：{gp.connection}</span>
                      {!isMasked && <span className="grammar-nuance">語氣：{gp.nuance}</span>}
                    </div>
                    {isMasked ? (
                      <button
                        type="button"
                        className="meaning-masked is-dark"
                        onClick={() => toggleReveal(revealKey)}
                      >
                        <Eye size={13} />
                        <span>點擊顯示文法解析與中譯</span>
                      </button>
                    ) : (
                      <p className="grammar-explain">{gp.explanationZh}</p>
                    )}
                    <div className="dark-example">
                      <div className="dark-example-row">
                        <p className="dark-example-ja jp-text">{gp.exampleJa}</p>
                        {ttsAvailable && (
                          <button
                            type="button"
                            className={`btn-tts is-dark ${speakingId === gpSpeakId ? 'is-speaking' : ''}`}
                            onClick={() => handleSpeak(gpSpeakId, gp.exampleJa)}
                            aria-label="朗讀文法例句"
                            title="朗讀例句"
                          >
                            <Volume2 size={13} />
                          </button>
                        )}
                      </div>
                      {!isMasked && <p className="dark-example-zh">{gp.exampleZh}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Probability Transparency Table */}
      <div className="pool-inspector">
        <button
          type="button"
          className="pool-inspector-toggle"
          onClick={() => setPoolExpanded((prev) => !prev)}
        >
          <span>
            檢視今日 24h 切り抜き候選池（共 {scoredPool.length} 部）與即時權重機率分佈
          </span>
          {poolExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {poolExpanded && (
          <div className="pool-list">
            {scoredPool.map((entry) => {
              const isSelected = entry.clip.id === clip.id;
              return (
                <div
                  key={entry.clip.id}
                  className={`pool-row ${isSelected ? 'is-selected' : ''}`}
                >
                  <div>
                    <div className="pool-row-title jp-text">
                      {isSelected && '▶ '}
                      {entry.clip.titleJa}
                    </div>
                    <div className="pool-row-members">
                      <span>{entry.clip.publishedHoursAgo} 小時前</span>
                      <span>•</span>
                      {entry.memberBreakdown.map(({ id, weight }) => {
                        const member = VSPO_MEMBER_MAP[id];
                        return (
                          <span
                            key={id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <span
                              className="member-dot"
                              style={{ backgroundColor: member?.color || '#888' }}
                            />
                            <span className="jp-text">{member?.name || id}</span>
                            <span>({weight})</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="prob-bar-wrap">
                    <div className="prob-bar-track">
                      <div
                        className="prob-bar-fill"
                        style={{ width: `${Math.min(100, entry.probability)}%` }}
                      />
                    </div>
                    <div className="prob-bar-label mono-text">
                      權重分 {entry.rawScore} · {entry.probability.toFixed(1)}%
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-preview-clip"
                    onClick={() => onSelectPreview(entry.clip.id)}
                  >
                    {isSelected ? '目前顯示' : '切換試看'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
