"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon paths broken by webpack/Next.js bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/** Inner helper that re-centers the map when coordinates change */
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15, { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface RoomDetailMapProps {
  lat: number;
  lng: number;
}

export default function RoomDetailMap({ lat, lng }: RoomDetailMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap lat={lat} lng={lng} />
      <Marker position={[lat, lng]} />
    </MapContainer>
  );
}
