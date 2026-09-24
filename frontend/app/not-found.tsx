import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main-content" className="empty-state">
      <h1>Этот район ещё не построен</h1>
      <p>Страница не найдена.</p>
      <Link href="/simulator" className="button button-primary">
        Вернуться в кабинет
      </Link>
    </main>
  );
}
