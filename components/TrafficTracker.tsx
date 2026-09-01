"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  classifyTrafficSource,
  isEvaluationDestination,
  normalizeTrafficPath,
  type TrafficSource,
} from "@/lib/traffic";

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
    const trackCurrentPage = () => {
      const path = normalizeTrafficPath(window.location.pathname);
      acquisitionSource.current ??= classifyTrafficSource(document.referrer, window.location.hostname);
      if (path) sendTrafficEvent("evaluation_cta_click", path, acquisitionSource.current);
    };
    const trackEvaluationCta = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (!isEvaluationDestination(anchor.href, window.location.origin)) return;
      trackCurrentPage();
    };
    const trackEvaluationSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!isEvaluationDestination(form.action, window.location.origin)) return;
      trackCurrentPage();
    };
    document.addEventListener("click", trackEvaluationCta, { capture: true });
    document.addEventListener("submit", trackEvaluationSubmit, { capture: true });
    return () => {
      document.removeEventListener("click", trackEvaluationCta, { capture: true });
      document.removeEventListener("submit", trackEvaluationSubmit, { capture: true });
    };
  }, []);

  return null;
}
