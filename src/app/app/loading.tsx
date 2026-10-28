export default function Loading() {
  return (
    <main
      className="dashboard section-shell"
      aria-busy="true"
      aria-label="جارٍ التحميل / Loading"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-panel" />
    </main>
  );
}
