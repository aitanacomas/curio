import { useState, useRef } from 'react';

interface Props {
  images: string[];
  labels?: string[];
  scales?: number[];
}

export default function ImageCarousel({ images, labels, scales }: Props) {
  const [index, setIndex] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const didSwipe = useRef(false);

  if (!images || images.length === 0) return null;

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(images.length - 1, i)));

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    isDragging.current = true;
    isHorizontal.current = null;
    didSwipe.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = Math.abs(e.clientX - startX.current);
    const dy = Math.abs(e.clientY - startY.current);
    if (isHorizontal.current === null && (dx > 5 || dy > 5)) {
      isHorizontal.current = dx > dy;
    }
    if (isHorizontal.current) {
      e.stopPropagation();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = startX.current - e.clientX;
    if (isHorizontal.current && Math.abs(delta) > 40) {
      didSwipe.current = true;
      e.stopPropagation();
      if (delta > 0) goTo(index + 1);
      else goTo(index - 1);
    }
    isHorizontal.current = null;
  };

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ touchAction: 'pan-y' }}
      onClick={(e) => { if (didSwipe.current) { didSwipe.current = false; e.stopPropagation(); } }}
    >
      {/* Slide strip */}
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)`, touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { isDragging.current = false; isHorizontal.current = null; }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            className="w-full flex-shrink-0 aspect-[4/5] object-cover pointer-events-none"
            style={scales?.[i] ? { transform: `scale(${scales[i]})`, transformOrigin: 'center' } : undefined}
          />
        ))}
      </div>

      {/* Place name label */}
      {labels && labels[index] && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
          <svg width="8" height="10" viewBox="0 0 8 10" fill="white" className="opacity-80 flex-shrink-0">
            <path d="M4 0C2.07 0 0.5 1.57 0.5 3.5c0 2.63 3.5 6.5 3.5 6.5s3.5-3.87 3.5-6.5C7.5 1.57 5.93 0 4 0zm0 4.75a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/>
          </svg>
          <span className="text-white text-[11px] font-semibold leading-none">{labels[index]}</span>
        </div>
      )}

      {/* Dots — bottom left */}
      <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-200 ${
              i === index ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
