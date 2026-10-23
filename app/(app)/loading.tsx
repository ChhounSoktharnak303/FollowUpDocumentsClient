export default function AppLoading() {
  return (
    <div className="page-wrap" aria-busy="true">
      <div className="mb-8 flex items-end justify-between">
        <div className="w-full max-w-lg space-y-3">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-9 w-72 max-w-full" />
          <div className="skeleton h-4 w-96 max-w-full" />
        </div>
        <div className="skeleton hidden h-10 w-32 sm:block" />
      </div>
      <div className="stats-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="stat-cell">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-7 w-10" />
          </div>
        ))}
      </div>
      <div className="skeleton mb-4 h-5 w-44" />
      <div className="queue-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="queue-row">
            <div className="queue-main space-y-2">
              <div className="skeleton h-4 w-52 max-w-full" />
              <div className="skeleton h-3 w-72 max-w-full" />
              <div className="skeleton h-3 w-40" />
            </div>
            <div className="queue-side">
              <div className="skeleton h-6 w-24" />
              <div className="skeleton h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
