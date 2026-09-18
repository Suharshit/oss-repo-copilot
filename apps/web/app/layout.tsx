import type { Metadata } from "next";
import localFont from "next/font/local";
import { Nav } from "./nav";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "repo-onboarding-copilot",
  description:
    "Paste a GitHub repo and get an overview, approachable issues, and a contribution brief.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables live on <html>, where Tailwind's base styles read them.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
