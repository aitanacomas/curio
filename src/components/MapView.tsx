import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createDotIcon = () =>
  L.divIcon({
    html: `<div style="width:14px;height:14px;background:#F97316;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(249,115,22,0.5)"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

interface MapPlace {
  id: string;
  lat: number;
  lng: number;
  name: string;
  neighbourhood?: string;
  neighborhood?: string;
  city: string;
  country: string;
}

function FitBounds({ places }: { places: MapPlace[] }) {
  const map = useMap();
  useEffect(() => {
    if (places.length > 1) {
      const bounds = L.latLngBounds(places.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  }, [map, places]);
  return null;
}

function FitWorld() {
  const map = useMap();
  useEffect(() => {
    const baseZoom = map.getBoundsZoom([[-58, -178], [72, 178]]);
    const zoom = baseZoom + Math.log2(1.1);
    const containerHeight = map.getSize().y;
    const southPt = map.project([-56, 0], zoom);
    const centerY = southPt.y - containerHeight / 2;
    const center = map.unproject([map.project([0, 0], zoom).x, centerY], zoom);
    map.setView([center.lat, 0], zoom, { animate: false });
    map.setMinZoom(zoom);
  }, [map]);
  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div
      style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <button
        onClick={() => map.zoomIn()}
        style={{
          width: 32, height: 32, borderRadius: 10, background: 'white',
          border: 'none', padding: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
          fontSize: 18, fontWeight: 300, color: '#374151', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="6" y1="0" x2="6" y2="12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="0" y1="6" x2="12" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      <button
        onClick={() => map.zoomOut()}
        style={{
          width: 32, height: 32, borderRadius: 10, background: 'white',
          border: 'none', padding: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="0" y1="6" x2="12" y2="6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

interface Props {
  places: MapPlace[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export default function MapView({ places, center = [20, 10], zoom = 2, height = '300px' }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%', background: '#D5DADC', position: 'relative' }}
      className="rounded-xl z-0"
      zoomControl={false}
      attributionControl={false}
      zoomSnap={0}
      maxBounds={[[-60, -220], [72, 220]]}
      maxBoundsViscosity={1.0}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" minZoom={5} />
      {places.length === 0 && <FitWorld />}
      {places.length > 1 && <FitBounds places={places} />}
      <ZoomControls />
      {places.map(place => (
        <Marker key={place.id} position={[place.lat, place.lng]} icon={createDotIcon()}>
          <Popup>
            <div className="text-sm font-medium">{place.name.split(',')[0].trim()}</div>
            <div className="text-xs text-gray-500">{[(place.neighbourhood ?? place.neighborhood), place.city].filter(Boolean).join(', ') || place.country}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
