"use client";

import { useEffect } from "react";

/**
 * Entrance animation for elements marked `data-reveal`. Content is never hidden unless
 * JavaScript has run and the observer is live; a timer marks everything visible anyway
 * after two seconds, so nothing can stay invisible in an odd browser.
 */
export function RevealObserver() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (items.length === 0) return;
    const show = (el: HTMLElement) => el.setAttribute("data-reveal", "in");
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach(show);
      return;
    }
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    items.forEach((el) => io.observe(el));
    const safety = window.setTimeout(() => items.forEach(show), 2000);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, []);
  return null;
}
