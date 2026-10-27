import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
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
  // Absolute links in shared previews.
  metadataBase: new URL(process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")),
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
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
