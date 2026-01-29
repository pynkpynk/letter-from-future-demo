import Link from "next/link";

export default function HomePage() {
  return (
    <main className="main-shell">
      <div className="card card-outline p-10 text-center fade-in">
        <p className="badge">A Letter From the Future</p>
        <h1 className="mt-4 text-3xl font-bold text-ink">
          未来から届く、あなたへの手紙
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          10年後のあなたからもらえるアドバイス
        </p>
        <Link href="/letter-from-future" className="btn-habitto-primary mt-6">
          試してみる
        </Link>
      </div>
    </main>
  );
}
