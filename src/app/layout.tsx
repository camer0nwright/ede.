import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { BottomNav, NavBar } from "@/components/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Body text.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// Headings, numbers and display text.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ede.",
  description: "A hybrid training coach for people who lift and run.",
  // Added to an iPhone home screen, ede. opens full-screen with its own name.
  appleWebApp: { capable: true, title: "ede.", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121410" },
    { media: "(prefers-color-scheme: light)", color: "#f3f2ec" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${manrope.variable} h-full`}>
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
