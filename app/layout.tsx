import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start-2p",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "太空小蜜蜂 | Retro Space Invaders Arcade",
  description: "一個使用 Next.js 與 Canvas 打造的精美太空小蜜蜂 (Galaga) 射擊遊戲！玩家可挑戰自動生成的敵人波次，並在全服排行榜留下您的高分紀錄！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${pressStart2P.variable}`}>
      <body>{children}</body>
    </html>
  );
}
