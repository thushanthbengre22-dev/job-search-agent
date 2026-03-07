import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Job Scout | AI Portfolio Project",
  description:
    "AI-powered job search agent for Massachusetts roles. Powered by Claude and JSearch.",
};

export const viewport: Viewport = {
  themeColor: "#0f1319",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground" suppressHydrationWarning>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <Analytics
          scriptSrc="https://www.bengredev.com/_vercel/insights/script.js"
        />
      </body>
    </html>
  );
}