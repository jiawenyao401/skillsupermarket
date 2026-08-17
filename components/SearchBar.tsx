"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  initial?: string;
  size?: "default" | "large";
  autoFocusHint?: boolean;
}

export function SearchBar({ initial = "", size = "default", autoFocusHint = false }: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initial);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const queryString = params.toString();
    router.push(queryString ? `/search?${queryString}` : "/search");
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        "group relative flex items-center rounded-2xl border bg-card shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10",
        size === "large" ? "p-1.5 shadow-lg shadow-black/[0.06]" : "p-1"
      )}
    >
      <Search className={cn("absolute text-muted-foreground", size === "large" ? "left-5 h-5 w-5" : "left-3.5 h-4 w-4")} aria-hidden="true" />
      <label htmlFor="skill-search" className="sr-only">搜索 AI 技能</label>
      <input
        ref={inputRef}
        id="skill-search"
        type="search"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="搜索能力、工具或使用场景…"
        autoComplete="off"
        className={cn(
          "min-w-0 flex-1 appearance-none bg-transparent pr-10 text-foreground placeholder:text-muted-foreground/80 focus:outline-none [&::-webkit-search-cancel-button]:hidden",
          size === "large" ? "h-12 pl-12 text-[15px] sm:h-14 sm:text-base" : "h-10 pl-10 text-sm"
        )}
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            inputRef.current?.focus();
          }}
          className="absolute right-14 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:right-32"
          aria-label="清空搜索"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {autoFocusHint && !q && (
        <kbd className="absolute right-16 hidden rounded-md border bg-muted px-2 py-1 font-sans text-[11px] text-muted-foreground sm:block sm:right-32">⌘ K</kbd>
      )}
      <button
        type="submit"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-foreground font-semibold text-background transition-colors hover:bg-foreground/90",
          size === "large" ? "h-12 w-12 sm:h-14 sm:w-auto sm:px-5" : "h-10 w-10"
        )}
        aria-label="提交搜索"
      >
        <span className="hidden sm:inline">搜索</span>
        <ArrowRight className={cn("h-4 w-4", size === "large" && "sm:ml-2")} />
      </button>
    </form>
  );
}
