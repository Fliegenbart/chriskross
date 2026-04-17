import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Krossmail — Chriss Kross Pizza Outreach",
  description: "Kalte Pizza-Pitches. Aber warm rausgeschickt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
