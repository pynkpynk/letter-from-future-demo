import Link from "next/link";

export default function HomePage() {
  return (
    <main className="main-shell">
      <div className="card card-outline p-10 text-center fade-in">
        <p className="badge">Demo</p>
        <h1 className="mt-4 text-3xl font-bold text-ink">
          A Letter From the Future
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          10秒で未来の手紙と相談サマリーを作ります。
        </p>
        <Link href="/letter-from-future" className="btn-primary mt-6">
          体験をはじめる
        </Link>
      </div>
    </main>
  );
}
