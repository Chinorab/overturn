import type { Metadata, Viewport } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { PageTransition, SiteFooter, SiteHeader, Stepper } from "@/components/site-chrome";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Overturn — understand and contest a health insurance denial",
    template: "%s · Overturn",
  },
  description:
    "Upload a denial letter or Explanation of Benefits. Overturn explains what happened in plain English, shows the deadlines and protections that apply, and drafts an appeal letter you edit and send. Information, not legal advice. Nothing is stored.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://overturn-peach.vercel.app"),
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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${publicSans.variable} ${sourceSerif.variable} h-full antialiased`}>
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
          <main id="main" className="mx-auto w-full max-w-[680px] flex-1 px-4 py-6">
            <PageTransition>{children}</PageTransition>
          </main>
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
