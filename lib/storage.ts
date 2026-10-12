import { isLatLon } from "@/lib/coords";

export type Pin = {
  name: string;
  lat: number;
  lon: number;
};

const LAST_KEY = "rainer:last";
const SOUND_KEY = "rainer:sound";
const COORDS_KEY = "rainer:coords";

export function loadLastPin(): Pin | null {
  const parsed = readJson<unknown>(LAST_KEY);
  return isPin(parsed) ? parsed : null;
}

export function saveLastPin(pin: Pin) {
  writeJson(LAST_KEY, { name: pin.name, lat: pin.lat, lon: pin.lon });
}

export function loadSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_KEY) !== "0";
}

export function saveSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
}

export function loadShowCoordinates(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COORDS_KEY) === "1";
}

export function saveShowCoordinates(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COORDS_KEY, enabled ? "1" : "0");
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private mode or a full quota should not break the nowcast. */
  }
}

function isPin(value: unknown): value is Pin {
  if (!value || typeof value !== "object") return false;
  const pin = value as Pin;
  return (
    typeof pin.name === "string" &&
    pin.name.trim().length > 0 &&
    pin.name.length <= 160 &&
    isLatLon(pin.lat, pin.lon)
  );
}
