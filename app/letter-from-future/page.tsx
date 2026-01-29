import LetterFromFutureClient from "@/components/LetterFromFutureClient";

export default function LetterFromFuturePage() {
  return (
    <main className="main-shell">
      <div className="mb-8 flex flex-col gap-3 text-center">
        <p className="badge mx-auto">A Letter From the Future</p>
        <h1 className="text-3xl font-bold md:text-4xl">
          未来から届く、あなたへの手紙
        </h1>
        <p className="text-sm text-ink/70">
          10年後のあなたからもらえるアドバイス
        </p>
      </div>
      <LetterFromFutureClient />
    </main>
  );
}
