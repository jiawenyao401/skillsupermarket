"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const OrbitCanvas = dynamic(() => import("./SkillOrbitCanvas"), { ssr: false });

type OrbitPalette = {
  core: string;
  ice: string;
  lime: string;
  peach: string;
  line: string;
};

class OrbitErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <div className="home-orbit-fallback" aria-hidden="true"><span /></div> : this.props.children;
  }
}

export function SkillOrbit() {
  const root = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<OrbitPalette | null>(null);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setMotionAllowed(!motionQuery.matches);
    syncMotion();
    motionQuery.addEventListener("change", syncMotion);

    try {
      const probe = document.createElement("canvas");
      const context = probe.getContext("webgl2") || probe.getContext("webgl");
      if (!context) {
        motionQuery.removeEventListener("change", syncMotion);
        return;
      }
      const styles = getComputedStyle(node);
      setPalette({
        core: styles.getPropertyValue("--home-orbit-core").trim(),
        ice: styles.getPropertyValue("--home-orbit-ice").trim(),
        lime: styles.getPropertyValue("--home-orbit-lime").trim(),
        peach: styles.getPropertyValue("--home-orbit-peach").trim(),
        line: styles.getPropertyValue("--home-orbit-line").trim(),
      });
      context.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      motionQuery.removeEventListener("change", syncMotion);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(node);
    const visual = node.closest(".home-visual");
    let hovering = false;
    let focusing = false;
    const syncPause = () => setPaused(hovering || focusing);
    const enter = () => { hovering = true; syncPause(); };
    const leave = () => { hovering = false; syncPause(); };
    const focusIn = () => { focusing = true; syncPause(); };
    const focusOut = (event: Event) => {
      if (visual?.contains((event as FocusEvent).relatedTarget as Node | null)) return;
      focusing = false;
      syncPause();
    };
    visual?.addEventListener("pointerenter", enter);
    visual?.addEventListener("pointerleave", leave);
    visual?.addEventListener("focusin", focusIn);
    visual?.addEventListener("focusout", focusOut);
    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", syncMotion);
      visual?.removeEventListener("pointerenter", enter);
      visual?.removeEventListener("pointerleave", leave);
      visual?.removeEventListener("focusin", focusIn);
      visual?.removeEventListener("focusout", focusOut);
    };
  }, []);

  return (
    <div ref={root} className="home-orbit" aria-hidden="true">
      {visible && motionAllowed && palette ? (
        <OrbitErrorBoundary><OrbitCanvas palette={palette} paused={paused} /></OrbitErrorBoundary>
      ) : (
        <div className="home-orbit-fallback"><span /></div>
      )}
    </div>
  );
}
