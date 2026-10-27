import type { Metadata } from "next";
import Script from "next/script";
import {
  DM_Sans,
  Fira_Code,
  IBM_Plex_Mono,
  IBM_Plex_Serif,
  Inter,
  JetBrains_Mono,
  Manrope,
  Newsreader,
  Source_Serif_4,
} from "next/font/google";
import "@/styles/globals.css";
import { RootProvider } from "./provider";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const description =
  "A local-first AI LaTeX and Lean workspace for papers, reviews, Beamer presentations, Markdown notes, TikZ diagrams, and submission packages.";

export const metadata: Metadata = {
  title: "arcanaTeX — Local-first LaTeX workspace",
  applicationName: "arcanaTeX",
  description,
  openGraph: {
    title: "arcanaTeX — Local-first LaTeX workspace",
    description,
    siteName: "arcanaTeX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "arcanaTeX — Local-first LaTeX workspace",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body
        className={cn(
          inter.variable,
          newsreader.variable,
          jetbrains.variable,
          sourceSerif.variable,
          dmSans.variable,
          ibmPlexMono.variable,
          plexSerif.variable,
          manrope.variable,
          firaCode.variable,
          "h-full font-sans antialiased",
        )}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
