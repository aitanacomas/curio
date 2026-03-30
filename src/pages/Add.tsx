import { useState, useRef } from 'react';
import { ArrowLeft, Camera, Sparkles, Check, MapPin, X, Heart, MessageCircle, Send, Pencil, Loader2 } from 'lucide-react';
import type { Category } from '../types';
import { supabase, getPublicUrl } from '../lib/supabase';

type Step = 'upload' | 'places' | 'caption' | 'done';
type Visibility = 'map' | 'profile' | 'feed';

interface IdentifiedPlace {
  id: string;
  photo: string;
  name: string;
  category: Category | '';
  city: string;
  country: string;
  analyzing: boolean;
  expanded: boolean;
}

type MockPlace = { name: string; category: Category; city: string; country: string };

const MOCK_PLACES: MockPlace[] = [
  { name: 'Café de Flore', category: 'cafe', city: 'Paris', country: 'France' },
  { name: 'Tsukiji Outer Market', category: 'experience', city: 'Tokyo', country: 'Japan' },
  { name: 'Mercado de San Miguel', category: 'experience', city: 'Madrid', country: 'Spain' },
  { name: 'Tartine Manufactory', category: 'cafe', city: 'San Francisco', country: 'United States' },
  { name: 'Hoshinoya Tokyo', category: 'hotel', city: 'Tokyo', country: 'Japan' },
  { name: 'Contramar', category: 'restaurant', city: 'Mexico City', country: 'Mexico' },
  { name: 'Bar Marsella', category: 'bar', city: 'Barcelona', country: 'Spain' },
  { name: 'Daikanyama T-Site', category: 'shop', city: 'Tokyo', country: 'Japan' },
  { name: 'Pujol', category: 'restaurant', city: 'Mexico City', country: 'Mexico' },
  { name: 'Condesa DF', category: 'hotel', city: 'Mexico City', country: 'Mexico' },
];

const categories: { id: Category; label: string; emoji: string }[] = [
  { id: 'cafe', label: 'Café', emoji: '☕' },
  { id: 'restaurant', label: 'Food', emoji: '🍽' },
  { id: 'hotel', label: 'Stay', emoji: '🏨' },
  { id: 'experience', label: 'Experience', emoji: '🎭' },
  { id: 'attraction', label: 'Attraction', emoji: '🗺' },
  { id: 'bar', label: 'Bar', emoji: '🍸' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'shop', label: 'Shop', emoji: '🛍' },
];

interface Props {
  userId: string;
  onComplete: (info: { visibility: Visibility; placesCount: number }) => void;
}

