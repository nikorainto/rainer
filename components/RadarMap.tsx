"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { RainBand } from "@/lib/types";
import "leaflet/dist/leaflet.css";

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
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ · Places &copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a>"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
      />
      <RadarTiles url={tileUrl} frozen={frozen} />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        opacity={0.85}
        zIndex={400}
      />
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
        </>
      ) : null}
    </MapContainer>
  );
}

function RadarTiles({ url, frozen }: { url: string | null; frozen: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

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
        attribution: 'Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>',
      });
      layerRef.current.addTo(map);
    } else {
      layerRef.current.setUrl(url);
    }
    const container = layerRef.current.getContainer();
    if (container) container.style.filter = frozen ? "blur(2px)" : "";
  }, [frozen, map, url]);

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
      const bottom = wide ? 28 : Math.round(map.getSize().y * 0.46);
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
