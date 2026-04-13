import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Pied Piper — Decentralized Communication Protocol",
  description:
    "A new protocol for the internet. Secure, open, chain-native. No servers. No owners. Just signal.",
  openGraph: {
    title: "Pied Piper Protocol",
    description: "A new protocol for the internet.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} h-full dark`}>
      <body className="min-h-full flex flex-col font-mono bg-[#080a0e] text-[#00ff41]">
        {children}
      </body>
    </html>
  );
}
