import { ThemeProvider } from "@/components/ThemeProvider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "schlep-engine - AI-Powered Data Preparation",
  description:
    "Transform messy data into ML-ready formats with intelligent pattern recognition and automated workflows. Eliminate 80% of data preparation time.",
  keywords: [
    "data preparation",
    "machine learning",
    "AI",
    "data cleaning",
    "ML pipeline",
    "data transformation",
  ],
  authors: [{ name: "schlep-engine Team" }],
  creator: "schlep-engine",
  publisher: "schlep-engine",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://schlep-engine.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://schlep-engine.com",
    title: "schlep-engine - AI-Powered Data Preparation",
    description:
      "Transform messy data into ML-ready formats with intelligent pattern recognition and automated workflows.",
    siteName: "schlep-engine",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "schlep-engine - AI-Powered Data Preparation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "schlep-engine - AI-Powered Data Preparation",
    description:
      "Transform messy data into ML-ready formats with intelligent pattern recognition and automated workflows.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased overflow-x-hidden min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="fixed left-0 top-0 bottom-0 w-px bg-gray-200 z-50"></div>
          <div className="fixed right-0 top-0 bottom-0 w-px bg-gray-200 z-50"></div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