export default function Add({ userId, onComplete }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [places, setPlaces] = useState<IdentifiedPlace[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('feed');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [extraHashtags, setExtraHashtags] = useState<string[]>([]);
  const [extraTagInput, setExtraTagInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);
  const carouselStartX = useRef(0);
  const carouselDragging = useRef(false);

  const analyzeEntries = (entries: IdentifiedPlace[]) => {
    entries.forEach((entry, i) => {
      setTimeout(() => {
        const mock = MOCK_PLACES[Math.floor(Math.random() * MOCK_PLACES.length)];
        setPlaces(prev => prev.map(p =>
          p.id === entry.id ? { ...p, ...mock, analyzing: false } : p
        ));
      }, 1000 + i * 700);
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const entries: IdentifiedPlace[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      photo: URL.createObjectURL(f),
      name: '', category: '', city: '', country: '',
      analyzing: true, expanded: false,
    }));
    setPlaces(entries);
    setStep('places');
    e.target.value = '';
    analyzeEntries(entries);
  };

  const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const entries: IdentifiedPlace[] = files.map((f, i) => ({
      id: `${Date.now()}-add-${i}`,
      photo: URL.createObjectURL(f),
      name: '', category: '', city: '', country: '',
      analyzing: true, expanded: false,
    }));
    setPlaces(prev => [...prev, ...entries]);
    e.target.value = '';
    analyzeEntries(entries);
  };

  const removePlace = (id: string) => setPlaces(prev => prev.filter(p => p.id !== id));
  const updatePlace = (id: string, updates: Partial<IdentifiedPlace>) =>
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  const toggleExpanded = (id: string) =>
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, expanded: !p.expanded } : p));

  // ── Save post to Supabase ─────────────────────────────────────────
  const handlePost = async () => {
    // Demo users skip DB — just go straight to done step
    if (!userId || userId === 'demo-user') { setStep('done'); return; }

    setPosting(true);
    setPostError('');
    try {
      // 1. Upload each photo to storage
      const uploadedPlaces = await Promise.all(places.map(async (p, i) => {
        const blob = await fetch(p.photo).then(r => r.blob());
        const ext = blob.type.split('/')[1] ?? 'jpg';
        const path = `${userId}/${Date.now()}-${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('post-photos')
          .upload(path, blob, { upsert: true });
        if (uploadErr) throw uploadErr;
        return { ...p, photoUrl: getPublicUrl('post-photos', path) };
      }));

      // 2. Create post row
      const allHashtags = [
        ...places.map(p => p.name.replace(/\s+/g, '')),
        ...[...new Set(places.map(p => p.city).filter(Boolean))],
        ...extraHashtags,
      ];
      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({ user_id: userId, caption, visibility, hashtags: allHashtags, location_label: locationLabel })
        .select()
        .single();
      if (postErr) throw postErr;

      // 3. Create post_places rows
      const placesRows = uploadedPlaces.map((p, i) => ({
        post_id: post.id,
        name: p.name,
        category: p.category || null,
        city: p.city,
        country: p.country,
        photo_url: p.photoUrl,
        position: i,
      }));
      const { error: placesErr } = await supabase.from('post_places').insert(placesRows);
      if (placesErr) throw placesErr;

      setStep('done');
    } catch (err: any) {
      setPostError(err?.message ?? 'Something went wrong. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const primaryPlace = places[0];
  const uniqueCities = [...new Set(places.map(p => p.city).filter(Boolean))];
  const locationLabel = primaryPlace
    ? places.length === 1
      ? `${primaryPlace.name} · ${primaryPlace.city}`
      : uniqueCities.length > 1
        ? `${primaryPlace.name}, ${primaryPlace.city} +${places.length - 1}`
        : `${primaryPlace.name} +${places.length - 1} · ${primaryPlace.city}`
    : '';

  const visibilityOptions: { value: Visibility; label: string }[] = [
    { value: 'map', label: 'Private' },
    { value: 'profile', label: 'Followers' },
    { value: 'feed', label: 'Everyone' },
  ];

  // ── UPLOAD ───────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center px-4 pt-5 pb-3">
          <button onClick={() => onComplete({ visibility, placesCount: 0 })}>
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
        </div>
        <div className="px-4 mb-6">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">New post</h1>
          <p className="text-sm text-gray-400 mt-0.5">Upload photos — AI tags each place, you write one caption</p>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />

        <div className="px-4 flex-1 flex flex-col">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 active:bg-gray-100 transition-colors min-h-80"
          >
            <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Camera size={30} strokeWidth={1.5} className="text-gray-400" />
            </div>
            <div className="text-center px-8">
              <p className="font-bold text-gray-700 text-base">Select your photos</p>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                One photo per place — AI identifies each, you write the caption
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-4 py-2 rounded-full">
              Choose photos
            </span>
          </button>

          <div className="pb-12 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-300 font-medium">How it works</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-3">
              {[
                { icon: '📸', text: 'Upload one photo per place you visited' },
                { icon: '✨', text: 'AI identifies and tags each place' },
                { icon: '✏️', text: 'Write one caption — posts as a single story' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="text-base">{item.icon}</span>
                  <p className="text-sm text-gray-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PLACES (merged with analyzing) ───────────────────────────────
  if (step === 'places') {
    const anyAnalyzing = places.some(p => p.analyzing);
    const analyzingCount = places.filter(p => p.analyzing).length;

    if (places.length === 0) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
          <p className="text-gray-400 text-sm text-center">All places removed.</p>
          <button onClick={() => setStep('upload')} className="text-gray-900 font-semibold text-sm underline">
            Start over
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Hidden file inputs */}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
        <input ref={addMoreRef} type="file" accept="image/*" multiple onChange={handleAddMore} className="hidden" />

        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <button onClick={() => setStep('upload')} className="mb-3">
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {anyAnalyzing ? 'Identifying places' : `Found ${places.length} place${places.length !== 1 ? 's' : ''}`}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {anyAnalyzing
              ? `${analyzingCount} remaining…`
              : 'Tap the pencil to edit any place'}
          </p>
        </div>

        {/* Place list */}
        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-4 space-y-3">
          {places.map(p => (
            <div key={p.id} className="bg-gray-50 rounded-2xl overflow-hidden">
              {/* Compact row */}
              <div className="flex items-center gap-3 p-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={p.photo} alt="" className="w-full h-full object-cover" />
                  {p.analyzing ? (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Sparkles size={14} className="text-white animate-pulse" />
                    </div>
                  ) : (
                    <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {p.analyzing ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded-full w-3/4 animate-pulse" />
                      <div className="h-2.5 bg-gray-200 rounded-full w-1/2 animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="font-bold text-gray-900 text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />{p.city}, {p.country}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!p.analyzing && (
                    <button
                      onClick={() => toggleExpanded(p.id)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        p.expanded ? 'bg-gray-900' : 'bg-white shadow-sm'
                      }`}
                    >
                      <Pencil size={13} className={p.expanded ? 'text-white' : 'text-gray-500'} />
                    </button>
                  )}
                  <button
                    onClick={() => removePlace(p.id)}
                    className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center"
                  >
                    <X size={12} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Inline edit panel — slides open when pencil tapped */}
              {p.expanded && !p.analyzing && (
                <div className="border-t border-gray-100 bg-white px-3 pb-3 pt-3">
                  {/* Place name */}
                  <input
                    value={p.name}
                    onChange={e => updatePlace(p.id, { name: e.target.value })}
                    className="font-bold text-gray-900 text-sm w-full outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-gray-500 pb-0.5 mb-2 transition-colors"
                    placeholder="Place name"
                  />
                  {/* City, Country */}
                  <div className="flex items-center mb-3" style={{ gap: '4px' }}>
                    <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400 flex items-center" style={{ gap: 0 }}>
                      <input
                        value={p.city}
                        onChange={e => updatePlace(p.id, { city: e.target.value })}
                        className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                        style={{ width: `${Math.max(28, (p.city || 'City').length * 7.2)}px`, padding: 0, margin: 0 }}
                        placeholder="City"
                      /><span>,&nbsp;</span><input
                        value={p.country}
                        onChange={e => updatePlace(p.id, { country: e.target.value })}
                        className="outline-none bg-transparent text-xs text-gray-400 border-b border-dashed border-gray-200 focus:border-gray-400 transition-colors"
                        style={{ width: `${Math.max(40, (p.country || 'Country').length * 7.2)}px`, padding: 0, margin: 0 }}
                        placeholder="Country"
                      />
                    </span>
                  </div>
                  {/* Category chips */}
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => updatePlace(p.id, { category: cat.id })}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          p.category === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <span>{cat.emoji}</span><span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add more photos */}
          <button
            onClick={() => addMoreRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium active:bg-gray-50 transition-colors"
          >
            <Camera size={16} strokeWidth={1.5} />
            Add more photos
          </button>
        </div>

        {/* CTA */}
        <div className="px-4 pb-6 pt-3 border-t border-gray-100">
          <button
            onClick={() => setStep('caption')}
            disabled={anyAnalyzing}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all ${
              anyAnalyzing ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-slate-900 text-white'
            }`}
          >
            {anyAnalyzing ? 'Identifying places…' : 'Write your caption'}
          </button>
        </div>
      </div>
    );
  }

  // ── CAPTION ──────────────────────────────────────────────────────
  if (step === 'caption') {
    return (
      <div className="min-h-screen bg-white flex flex-col">

        {/* Live post preview */}
        <div>
          <div className="px-4 pt-4 pb-2">
            <button onClick={() => setStep('places')}><ArrowLeft className="w-6 h-6 text-slate-700" /></button>
          </div>

          <div className="border-y border-gray-100">
            {/* Post header */}
            <div className="flex items-start gap-3 px-4 pt-3 pb-2">
              <img src="/aitana-avatar.jpg" alt="" className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight">You</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1 truncate">
                  <MapPin size={10} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                  {locationLabel}
                </p>
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">Just now</p>
            </div>

            {/* Carousel */}
            {places.length > 0 && (
              <div
                className="relative overflow-hidden select-none"
                onPointerDown={e => { carouselStartX.current = e.clientX; carouselDragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                onPointerUp={e => {
                  if (!carouselDragging.current) return;
                  carouselDragging.current = false;
                  const delta = carouselStartX.current - e.clientX;
                  if (Math.abs(delta) > 40) setCarouselIndex(i => Math.max(0, Math.min(places.length - 1, i + (delta > 0 ? 1 : -1))));
                }}
                onPointerCancel={() => { carouselDragging.current = false; }}
              >
                <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                  {places.map(p => (
                    <img key={p.id} src={p.photo} alt="" draggable={false} className="w-full flex-shrink-0 aspect-[4/5] object-cover pointer-events-none" />
                  ))}
                </div>
                {places.length > 1 && (
                  <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                    {places.map((_, i) => (
                      <button key={i} onClick={() => setCarouselIndex(i)} className={`rounded-full transition-all duration-200 ${i === carouselIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
                    ))}
                  </div>
                )}
                {places[carouselIndex] && (
                  <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <MapPin size={8} className="text-white/80 flex-shrink-0" />
                    <span className="text-white text-[11px] font-semibold leading-none">{places[carouselIndex].name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions — icons grouped left, Save right, even vertical padding */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1.5">
                    <Heart size={22} strokeWidth={1.5} className="text-gray-700" />
                    <span className="text-xs text-gray-500">0</span>
                  </button>
                  <button className="flex items-center gap-1.5">
                    <MessageCircle size={22} strokeWidth={1.5} className="text-gray-700" />
                    <span className="text-xs text-gray-500">0</span>
                  </button>
                  <button><Send size={22} strokeWidth={1.5} className="text-gray-700" /></button>
                </div>
                <button className="px-5 py-1.5 rounded-full border border-gray-900 text-sm font-semibold text-gray-900">Save</button>
              </div>
            </div>

            {caption && (
              <div className="px-4 pb-4">
                <p className="text-sm text-gray-700 leading-snug line-clamp-2">{caption}</p>
              </div>
            )}
            {!caption && <div className="pb-3" />}
          </div>
        </div>

        {/* Caption / Hashtags / Privacy */}
        <div className="bg-white px-4 pt-6 pb-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Caption</p>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={places.length > 1
              ? `a ${places[0]?.city?.toLowerCase() ?? 'trip'} day done right…`
              : 'Write something about this place…'}
            rows={2}
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-900 outline-none placeholder-gray-300 focus:bg-gray-100 resize-none transition-colors leading-relaxed"
          />

          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-5">Hashtags</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-gray-50 rounded-2xl px-4 py-3">
            {places.map(p => (
              <span key={p.id} className="text-[12px] font-medium text-slate-400">#{p.name.replace(/\s+/g, '')}</span>
            ))}
            {[...new Set(places.map(p => p.city).filter(Boolean))].map(city => (
              <span key={city} className="text-[12px] font-medium text-slate-400">#{city.replace(/\s+/g, '')}</span>
            ))}
            {extraHashtags.filter(t => t.trim()).map(t => (
              <span key={t} className="text-[12px] font-medium text-slate-400">#{t.replace(/^#+/, '').replace(/\s+/g, '')}</span>
            ))}
            <input
              value={extraTagInput}
              onChange={e => setExtraTagInput(e.target.value)}
              onKeyDown={e => {
                if ((e.key === ' ' || e.key === 'Enter') && extraTagInput.trim()) {
                  e.preventDefault();
                  setExtraHashtags(prev => [...prev, extraTagInput.trim()]);
                  setExtraTagInput('');
                }
              }}
              placeholder="+ add"
              className="text-[12px] font-medium text-slate-500 bg-transparent outline-none placeholder-slate-300"
              style={{ width: `${Math.max(40, (extraTagInput.length + 5) * 7)}px` }}
            />
          </div>

          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-5">Privacy</p>
          <div className="flex gap-2">
            {visibilityOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setVisibility(opt.value)}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  visibility === opt.value ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {postError && (
            <p className="text-xs text-red-400 bg-red-50 rounded-xl px-4 py-3 mt-4">{postError}</p>
          )}
          <button
            onClick={handlePost}
            disabled={posting}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base mt-5 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {posting && <Loader2 size={18} className="animate-spin" />}
            {posting ? 'Posting…' : visibility === 'feed' ? 'Post to curio' : visibility === 'profile' ? 'Share with followers' : 'Save privately'}
          </button>
        </div>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 overflow-y-auto pt-5 pb-4">
        {/* Confirmation header */}
        <div className="flex items-center gap-2 mb-5 px-4">
          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
            <Check size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-black text-gray-900 tracking-tight">
              {visibility === 'feed' ? 'Posted to curio' : visibility === 'profile' ? 'Shared with followers' : 'Saved privately'}
            </p>
            <p className="text-xs text-gray-400">{places.length} place{places.length > 1 ? 's' : ''} tagged</p>
          </div>
        </div>

        {/* Post preview */}
        <div className="bg-white overflow-hidden border-y border-gray-100">
          {/* Post header */}
          <div className="flex items-start gap-3 px-4 pt-3 pb-2">
            <img src="/aitana-avatar.jpg" alt="" className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">You</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1 truncate">
                <MapPin size={10} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                {locationLabel}
              </p>
            </div>
            <p className="text-xs text-gray-400 flex-shrink-0">Just now</p>
          </div>

          {/* Carousel */}
          {places.length > 0 && (
            <div
              className="relative overflow-hidden select-none"
              onPointerDown={e => { carouselStartX.current = e.clientX; carouselDragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerUp={e => {
                if (!carouselDragging.current) return;
                carouselDragging.current = false;
                const delta = carouselStartX.current - e.clientX;
                if (Math.abs(delta) > 40) setCarouselIndex(i => Math.max(0, Math.min(places.length - 1, i + (delta > 0 ? 1 : -1))));
              }}
              onPointerCancel={() => { carouselDragging.current = false; }}
            >
              <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                {places.map(p => (
                  <img key={p.id} src={p.photo} alt="" draggable={false} className="w-full flex-shrink-0 aspect-[4/5] object-cover pointer-events-none" />
                ))}
              </div>
              {places.length > 1 && (
                <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                  {places.map((_, i) => (
                    <button key={i} onClick={() => setCarouselIndex(i)} className={`rounded-full transition-all duration-200 ${i === carouselIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
                  ))}
                </div>
              )}
              {places[carouselIndex] && (
                <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <MapPin size={8} className="text-white/80 flex-shrink-0" />
                  <span className="text-white text-[11px] font-semibold leading-none">{places[carouselIndex].name}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions — icons grouped left, Save right, even vertical padding */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1.5">
                  <Heart size={22} strokeWidth={1.5} className="text-gray-700" />
                  <span className="text-xs text-gray-500">0</span>
                </button>
                <button className="flex items-center gap-1.5">
                  <MessageCircle size={22} strokeWidth={1.5} className="text-gray-700" />
                  <span className="text-xs text-gray-500">0</span>
                </button>
                <button><Send size={22} strokeWidth={1.5} className="text-gray-700" /></button>
              </div>
              <button className="px-5 py-1.5 rounded-full border border-gray-900 text-sm font-semibold text-gray-900">Save</button>
            </div>
          </div>

          {/* Caption */}
          <div className="px-4 pb-1">
            {caption ? (
              <>
                <p className={`text-sm text-gray-700 leading-snug ${captionExpanded ? '' : 'line-clamp-2'}`}>{caption}</p>
                {!captionExpanded && (
                  <button onClick={() => setCaptionExpanded(true)} className="text-xs font-semibold text-gray-400 mt-1">
                    See more
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-300 italic">No caption</p>
            )}
          </div>

          {/* Hashtags */}
          <div className="px-4 pt-1 pb-4 flex flex-wrap gap-x-2 gap-y-0.5">
            {places.map(p => (
              <span key={p.id} className="text-[12px] font-medium text-slate-400">#{p.name.replace(/\s+/g, '')}</span>
            ))}
            {[...new Set(places.map(p => p.city).filter(Boolean))].map(city => (
              <span key={city} className="text-[12px] font-medium text-slate-400">#{city.replace(/\s+/g, '')}</span>
            ))}
            {extraHashtags.filter(t => t.trim()).map(t => (
              <span key={t} className="text-[12px] font-medium text-slate-400">#{t.replace(/^#+/, '').replace(/\s+/g, '')}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 pt-3 space-y-3 border-t border-gray-100">
        <button
          onClick={() => onComplete({ visibility, placesCount: places.length })}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-base"
        >
          Done
        </button>
        <button
          onClick={() => { setPlaces([]); setCaption(''); setVisibility('feed'); setCarouselIndex(0); setCaptionExpanded(false); setExtraHashtags([]); setExtraTagInput(''); setStep('upload'); }}
          className="w-full py-3 text-slate-500 text-sm font-medium"
        >
          Add another post
        </button>
      </div>
    </div>
  );
}
