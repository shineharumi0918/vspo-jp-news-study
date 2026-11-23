export function LoadingSkeleton() {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="載入今日日語學習內容中">
      <div className="skeleton-card">
        <div className="skeleton-line w-25" />
        <div className="skeleton-line h-lg w-80" />
        <div className="skeleton-line w-55" />
        <div className="skeleton-line h-box" />
      </div>
      <div className="skeleton-card">
        <div className="skeleton-line w-25" />
        <div className="skeleton-line h-lg w-80" />
        <div className="skeleton-line h-box" />
      </div>
      <div className="skeleton-card is-dark">
        <div className="skeleton-line w-25" />
        <div className="skeleton-line h-lg w-55" />
        <div className="skeleton-line h-box" />
      </div>
    </div>
  );
}
