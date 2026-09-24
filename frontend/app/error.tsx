'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="empty-state">
      <h1>Не удалось показать страницу</h1>
      <p>Попробуйте загрузить её снова. Сохранённый план останется в браузере.</p>
      <button className="button button-primary" onClick={reset}>
        Повторить
      </button>
    </main>
  );
}
