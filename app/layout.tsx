import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "AI Time Tracker - Track Your Time with AI-Powered Automation",
    template: "%s | AI Time Tracker"
  },
  description: "Track your time effortlessly with AI-powered time tracking. Automate activity logging, get detailed analytics, and boost your productivity with intelligent time management.",
  keywords: ["AI time tracker", "time tracking", "productivity", "time management", "AI productivity", "activity tracking", "time analytics", "automated time tracking"],
  authors: [{ name: "AI Time Tracker" }],
  creator: "AI Time Tracker",
  publisher: "AI Time Tracker",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aitimetracker.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://aitimetracker.com',
    siteName: "AI Time Tracker",
    title: "AI Time Tracker - Track Your Time with AI-Powered Automation",
    description: "Track your time effortlessly with AI-powered time tracking. Automate activity logging, get detailed analytics, and boost your productivity.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "AI Time Tracker Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Time Tracker - Track Your Time with AI-Powered Automation",
    description: "Track your time effortlessly with AI-powered time tracking. Automate activity logging, get detailed analytics, and boost your productivity.",
    images: ["/logo.png"],
    // creator: "@yourtwitterhandle", // Add your Twitter handle here
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // yahoo: 'your-yahoo-verification-code',
  },
    generator: 'v0.app'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aitimetracker.com'
  
  // Organization schema for better AI understanding
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "AI Time Tracker",
    "url": baseUrl,
    "logo": `${baseUrl}/logo.png`,
    "description": "AI-powered time tracking application that helps users track their time automatically using natural language",
    "sameAs": [
      // Add your social media profiles here
      // "https://twitter.com/aitimetracker",
      // "https://linkedin.com/company/aitimetracker"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Support",
      "email": "support@aitimetracker.com",
      "availableLanguage": "English"
    }
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
