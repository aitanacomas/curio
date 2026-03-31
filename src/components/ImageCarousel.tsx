import { useState, useRef } from 'react';

interface Props {
  images: string[];
  labels?: string[];
  scales?: number[];
  onClick?: () => void;
}

export default function ImageCarousel({ images, labels, scales, onClick }: Props) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!images || images.length === 0) return null;

  const handleScroll = () => {
    if (scrollRef.current) {
      const i = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
      setIndex(i);
    }
  };

  const scrollTo = (i: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: i * scrollRef.current.offsetWidth, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative overflow-hidden select-none" onClick={onClick}>
      {/* Scroll strip — native CSS snap for reliable iOS swiping */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {images.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full snap-start">
            <img
              src={src}
              alt=""
              draggable={false}
              className="w-full aspect-[4/5] object-cover pointer-events-none"
              style={scales?.[i] ? { transform: `scale(${scales[i]})`, transformOrigin: 'center' } : undefined}
            />
          </div>
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

      {/* Dots */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); scrollTo(i); }}
              className={`rounded-full transition-all duration-200 ${
                i === index ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
