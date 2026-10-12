"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, LocateFixed, Search, Volume2, VolumeX } from "lucide-react";
import { parseCoordinates } from "@/lib/coords";
import type { Pin } from "@/lib/storage";

const iconButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-panel/95 text-ink hover:border-dry/70";

type SearchHit = Pin;

export function LocationBar({
  onPin,
  onLocate,
  locating,
  soundOn,
  onToggleSound,
}: {
  onPin: (pin: Pin) => void;
  onLocate: () => void;
  locating: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [remote, setRemote] = useState<{ query: string; hits: SearchHit[]; error: string | null }>({
    query: "",
    hits: [],
    error: null,
  });
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();
  const parsed = parseCoordinates(query);
  const coordinateHit: SearchHit[] = parsed
    ? [{ name: `${parsed.lat.toFixed(4)}, ${parsed.lon.toFixed(4)}`, ...parsed }]
    : [];
  const remoteReady = remote.query === trimmed;
  const hits = parsed ? coordinateHit : remoteReady ? remote.hits : [];
  const searchError = !parsed && remoteReady ? remote.error : null;
  const searching = !parsed && trimmed.length >= 3 && !remoteReady;
  const open = focused && trimmed.length >= 3;

  useEffect(() => {
    if (parseCoordinates(query) || query.trim().length < 3) return;
    const trimmedQuery = query.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const json = (await response.json()) as {
          ok: boolean;
          results?: SearchHit[];
          error?: string;
        };
        if (controller.signal.aborted) return;
        if (!json.ok) {
          setRemote({ query: trimmedQuery, hits: [], error: json.error || "Search failed" });
          return;
        }
        setRemote({ query: trimmedQuery, hits: json.results ?? [], error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRemote({
          query: trimmedQuery,
          hits: [],
          error: error instanceof Error ? error.message : "Search failed",
        });
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setFocused(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  function choose(hit: SearchHit) {
    onPin({ name: hit.name, lat: hit.lat, lon: hit.lon });
    setQuery(hit.name);
    setFocused(false);
  }

  return (
    <div ref={boxRef} className="relative flex w-full items-center gap-2">
      <form
        className="relative flex min-w-0 flex-1 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseCoordinates(query);
          if (parsed) {
            choose({
              name: `${parsed.lat.toFixed(4)}, ${parsed.lon.toFixed(4)}`,
              ...parsed,
            });
            return;
          }
          if (hits[0]) choose(hits[0]);
        }}
      >
        <label className="sr-only" htmlFor="place-search">
          Search for a place or coordinates
        </label>
        <input
          id="place-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          placeholder="Place or 60.17, 24.94"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel/95 pr-12 pl-3 text-sm text-ink outline-none placeholder:text-muted focus:border-dry/70"
        />
        <button
          type="submit"
          className="absolute top-0 right-0 h-11 w-11 text-muted"
          aria-label="Search"
        >
          <Search className="mx-auto" size={18} />
        </button>
        {open ? (
          <div
            id={listId}
            role="listbox"
            className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-panel py-1 shadow-xl"
          >
            {searching ? <div className="px-3 py-2 text-xs text-muted">Searching…</div> : null}
            {searchError ? <div className="px-3 py-2 text-xs text-storm">{searchError}</div> : null}
            {hits.map((hit) => (
              <button
                key={`${hit.lat},${hit.lon},${hit.name}`}
                type="button"
                role="option"
                aria-selected={false}
                className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-white/5"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(hit)}
              >
                {hit.name}
              </button>
            ))}
            {!searching && !searchError && hits.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted">No matches</div>
            ) : null}
          </div>
        ) : null}
      </form>
      <button
        type="button"
        onClick={onLocate}
        className={iconButton}
        aria-label="Use current location"
      >
        {locating ? <Loader2 className="animate-spin" size={18} /> : <LocateFixed size={18} />}
      </button>
      <button
        type="button"
        onClick={onToggleSound}
        className={iconButton}
        aria-pressed={soundOn}
        aria-label={soundOn ? "Mute alert sounds" : "Enable alert sounds"}
      >
        {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
    </div>
  );
}
