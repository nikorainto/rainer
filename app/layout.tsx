import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Live radar at one pin, for the past hour and the next.";

function siteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (host) return new URL(`https://${host}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Rainer",
  description,
  openGraph: {
    title: "Rainer",
    description,
    siteName: "Rainer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rainer",
    description,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#061018",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <link rel="preconnect" href="https://server.arcgisonline.com" />
        <link rel="preconnect" href="https://tilecache.rainviewer.com" />
      </head>
      <body className="h-dvh overflow-hidden font-sans text-ink">{children}</body>
    </html>
  );
}
