"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

export function HomeLiquidStage({ children }: { children: ReactNode }) {
  const frame = useRef<number | null>(null);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      stage.style.setProperty("--liquid-x", `${x}%`);
      stage.style.setProperty("--liquid-y", `${y}%`);
      frame.current = null;
    });
  }

  function reset(event: PointerEvent<HTMLDivElement>) {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    event.currentTarget.style.removeProperty("--liquid-x");
    event.currentTarget.style.removeProperty("--liquid-y");
  }

  return (
    <div className="home-liquid-stage" onPointerMove={move} onPointerLeave={reset}>
      <div className="home-liquid-mass" aria-hidden="true">
        <span className="home-liquid-drop home-liquid-drop-one" />
        <span className="home-liquid-drop home-liquid-drop-two" />
        <span className="home-liquid-drop home-liquid-drop-three" />
      </div>
      {children}
    </div>
  );
}
