"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>تعذّر تحميل الصفحة · Could not load this page</h1>
      <p>
        حاول مجددًا. لم نؤكد اكتمال العملية. · Please retry. The operation has
        not been confirmed.
      </p>
      <button className="button dark" onClick={reset}>
        إعادة المحاولة · Retry
      </button>
    </main>
  );
}
