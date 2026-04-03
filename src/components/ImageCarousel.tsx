import { useState, useRef } from 'react';

interface Props {
  images: string[];
  labels?: string[];
  sublabels?: string[];
  scales?: number[];
  onClick?: () => void;
}

export default function ImageCarousel({ images, labels, sublabels, scales, onClick }: Props) {
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
              className="w-full object-cover pointer-events-none"
              style={{ aspectRatio: '3/4', ...(scales?.[i] ? { transform: `scale(${scales[i]})`, transformOrigin: 'center' } : {}) }}
            />
          </div>
        ))}
      </div>

      {/* Editorial gradient + place name */}
      {labels && labels[index] && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Bottom bar: place name left, dots right */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 flex items-end justify-between gap-3">
        {labels && labels[index] ? (
          <div className="min-w-0">
            <p className="text-white font-bold text-[15px] leading-tight truncate drop-shadow-sm">{labels[index]}</p>
            {sublabels && sublabels[index] && (
              <p className="text-white/80 text-xs mt-0.5 truncate drop-shadow-sm">{sublabels[index]}</p>
            )}
          </div>
        ) : <span />}
        <div className="flex items-center gap-1.5 flex-shrink-0 pb-0.5">
          {images.length > 1 && (
            images.length <= 5 ? (
              images.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); scrollTo(i); }}
                  className={`rounded-full transition-all duration-200 ${
                    i === index ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                  }`}
                />
              ))
            ) : (
              <span className="text-white text-[11px] font-semibold bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 leading-none">
                {index + 1} / {images.length}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
