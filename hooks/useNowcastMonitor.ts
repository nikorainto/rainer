"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLEARED_ALERT, IMMEDIATE_ALERT } from "@/lib/alerts";
import { POLL_MS } from "@/lib/constants";
import { playAlert } from "@/lib/sound";
import type { NowcastOk, NowcastResponse } from "@/lib/types";

export type ActiveAlert = {
  type: "immediate" | "clear";
  message: string;
};

const THREAT_KEY = "rainer:threat";

export function useNowcastMonitor(lat: number | null, lon: number | null) {
  const [data, setData] = useState<NowcastOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<ActiveAlert | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const alertType = useRef<ActiveAlert["type"] | null>(null);
  const dismissed = useRef<ActiveAlert["type"] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchedAtRef = useRef(0);
  const seenEpoch = useRef(0);
  const placeKey = lat == null || lon == null ? null : `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const [trackedKey, setTrackedKey] = useState(placeKey);
  const [epoch, setEpoch] = useState(0);

  if (trackedKey !== placeKey) {
    setTrackedKey(placeKey);
    setData(null);
    setError(null);
    setAlert(null);
    setEpoch((value) => value + 1);
  }

  const raise = useCallback((next: ActiveAlert | null) => {
    const nextType = next?.type ?? null;
    if (nextType && dismissed.current === nextType) return;
    if (nextType === alertType.current) return;
    alertType.current = nextType;
    if (nextType) {
      dismissed.current = null;
      playAlert(nextType);
    }
    setAlert(next);
  }, []);

  const dismissAlert = useCallback(() => {
    dismissed.current = alertType.current;
    alertType.current = null;
    setAlert(null);
  }, []);

  const refresh = useCallback(async () => {
    if (lat == null || lon == null) return;
    const requestEpoch = epoch;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    await Promise.resolve();
    if (requestEpoch < seenEpoch.current) return;
    if (requestEpoch !== seenEpoch.current) {
      seenEpoch.current = requestEpoch;
      alertType.current = null;
      dismissed.current = null;
    }
    if (abortRef.current !== controller) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/nowcast?lat=${lat}&lon=${lon}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = (await response.json()) as NowcastResponse;
      if (!json.ok) throw new Error(json.error || "Radar request failed");

      if (seenEpoch.current !== requestEpoch) return;
      const threatKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      const threat = json.summary.willRainIn30 || json.summary.rainingNow;
      const previous = readThreat(threatKey);
      const dissipated = json.signals.dissipated || (previous === true && !threat);
      writeThreat(threatKey, threat);

      if (!json.signals.immediate && dismissed.current === "immediate") dismissed.current = null;
      if (!dissipated && dismissed.current === "clear") dismissed.current = null;

      setData(json);
      setError(null);
      const stamp = Date.now();
      fetchedAtRef.current = stamp;
      setFetchedAt(stamp);

      if (json.signals.immediate) {
        raise({ type: "immediate", message: IMMEDIATE_ALERT });
      } else if (dissipated) {
        raise({ type: "clear", message: CLEARED_ALERT });
      } else if (threat) {
        raise(null);
      }
    } catch (caught) {
      if (seenEpoch.current !== requestEpoch) return;
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Radar request failed");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, [lat, lon, raise, epoch]);

  useEffect(() => {
    if (lat == null || lon == null) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAtRef.current < 60_000) return;
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [lat, lon, refresh]);

  return { data, error, loading, alert, dismissAlert, fetchedAt, refresh };
}

function readThreat(placeKey: string): boolean | null {
  try {
    const raw = sessionStorage.getItem(THREAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { key?: string; threat?: boolean };
    if (parsed.key !== placeKey || typeof parsed.threat !== "boolean") return null;
    return parsed.threat;
  } catch {
    return null;
  }
}

function writeThreat(placeKey: string, threat: boolean) {
  try {
    sessionStorage.setItem(THREAT_KEY, JSON.stringify({ key: placeKey, threat }));
  } catch {
    /* Ignore quota failures. The in-memory reading still works. */
  }
}
