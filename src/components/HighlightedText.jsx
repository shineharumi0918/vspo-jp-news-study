export function HighlightedText({ sentence, word }) {
  if (!word || !sentence || !sentence.includes(word)) {
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
