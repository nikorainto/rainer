"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { formatKmh } from "@/lib/format";
import type { RainBand } from "@/lib/types";
import type { WindReading } from "@/lib/wind";
import "leaflet/dist/leaflet.css";

const BASE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const LABEL_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";

type PriorityTileOptions = L.TileLayerOptions & { fetchPriority?: "high" | "low" };

/** One tile class so basemap and labels can take different fetch priorities. */
const PriorityTiles = L.TileLayer.extend({
  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement("img");
    const priority = (this.options as PriorityTileOptions).fetchPriority;
    tile.alt = "";
    if (priority) tile.fetchPriority = priority;
    // A cached image can finish during createTile, before Leaflet stores the tile.
    const finish = (error?: Error) => queueMicrotask(() => done(error, tile));
    tile.addEventListener("load", () => finish());
    tile.addEventListener("error", () => finish(new Error("Map tile failed")));
    tile.src = this.getTileUrl(coords);
    return tile;
  },
}) as new (
  url: string,
  options?: PriorityTileOptions,
) => L.TileLayer;

/** Mainland Finland plus Åland, with a little sea around the edges. */
const FINLAND_BOUNDS: L.LatLngBoundsExpression = [
  [59.8, 20.2],
  [69.6, 31.2],
];

const BAND_COLOR: Record<RainBand, string> = {
  none: "#3ee0b0",
  drizzle: "#7ec8e3",
  steady: "#ffb020",
  heavy: "#ff5d4a",
};

type RadarMapProps = {
  lat: number;
  lon: number;
  hasPlace: boolean;
  tileUrl: string | null;
  /** Latest scan held in place, slightly soft, for times with no forecast image. */
  frozen: boolean;
  band: RainBand;
  alert: boolean;
  /** Where the wind is blowing. Bearing 0 is north. */
  wind: WindReading | null;
  follow: boolean;
  onPick: (lat: number, lon: number) => void;
};

export default function RadarMap({
  lat,
  lon,
  hasPlace,
  tileUrl,
  frozen,
  band,
  alert,
  wind,
  follow,
  onPick,
}: RadarMapProps) {
  return (
    <MapContainer
      center={hasPlace ? [lat, lon] : [64.8, 26]}
      zoom={hasPlace ? 9 : 5}
      minZoom={2}
      maxZoom={14}
      className="radar-map h-full w-full"
      zoomControl
      attributionControl={false}
    >
      <Basemap />
      <RadarTiles url={tileUrl} frozen={frozen} />
      <FlyTo lat={lat} lon={lon} hasPlace={hasPlace} follow={follow} />
      {hasPlace ? null : <FrameFinland />}
      <MapPick onPick={onPick} />
      <ResizeMap />
      {hasPlace ? (
        <>
          {alert ? (
            <CircleMarker
              center={[lat, lon]}
              radius={18}
              pathOptions={{
                color: "#ff5d4a",
                weight: 2,
                fillColor: "#ff5d4a",
                fillOpacity: 0.08,
              }}
            />
          ) : null}
          <CircleMarker
            center={[lat, lon]}
            radius={7}
            pathOptions={{
              color: "#f4f8fb",
              weight: 2,
              fillColor: alert ? "#ff5d4a" : BAND_COLOR[band],
              fillOpacity: 1,
            }}
          />
          {wind && !wind.calm ? <WindArrow lat={lat} lon={lon} wind={wind} /> : null}
        </>
      ) : null}
    </MapContainer>
  );
}

/** Arrowhead points where the wind is blowing. Bearing 0 is north. */
function windArrowMarkup(bearingDeg: number): string {
  const turn = ((bearingDeg % 360) + 360) % 360;
  return `<div class="wind-arrow-rotor" style="transform:rotate(${turn}deg)"><svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88" aria-hidden="true"><path d="M44 8 L54 22 H49 V34 H39 V22 H34 Z" fill="#e7f0f7" stroke="#061018" stroke-width="2" stroke-linejoin="round"/></svg></div>`;
}

function WindArrow({ lat, lon, wind }: { lat: number; lon: number; wind: WindReading }) {
  const label = `Wind from ${wind.from}, blowing ${wind.toward} at ${formatKmh(wind.speedKmh)} km/h`;
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "wind-arrow",
        iconSize: [88, 88],
        iconAnchor: [44, 44],
        html: windArrowMarkup(wind.bearingDeg),
      }),
    [wind.bearingDeg],
  );

  return (
    <Marker
      key={`${lat.toFixed(4)},${lon.toFixed(4)}`}
      position={[lat, lon]}
      icon={icon}
      interactive={false}
      keyboard={false}
      zIndexOffset={700}
      title={label}
    />
  );
}

function Basemap() {
  const map = useMap();

  useEffect(() => {
    const base = new PriorityTiles(BASE_TILES, { zIndex: 1, fetchPriority: "high" });
    const labels = new PriorityTiles(LABEL_TILES, {
      opacity: 0.85,
      zIndex: 400,
      fetchPriority: "low",
    });
    base.addTo(map);
    labels.addTo(map);
    return () => {
      base.remove();
      labels.remove();
    };
  }, [map]);

  return null;
}

function RadarTiles({ url, frozen }: { url: string | null; frozen: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  useEffect(() => {
    if (!url) {
      layerRef.current?.remove();
      layerRef.current = null;
      return;
    }
    if (!layerRef.current) {
      layerRef.current = L.tileLayer(url, {
        opacity: 0.78,
        maxNativeZoom: 7,
        maxZoom: 14,
        zIndex: 250,
      }).addTo(map);
    } else {
      layerRef.current.setUrl(url);
    }
    const container = layerRef.current.getContainer();
    if (container) container.style.filter = frozenRef.current ? "blur(2px)" : "";
  }, [map, url]);

  useEffect(() => {
    const container = layerRef.current?.getContainer();
    if (!container) return;
    container.style.filter = frozen ? "blur(2px)" : "";
  }, [frozen]);

  useEffect(() => {
    return () => {
      layerRef.current?.remove();
      layerRef.current = null;
    };
  }, []);

  return null;
}

function FlyTo({
  lat,
  lon,
  hasPlace,
  follow,
}: {
  lat: number;
  lon: number;
  hasPlace: boolean;
  follow: boolean;
}) {
  const map = useMap();
  const placed = useRef(false);

  useEffect(() => {
    if (!hasPlace) return;
    const zoom = Math.max(map.getZoom(), 9);
    if (!follow) {
      if (map.getZoom() < 9) map.flyTo([lat, lon], 9, { duration: 0.45 });
      return;
    }
    if (!placed.current) {
      placed.current = true;
      map.setView([lat, lon], zoom, { animate: false });
      return;
    }
    map.flyTo([lat, lon], zoom, { duration: 0.6 });
  }, [follow, hasPlace, lat, lon, map]);

  return null;
}

function FrameFinland() {
  const map = useMap();
  const framed = useRef(false);

  useEffect(() => {
    const apply = () => {
      if (framed.current || map.getSize().y < 80) return;
      framed.current = true;
      const wide = map.getSize().x >= 1024;
      const bottom = wide ? 28 : 200;
      map.fitBounds(FINLAND_BOUNDS, {
        paddingTopLeft: [28, 88],
        paddingBottomRight: [28, bottom],
        animate: false,
      });
    };
    apply();
    map.on("resize", apply);
    return () => {
      map.off("resize", apply);
    };
  }, [map]);

  return null;
}

function MapPick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}
