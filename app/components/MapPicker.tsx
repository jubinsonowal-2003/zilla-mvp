"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon paths broken by Next.js bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

/** Inner component: listens for map clicks and moves the pin */
function ClickHandler({
  onLocationChange,
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({ lat, lng, onLocationChange }: MapPickerProps) {
  // Default center: India
  const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : [20.5937, 78.9629];
  const zoom = lat !== null ? 14 : 5;

  const mapRef = useRef<L.Map | null>(null);

  // When lat/lng change externally (e.g. geolocation), fly map to new location
  useEffect(() => {
    if (mapRef.current && lat !== null && lng !== null) {
      mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
    }
  }, [lat, lng]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
      className="z-0"
      ref={mapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onLocationChange={onLocationChange} />
      {lat !== null && lng !== null && <Marker position={[lat, lng]} />}
    </MapContainer>
  );
}
