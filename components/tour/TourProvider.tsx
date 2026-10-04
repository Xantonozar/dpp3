"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { LIST_TOUR, PRODUCT_TOUR, SECTION_TOURS, type TourStep } from "./steps";

const LIST_DONE = "dpp:tour:list";
const PRODUCT_DONE = "dpp:tour:product";

type TourRequest = { key?: string; startId?: string };
type DriverInstance = ReturnType<typeof driver>;

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return "1"; // storage unavailable → never auto-annoy
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function isProductPath(pathname: string) {
  return /^\/products\/[^/]+$/.test(pathname);
}

function elementExists(selector: string) {
  try {
    return document.querySelector(selector) !== null;
  } catch {
    return false;
  }
}

export function TourProvider() {
  const pathname = usePathname();
  const router = useRouter();
  const driverRef = useRef<DriverInstance | null>(null);
  const pendingRef = useRef<{ key: string; startId?: string } | null>(null);

  const start = useCallback((rawKey: string, startId?: string) => {
    const isSection = rawKey in SECTION_TOURS;
    const defs: TourStep[] | null = isSection
      ? SECTION_TOURS[rawKey]
      : rawKey === "list"
        ? LIST_TOUR
        : rawKey === "product"
          ? PRODUCT_TOUR
          : null;
    if (!defs || defs.length === 0) return;

    // List/product tours: filter permanently-missing targets up front.
    // Section tours keep every step — closed sub-sections open as reached.
    const steps = isSection ? defs : defs.filter((s) => elementExists(s.element));
    if (steps.length === 0) return;

    let startIdx = 0;
    if (startId) {
      let i = steps.findIndex((s) => s.element === `#${startId}`);
      if (i < 0) i = steps.findIndex((s) => s.element.includes(startId));
      if (i >= 0) startIdx = i;
    }

    // Starting mid-tour: open any closed parent sections up to the start step,
    // otherwise their lazy-rendered children don't exist yet.
    for (let i = 0; i < startIdx; i++) {
      const sel = steps[i].element;
      if (!sel.startsWith("#")) continue;
      const node = document.getElementById(sel.slice(1));
      if (node instanceof HTMLElement && node.tagName === "SECTION") {
        const head = node.querySelector(':scope > div > button[aria-expanded="false"]');
        if (head instanceof HTMLButtonElement) head.click();
      }
    }

    driverRef.current?.destroy();

    const instance = driver({
      showProgress: true,
      smoothScroll: true,
      skipMissingElement: isSection,
      waitForElement: isSection ? 400 : undefined,
      steps: steps.map((s) => ({
        element: s.element,
        popover: { title: s.title, description: s.description, side: s.side ?? "bottom", align: "center" },
      })),
      // Sub-sections lazy-render: open the highlighted section so its content shows.
      onHighlightStarted: (el) => {
        if (!(el instanceof HTMLElement) || el.tagName !== "SECTION") return;
        const head = el.querySelector(':scope > div > button[aria-expanded="false"]');
        if (head instanceof HTMLButtonElement) {
          head.click();
          setTimeout(() => driverRef.current?.refresh(), 250);
        }
      },
      onDestroyed: () => {
        if (rawKey === "list") safeSet(LIST_DONE, "1");
        else if (rawKey === "product") safeSet(PRODUCT_DONE, "1");
      },
    });
    driverRef.current = instance;
    instance.drive(startIdx);
  }, []);

  // Auto tours on navigation (once per browser, never under automation).
  useEffect(() => {
    const stopActive = () => {
      if (driverRef.current?.isActive()) driverRef.current.destroy();
    };

    const pending = pendingRef.current;
    const onList = pathname === "/products";
    const onProduct = isProductPath(pathname);
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (pending && ((pending.key === "list" && onList) || (pending.key === "product" && onProduct))) {
      const { key, startId } = pending;
      pendingRef.current = null;
      timer = setTimeout(() => start(key, startId), 400);
    } else {
      stopActive();
      if (typeof navigator !== "undefined" && navigator.webdriver) return () => clearTimeout(timer);
      if (onList && safeGet(LIST_DONE) !== "1") timer = setTimeout(() => start("list"), 700);
      else if (onProduct && safeGet(PRODUCT_DONE) !== "1") timer = setTimeout(() => start("product"), 700);
    }
    return () => clearTimeout(timer);
  }, [pathname, start]);

  // Manual triggers: TakeTourButton + every section/page "?" (startTour()).
  // Allowed under automation too, so e2e can assert them; nothing clicks them by itself.
  useEffect(() => {
    const onTour = (e: Event) => {
      const d = (e as CustomEvent<TourRequest | string | undefined>).detail;
      const key = typeof d === "string" ? d : (d?.key ?? "list");
      const startId = typeof d === "string" ? undefined : d?.startId;

      if (key === "list" && pathname !== "/products") {
        pendingRef.current = { key, startId };
        router.push("/products");
        return;
      }
      if (key === "product" && !isProductPath(pathname)) return;
      start(key, startId);
    };
    window.addEventListener("dpp:tour", onTour);
    return () => window.removeEventListener("dpp:tour", onTour);
  }, [pathname, router, start]);

  return null;
}
