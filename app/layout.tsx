import type { Metadata, Viewport } from "next";
import { Inter, Kantumruy_Pro, Noto_Sans_Khmer } from "next/font/google";
import { AppProviders } from "@/components/context";
import { getUiPreferences } from "@/lib/preferences";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const kantumruy = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  weight: "variable",
  variable: "--font-kantumruy",
  display: "swap",
});

const notoKhmer = Noto_Sans_Khmer({
  subsets: ["khmer", "latin"],
  weight: "variable",
  variable: "--font-noto-khmer",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ZKTH Associates & Partners · Document Follow-Up",
    template: "%s · ZKTH Associates & Partners",
  },
  description:
    "Khmer and English client document case tracking for ZKTH Associates & Partners.",
  applicationName: "ZKTH Associates & Partners",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1716" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { lang, theme } = await getUiPreferences();
  return (
    <html
      lang={lang === "kh" ? "km" : "en"}
      className={theme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <body
        className={`${inter.variable} ${kantumruy.variable} ${notoKhmer.variable}`}
      >
        <AppProviders lang={lang} theme={theme}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
