import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "XAUUSD Predictor — Bot Prediksi Gold 5 Menit",
  description:
    "Bot prediksi pergerakan harga XAUUSD (Gold) untuk timeframe 5 menit. Sinyal BUY/SELL/HOLD berbasis RSI, MACD, EMA, Bollinger Bands, dan Stochastic.",
  keywords: [
    "XAUUSD", "Gold", "prediksi", "trading", "bot", "5 menit", "RSI", "MACD",
  ],
  authors: [{ name: "Z.ai" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
