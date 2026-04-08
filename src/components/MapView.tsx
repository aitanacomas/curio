import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createDotIcon = (selected = false) =>
  L.divIcon({
    html: `<div style="width:${selected ? 18 : 14}px;height:${selected ? 18 : 14}px;background:${selected ? '#ea580c' : '#F97316'};border:${selected ? '3px' : '2.5px'} solid white;border-radius:50%;box-shadow:0 2px 8px rgba(249,115,22,${selected ? '0.7' : '0.5'})"></div>`,
    className: '',
    iconSize: [selected ? 18 : 14, selected ? 18 : 14],
    iconAnchor: [selected ? 9 : 7, selected ? 9 : 7],
  });

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

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
    if (places.length === 1) {
      map.setView([places[0].lat, places[0].lng], 13, { animate: false });
    } else if (places.length > 1) {
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

function FitCity({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom, { animate: false }); }, [map, center, zoom]);
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

function MapReadyCallback({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMapReady(map); }, [map, onMapReady]);
  return null;
}

function BoundsListener({ onBoundsChange }: { onBoundsChange: (b: MapBounds) => void }) {
  const map = useMap();
  useEffect(() => {
    const emit = () => {
      const b = map.getBounds();
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    };
    map.on('moveend', emit);
    map.on('zoomend', emit);
    // Emit initial bounds after map is ready
    const t = setTimeout(emit, 100);
    return () => { map.off('moveend', emit); map.off('zoomend', emit); clearTimeout(t); };
  }, [map, onBoundsChange]);
  return null;
}

interface Props {
  places: MapPlace[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMapReady?: (map: L.Map) => void;
  hideZoomControls?: boolean;
  onPlaceClick?: (place: MapPlace) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  selectedId?: string;
  fitCity?: { center: [number, number]; zoom: number };
}

export default function MapView({ places, center = [20, 10], zoom = 2, height = '300px', onMapReady, hideZoomControls = false, onPlaceClick, onBoundsChange, selectedId, fitCity }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%', background: '#D5DADC', position: 'relative', borderRadius: 0 }}
      className="z-0"
      zoomControl={false}
      attributionControl={false}
      zoomSnap={0}
      maxBounds={[[-60, -220], [72, 220]]}
      maxBoundsViscosity={1.0}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" minZoom={5} />
      {places.length === 0 && !fitCity && <FitWorld />}
      {places.length === 0 && fitCity && <FitCity center={fitCity.center} zoom={fitCity.zoom} />}
      {places.length > 1 && <FitBounds places={places} />}
      {!hideZoomControls && <ZoomControls />}
      {onMapReady && <MapReadyCallback onMapReady={onMapReady} />}
      {onBoundsChange && <BoundsListener onBoundsChange={onBoundsChange} />}
      {places.map(place => {
        const selected = place.id === selectedId;
        return onPlaceClick ? (
          <Marker key={place.id} position={[place.lat, place.lng]} icon={createDotIcon(selected)}
            eventHandlers={{ click: () => onPlaceClick(place) }}
            zIndexOffset={selected ? 1000 : 0}
          />
        ) : (
          <Marker key={place.id} position={[place.lat, place.lng]} icon={createDotIcon(selected)}>
            <Popup>
              <div className="text-sm font-medium">{place.name.split(',')[0].trim()}</div>
              <div className="text-xs text-gray-500">{[(place.neighbourhood ?? place.neighborhood), place.city].filter(Boolean).join(', ') || place.country}</div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
