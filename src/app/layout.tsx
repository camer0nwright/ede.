import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import { BottomNav, NavBar } from "@/components/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Condensed display face for headings and big numbers.
const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "ede.",
  description: "A hybrid training coach for people who lift and run.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${display.variable} h-full`}>
      <body className="min-h-full">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-24">{children}</div>
        <Suspense fallback={<NavBar active={null} />}>
          <BottomNav />
        </Suspense>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
