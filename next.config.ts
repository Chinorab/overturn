import type { NextConfig } from "next";

/**
 * Security headers. The app has no third-party scripts, no analytics, and no embeds, so
 * the policy can be strict: same-origin everything except Google Fonts. Model calls
 * happen server-side, so the browser never talks to the API.
 */
const csp = [
  "default-src 'self'",
  // Next.js inline runtime; no third-party scripts. The PDF layout engine (yoga) is WebAssembly
  // delivered as a data: URI, hence wasm-unsafe-eval and data: in connect-src. React dev tooling
  // needs eval; production does not.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      // Responses that carry document content are never cached anywhere.
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
