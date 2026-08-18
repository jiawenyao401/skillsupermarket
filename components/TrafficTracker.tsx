"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { classifyTrafficSource, normalizeTrafficPath, type TrafficSource } from "@/lib/traffic";

type TrafficEvent = "page_view" | "evaluation_cta_click";

function privacySignalEnabled(): boolean {
  const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack === "1" || privacyNavigator.globalPrivacyControl === true;
}

function sendTrafficEvent(event: TrafficEvent, path: string, source: TrafficSource) {
  if (privacySignalEnabled() || !normalizeTrafficPath(path)) return;
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, path, source }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

export function TrafficTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);
  const acquisitionSource = useRef<TrafficSource | null>(null);

  useEffect(() => {
    const path = normalizeTrafficPath(pathname);
    if (!path || lastTrackedPath.current === path) return;
    acquisitionSource.current ??= classifyTrafficSource(document.referrer, window.location.hostname);
    lastTrackedPath.current = path;
    sendTrafficEvent("page_view", path, acquisitionSource.current);
  }, [pathname]);

  useEffect(() => {
    const trackEvaluationCta = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname !== "/evaluate") return;
      const path = normalizeTrafficPath(window.location.pathname);
      acquisitionSource.current ??= classifyTrafficSource(document.referrer, window.location.hostname);
      if (path) sendTrafficEvent("evaluation_cta_click", path, acquisitionSource.current);
    };
    document.addEventListener("click", trackEvaluationCta, { capture: true });
    return () => document.removeEventListener("click", trackEvaluationCta, { capture: true });
  }, []);

  return null;
}
