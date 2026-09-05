"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileAPI = {
  render: (element: HTMLElement, options: {
    sitekey: string; action: string; theme: string; size: string; language: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileAPI } }

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !container.current || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(container.current, {
      sitekey: siteKey, action: "registration", theme: "auto", size: "flexible", language: "zh-cn",
      callback: (token) => { setFailed(false); onToken(token); },
      "expired-callback": () => onToken(""),
      "error-callback": () => { onToken(""); setFailed(true); },
    });
    return () => { api.remove(id); onToken(""); };
  }, [ready, siteKey, onToken]);
  return (
    <div>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => { setFailed(true); onToken(""); }} />
      <div ref={container} className="min-h-[65px]" aria-label="人机验证" />
      {failed && <p role="alert" className="mt-2 text-sm text-destructive">人机验证加载失败，请检查网络后刷新页面。</p>}
    </div>
  );
}
