import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const ALL_PINS = [
  { name: 'TOKYO',         label: 'TOKYO',         coords: [139.69,  35.68] as [number, number] },
  { name: 'LONDON',        label: 'LONDON',        coords: [ -0.13,  51.51] as [number, number] },
  { name: 'MIAMI',         label: 'MIAMI',         coords: [-80.19,  25.77] as [number, number] },
  { name: 'SAN FRANCISCO', label: 'SAN FRANCISCO', coords: [-122.42, 37.77] as [number, number] },
  { name: 'MEXICO CITY',   label: 'MEXICO CITY',   coords: [-99.13,  19.43] as [number, number] },
  { name: 'MADRID',        label: 'MADRID',        coords: [ -3.70,  40.42] as [number, number] },
  { name: 'PARIS',         label: 'PARIS',         coords: [  2.35,  48.85] as [number, number] },
  { name: 'NEW YORK',      label: 'NEW YORK',      coords: [-74.00,  40.71] as [number, number] },
  { name: 'SYDNEY',        label: 'SYDNEY',        coords: [151.21, -33.87] as [number, number] },
  { name: 'DUBAI',         label: 'DUBAI',         coords: [ 55.27,  25.20] as [number, number] },
  { name: 'BANGKOK',       label: 'BANGKOK',       coords: [100.52,  13.75] as [number, number] },
  { name: 'BUENOS AIRES',  label: 'BUENOS AIRES',  coords: [-58.38, -34.60] as [number, number] },
  { name: 'CAPE TOWN',     label: 'CAPE TOWN',     coords: [ 18.42, -33.93] as [number, number] },
  { name: 'AMSTERDAM',     label: 'AMSTERDAM',     coords: [  4.90,  52.37] as [number, number] },
  { name: 'LISBON',        label: 'LISBON',        coords: [ -9.14,  38.72] as [number, number] },
  { name: 'SEOUL',         label: 'SEOUL',         coords: [126.98,  37.57] as [number, number] },
];

type PinPhase = 'amber' | 'gray';

export default function WorldMapSplash() {
  // phase: 'amber' = freshly dropped, 'gray' = settled
  const [pins, setPins] = useState<Map<string, PinPhase>>(new Map());

  const addPin = (name: string) => {
    // Drop in amber
    setPins(prev => new Map([...prev, [name, 'amber']]));
    // Settle to gray after 1.4s
    setTimeout(() => {
      setPins(prev => {
        const next = new Map(prev);
        if (next.has(name)) next.set(name, 'gray');
        return next;
      });
    }, 1400);
    // Fade out after 4.5s
    setTimeout(() => {
      setPins(prev => {
        const next = new Map(prev);
        next.delete(name);
        return next;
      });
    }, 4500);
  };

  useEffect(() => {
    let idx = 0;

    // Seed 4 pins immediately
    ALL_PINS.slice(0, 4).forEach((pin, i) => {
      setTimeout(() => { addPin(pin.name); idx = 4; }, i * 350);
    });

    // Then loop continuously
    const loop = () => {
      const pin = ALL_PINS[idx % ALL_PINS.length];
      idx++;
      addPin(pin.name);
      setTimeout(loop, 950);
    };
    const t = setTimeout(loop, 4 * 350 + 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="map-drift" style={{ width: '100%', height: '100%' }}>
      <ComposableMap
        preserveAspectRatio="xMidYMid slice"
        projectionConfig={{ scale: 165, center: [10, 8] }}
        style={{ width: '100%', height: '100%', display: 'block', backgroundColor: '#ffffff' }}
      >
        <defs>
          <filter id="amber-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="1 0.4 0 0 0  0.5 0.3 0 0 0  0 0 0 0 0  0 0 0 0.7 0"
              result="colored" />
            <feMerge>
              <feMergeNode in="colored" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Land */}
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#e4dfd5"
                stroke="#f4f2ed"
                strokeWidth={0.8}
                style={{
                  default: { outline: 'none' },
                  hover:   { outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {ALL_PINS.map(pin => {
          const phase = pins.get(pin.name);
          const on = !!phase;
          const isAmber = phase === 'amber';

          const dotColor   = isAmber ? '#f59e0b' : '#94a3b8';
          const haloColor  = isAmber ? 'rgba(245,158,11,0.25)' : 'rgba(148,163,184,0.2)';
          const ringColor  = isAmber ? 'rgba(245,158,11,0.5)'  : 'rgba(148,163,184,0.35)';
          const labelColor = isAmber ? '#92400e' : '#64748b';

          return (
            <Marker key={pin.name} coordinates={pin.coords}>
              {/* Ripple on drop */}
              {isAmber && (
                <circle
                  r={14}
                  fill="none"
                  stroke="rgba(245,158,11,0.4)"
                  strokeWidth={1}
                  style={{
                    opacity: 0,
                    animation: on ? 'none' : undefined,
                    transition: 'r 0.9s ease-out, opacity 0.9s ease-out',
                  }}
                />
              )}

              {/* Outer halo */}
              <circle
                r={8}
                fill={haloColor}
                style={{
                  opacity: on ? 1 : 0,
                  transition: 'opacity 0.3s ease, fill 0.8s ease',
                }}
              />

              {/* Ring */}
              <circle
                r={5.5}
                fill="none"
                stroke={ringColor}
                strokeWidth={1}
                style={{
                  opacity: on ? 1 : 0,
                  transition: 'opacity 0.3s ease, stroke 0.8s ease',
                }}
              />

              {/* Dot */}
              <circle
                r={3}
                fill={dotColor}
                filter={isAmber ? 'url(#amber-glow)' : undefined}
                style={{
                  opacity: on ? 1 : 0,
                  transform: on ? 'translateY(0)' : 'translateY(-18px)',
                  transition: on
                    ? 'opacity 0.2s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1), fill 0.8s ease'
                    : 'opacity 0.5s ease',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  fill: dotColor,
                }}
              />

              {/* City label */}
              <text
                x={10}
                y={4}
                style={{
                  fontSize: '5px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 600,
                  fill: labelColor,
                  letterSpacing: '0.06em',
                  opacity: on ? 1 : 0,
                  transition: 'opacity 0.4s ease 0.2s, fill 0.8s ease',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {pin.label}
              </text>
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
}
