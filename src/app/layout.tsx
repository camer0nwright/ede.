import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ede.",
  description: "A hybrid training coach for people who lift and run.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
          {children}
          <footer className="py-6 text-center text-xs text-muted">
            ede. gives general training guidance, not medical advice. If you
            have pain, illness or an injury, see a doctor or physio.
          </footer>
        </div>
      </body>
    </html>
  );
}
