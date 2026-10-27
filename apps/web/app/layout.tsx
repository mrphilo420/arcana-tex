import type { Metadata } from "next";
import Script from "next/script";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";
import { RootProvider } from "./provider";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
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
          cormorant.variable,
          jetbrains.variable,
          "h-full font-sans antialiased",
        )}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
