"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  classifyTrafficSource,
  isEvaluationDestination,
  isGuideContinuationDestination,
  normalizeTrafficPath,
  type TrafficEvent,
  type TrafficSource,
} from "@/lib/traffic";

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
    const trackCurrentPage = (trafficEvent: TrafficEvent) => {
      const path = normalizeTrafficPath(window.location.pathname);
      acquisitionSource.current ??= classifyTrafficSource(document.referrer, window.location.hostname);
      if (path) sendTrafficEvent(trafficEvent, path, acquisitionSource.current);
    };
    const trackLinkClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (isEvaluationDestination(anchor.href, window.location.origin)) {
        trackCurrentPage("evaluation_cta_click");
        return;
      }
      if (
        anchor.dataset.trafficEvent === "guide_continuation_click"
        && isGuideContinuationDestination(anchor.href, window.location.origin)
      ) {
        trackCurrentPage("guide_continuation_click");
      }
    };
    const trackEvaluationSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!isEvaluationDestination(form.action, window.location.origin)) return;
      trackCurrentPage("evaluation_cta_click");
    };
    document.addEventListener("click", trackLinkClick, { capture: true });
    document.addEventListener("submit", trackEvaluationSubmit, { capture: true });
    return () => {
      document.removeEventListener("click", trackLinkClick, { capture: true });
      document.removeEventListener("submit", trackEvaluationSubmit, { capture: true });
    };
  }, []);

  return null;
}
