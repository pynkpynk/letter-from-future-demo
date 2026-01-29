import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

const zen = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "A Letter From the Future",
  description: "10秒で未来の手紙と相談サマリーを作るミニアプリ"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={zen.className}>{children}</body>
    </html>
  );
}
