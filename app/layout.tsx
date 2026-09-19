import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { PageTransition, SiteFooter, SiteHeader, Stepper } from "@/components/site-chrome";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: {
    default: "Overturn — understand and contest a health insurance denial",
    template: "%s · Overturn",
  },
  description:
    "Upload a denial letter or Explanation of Benefits. Overturn explains what happened in plain English, shows the deadlines and protections that apply, and drafts an appeal letter you edit and send. Information, not legal advice. Nothing is stored.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://overturn-peach.vercel.app"),
  openGraph: {
    title: "Overturn — understand and contest a health insurance denial",
    description: "Reads your denial letter, shows the rights and deadlines that apply with the law behind each one, and drafts the appeal. Information, not legal advice.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Overturn: Your insurer said no. Understand why. Know your deadline. Answer back." }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1518" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${publicSans.variable} ${fraunces.variable} h-full antialiased`}>
      <head>
        {/* Apply the saved theme before first paint so there is no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("overturn.theme");if(t==="light"||t==="dark"){document.documentElement.classList.add(t)}}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <SessionProvider>
          <SiteHeader />
          <Stepper />
          <main id="main" className="w-full flex-1 px-4 py-8">
            <PageTransition>{children}</PageTransition>
          </main>
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
