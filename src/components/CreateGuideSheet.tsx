import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { X, ArrowLeft, MapPin, Search, Check, Loader2, Camera, Plus, Mic, Square, Play, Pause } from 'lucide-react';
import type { Guide } from '../lib/supabase';
import { createGuide, updateGuide, supabase } from '../lib/supabase';
import { googleTypesToCategory, extractNeighborhood } from '../lib/placeUtils';

const MapView = lazy(() => import('./MapView'));

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;

const FEATURED_CITIES = [
  'London', 'Los Angeles', 'Madrid', 'New York', 'Paris',
  'Adelaide', 'Amsterdam', 'Bali', 'Barcelona', 'Berlin',
  'CDMX', 'Copenhagen', 'Dubai', 'Hamburg', 'Lisbon',
  'Melbourne', 'Miami', 'Milan', 'Montreal', 'Munich',
  'Rio de Janeiro', 'San Francisco', 'São Paulo', 'Seoul', 'Singapore',
  'Stockholm', 'Sydney', 'Tokyo', 'Toronto', 'Zurich',
];

const CITY_COORDS: Record<string, [number, number]> = {
  'London': [51.5074, -0.1278], 'Los Angeles': [34.0522, -118.2437], 'Madrid': [40.4168, -3.7038],
  'New York': [40.7128, -74.0060], 'Paris': [48.8566, 2.3522], 'Adelaide': [-34.9285, 138.6007],
  'Amsterdam': [52.3676, 4.9041], 'Bali': [-8.3405, 115.0920], 'Barcelona': [41.3851, 2.1734],
  'Berlin': [52.5200, 13.4050], 'CDMX': [19.4326, -99.1332], 'Copenhagen': [55.6761, 12.5683],
  'Dubai': [25.2048, 55.2708], 'Hamburg': [53.5511, 9.9937], 'Lisbon': [38.7169, -9.1399],
  'Melbourne': [-37.8136, 144.9631], 'Miami': [25.7617, -80.1918], 'Milan': [45.4654, 9.1859],
  'Montreal': [45.5017, -73.5673], 'Munich': [48.1351, 11.5820], 'Rio de Janeiro': [-22.9068, -43.1729],
  'San Francisco': [37.7749, -122.4194], 'São Paulo': [-23.5505, -46.6333], 'Seoul': [37.5665, 126.9780],
  'Singapore': [1.3521, 103.8198], 'Stockholm': [59.3293, 18.0686], 'Sydney': [-33.8688, 151.2093],
  'Tokyo': [35.6762, 139.6503], 'Toronto': [43.6532, -79.3832], 'Zurich': [47.3769, 8.5417],
};

interface PlaceResult {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  category: string;
  photoUrl: string;
  lat: number | null;
  lng: number | null;
}

interface AddedPlace {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  category: string;
  photoUrl: string;      // primary (first) photo
  photoUrls: string[];   // all uploaded photos (carousel)
  lat: number | null;
  lng: number | null;
  description: string;
  audioUrl?: string;     // uploaded voice memo URL
}

// ── Mini "add place" form state ───────────────────────────────────────────────
interface DraftPlace {
  photoUrls: string[];    // blob URLs for preview
  photoFiles: File[];     // actual files to upload on confirm
  locationQuery: string;
  locationResults: PlaceResult[];
  searchingLocation: boolean;
  selectedLocation: PlaceResult | null;
  description: string;
  audioBlob: Blob | null;
  audioPreviewUrl: string; // blob URL for playback
}

const emptyDraft = (): DraftPlace => ({
  photoUrls: [], photoFiles: [],
  locationQuery: '', locationResults: [], searchingLocation: false,
  selectedLocation: null, description: '',
  audioBlob: null, audioPreviewUrl: '',
});

interface Props {
  userId: string;
  onClose: () => void;
  onCreated: (guide: Guide) => void;
  onUpdated?: (guide: Guide) => void;
  editingGuide?: Guide;
}

export default function CreateGuideSheet({ userId, onClose, onCreated, onUpdated, editingGuide }: Props) {
  // Step 1
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCity, setSelectedCity] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  // Step 2
  const [addedPlaces, setAddedPlaces] = useState<AddedPlace[]>([]);

  // Pre-populate when editing
  useEffect(() => {
    if (!editingGuide) return;
    setTitle(editingGuide.title);
    setSelectedCity(editingGuide.destination ?? '');
    setDescription(editingGuide.description ?? '');
    setCoverUrl(editingGuide.coverUrl ?? '');
    setCoverPreview(editingGuide.coverUrl ?? '');
    if (editingGuide.places && editingGuide.places.length > 0) {
      setAddedPlaces(editingGuide.places.map((p: any) => ({
        id: p.id,
        name: p.name,
        neighborhood: p.neighborhood ?? '',
        city: p.city ?? '',
        category: p.category ?? '',
        photoUrl: p.photoUrl ?? '',
        photoUrls: p.photoUrls ?? (p.photoUrl ? [p.photoUrl] : []),
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        description: p.description ?? '',
        audioUrl: p.audioUrl,
      })));
    }
  }, [editingGuide]);
  const [showDraft, setShowDraft] = useState(false);
  const [draft, setDraft] = useState<DraftPlace>(emptyDraft());
  const [confirmingDraft, setConfirmingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  const coverInputRef = useRef<HTMLInputElement>(null);
  const draftPhotoRef = useRef<HTMLInputElement>(null);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Debounced location search inside draft
  useEffect(() => {
    if (!draft.locationQuery.trim()) {
      setDraft(d => ({ ...d, locationResults: [] }));
      return;
    }
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    locationDebounceRef.current = setTimeout(() => searchLocation(draft.locationQuery.trim()), 400);
    return () => { if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current); };
  }, [draft.locationQuery, selectedCity]);

  const searchLocation = async (query: string) => {
    if (!GOOGLE_PLACES_KEY) return;
    setDraft(d => ({ ...d, searchingLocation: true }));
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.types,places.addressComponents,places.location',
        },
        body: JSON.stringify({ textQuery: `${query} in ${selectedCity}`, maxResultCount: 5 }),
      });
      const data = await res.json();
      const results: PlaceResult[] = (data.places ?? []).map((p: any) => {
        const comps: any[] = p.addressComponents ?? [];
        const find = (...types: string[]) => {
          const c = comps.find((c: any) => types.some(t => c.types?.includes(t)));
          return c ? (c.longText || c.shortText || '') : '';
        };
        const city = find('postal_town') || find('locality') || find('administrative_area_level_2') || selectedCity;
        const neighborhood = extractNeighborhood(comps, '', city);
        const category = googleTypesToCategory(p.types ?? []);
        const photo = p.photos?.[0];
        const photoUrl = photo
          ? `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&key=${GOOGLE_PLACES_KEY}`
          : '';
        return { id: p.id, name: p.displayName?.text ?? '', neighborhood, city, category, photoUrl, lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null };
      });
      setDraft(d => ({ ...d, locationResults: results, searchingLocation: false }));
    } catch {
      setDraft(d => ({ ...d, locationResults: [], searchingLocation: false }));
    }
  };

  const uploadPhoto = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('post-photos').upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('post-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    setPublishError('');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const url = await uploadPhoto(file, `guide-covers/${userId}/${Date.now()}.${ext}`);
    if (url) { setCoverUrl(url); setCoverPreview(URL.createObjectURL(file)); }
    else setPublishError('Cover upload failed. Please try again.');
    setUploadingCover(false);
  };

  const handleDraftPhotoAdd = (file: File) => {
    setDraft(d => ({
      ...d,
      photoFiles: [...d.photoFiles, file],
      photoUrls: [...d.photoUrls, URL.createObjectURL(file)],
    }));
  };

  const removeDraftPhoto = (index: number) => {
    setDraft(d => ({
      ...d,
      photoFiles: d.photoFiles.filter((_, i) => i !== index),
      photoUrls: d.photoUrls.filter((_, i) => i !== index),
    }));
  };

  const canConfirmDraft = !!draft.selectedLocation;

  const confirmDraft = async () => {
    if (!draft.selectedLocation) return;
    setConfirmingDraft(true);

    // Upload all photos
    const uploadedUrls: string[] = [];
    for (let i = 0; i < draft.photoFiles.length; i++) {
      const file = draft.photoFiles[i];
      const ext = file.name.split('.').pop() ?? 'jpg';
      const uploaded = await uploadPhoto(file, `guide-place-photos/${userId}/${Date.now()}-${i}.${ext}`);
      uploadedUrls.push(uploaded ?? URL.createObjectURL(file));
    }

    // Fallback to Google Places photo if no user photos
    const primaryPhoto = uploadedUrls[0] ?? draft.selectedLocation.photoUrl;
    const allPhotos = uploadedUrls.length > 0 ? uploadedUrls : (draft.selectedLocation.photoUrl ? [draft.selectedLocation.photoUrl] : []);

    // Upload voice memo if present
    let audioUrl: string | undefined;
    if (draft.audioBlob) {
      const audioFile = new File([draft.audioBlob], 'voice-memo.webm', { type: 'audio/webm' });
      const uploaded = await uploadPhoto(audioFile, `guide-place-audio/${userId}/${Date.now()}.webm`);
      if (uploaded) audioUrl = uploaded;
    }

    const place: AddedPlace = {
      id: draft.selectedLocation.id,
      name: draft.selectedLocation.name,
      neighborhood: draft.selectedLocation.neighborhood,
      city: draft.selectedLocation.city,
      category: draft.selectedLocation.category,
      photoUrl: primaryPhoto,
      photoUrls: allPhotos,
      lat: draft.selectedLocation.lat,
      lng: draft.selectedLocation.lng,
      description: draft.description,
      audioUrl,
    };
    setAddedPlaces(prev => [...prev.filter(p => p.id !== place.id), place]);
    setDraft(emptyDraft());
    setShowDraft(false);
    setConfirmingDraft(false);
  };

  const removePlace = (id: string) => setAddedPlaces(prev => prev.filter(p => p.id !== id));

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError('');
    try {
      const finalCover = coverUrl || addedPlaces[0]?.photoUrl || undefined;
      const placesPayload = addedPlaces.map(p => ({
        id: p.id, name: p.name, category: p.category,
        neighborhood: p.neighborhood, city: p.city,
        photoUrl: p.photoUrl, photoUrls: p.photoUrls,
        description: p.description || '',
        audioUrl: p.audioUrl || undefined,
        lat: p.lat, lng: p.lng,
      }));

      if (editingGuide) {
        // Edit mode — update existing guide
        const ok = await updateGuide(editingGuide.id, {
          title, destination: selectedCity,
          description: description || undefined,
          coverUrl: finalCover,
          places: placesPayload,
        });
        if (ok) {
          onUpdated?.({
            ...editingGuide,
            title, destination: selectedCity,
            description: description || null,
            coverUrl: finalCover ?? null,
            places: placesPayload,
          });
        } else {
          setPublishError('Failed to save changes. Please try again.');
        }
      } else {
        // Create mode
        const guideId = await createGuide({
          userId, title, destination: selectedCity,
          description: description || undefined,
          coverUrl: finalCover,
          places: placesPayload,
        });
        if (guideId) {
          onCreated({
            id: guideId, userId, planId: null, title,
            destination: selectedCity, description: description || null,
            coverUrl: finalCover ?? null,
            publishedAt: new Date().toISOString(),
            places: placesPayload,
            profile: { name: '', username: '', avatarUrl: null },
          });
        } else {
          setPublishError('Failed to publish. Please run the database migration first.');
        }
      }
    } catch { setPublishError('Something went wrong. Please try again.'); }
    finally { setPublishing(false); }
  };

  const mapPlaces = addedPlaces
    .filter(p => p.lat != null && p.lng != null)
    .map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, name: p.name, city: p.city, country: '' }));
  const cityCenter = CITY_COORDS[selectedCity] ?? null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setDraft(d => ({ ...d, audioBlob: blob, audioPreviewUrl: url }));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch { /* mic permission denied */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const toggleAudioPlay = () => {
    const audio = audioPlayerRef.current;
    if (!audio) return;
    if (audioPlaying) { audio.pause(); setAudioPlaying(false); }
    else { audio.play(); setAudioPlaying(true); audio.onended = () => setAudioPlaying(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ maxWidth: 384, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* ── STEP 1: Guide details ── */}
        {step === 1 && (
          <>
            <div className="flex items-center gap-3 px-4 pt-2 pb-4 flex-shrink-0">
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                <ArrowLeft size={16} strokeWidth={2} className="text-gray-700" />
              </button>
              <h2 className="text-base font-bold text-gray-900 flex-1">New Guide</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
              {/* Cover photo */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Cover photo <span className="normal-case font-normal text-gray-400">(optional)</span>
                </p>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ''; }} />
                {coverPreview ? (
                  <div className="relative rounded-2xl overflow-hidden aspect-video bg-gray-100">
                    <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
<<<<<<< Updated upstream
                    <button onClick={() => { setCoverUrl(''); setCoverPreview(''); }}
                      className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50">
                      <X size={13} strokeWidth={2} className="text-white" />
                    </button>
=======
                    <div className="absolute inset-0 flex items-center justify-center gap-2">
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full"
                      >
                        {uploadingCover ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} strokeWidth={2} />}
                        {uploadingCover ? 'Uploading…' : 'Change'}
                      </button>
                      <button
                        onClick={() => { setCoverUrl(''); setCoverPreview(''); }}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
                      >
                        <X size={13} strokeWidth={2} className="text-white" />
                      </button>
                    </div>
>>>>>>> Stashed changes
                  </div>
                ) : (
                  <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-6 text-gray-400 active:bg-gray-50 transition-colors">
                    {uploadingCover ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} strokeWidth={1.5} />}
                    <span className="text-sm">{uploadingCover ? 'Uploading…' : 'Add cover photo'}</span>
                  </button>
                )}
                {publishError && <p className="text-xs text-red-500 mt-1">{publishError}</p>}
              </div>

              {/* City */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">City</p>

                {/* Search bar — works for any city */}
                <div className="relative mb-3">
                  <Search size={14} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={selectedCity}
                    onChange={e => setSelectedCity(e.target.value)}
                    placeholder="Search any city… e.g. Los Cabos"
                    className="w-full bg-gray-100 rounded-2xl pl-9 pr-9 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                  />
                  {selectedCity && (
                    <button onClick={() => setSelectedCity('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X size={13} strokeWidth={2} className="text-gray-400" />
                    </button>
                  )}
                </div>

                {/* Popular city pills */}
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Popular</p>
                <div className="flex flex-wrap gap-2">
                  {FEATURED_CITIES.map(city => (
                    <button key={city} onClick={() => setSelectedCity(city)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedCity === city
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                      }`}>
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Title</p>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Best coffee in London"
                  className="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none" />
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Description <span className="normal-case font-normal text-gray-400">(optional)</span>
                </p>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What makes this guide special…" rows={3}
                  className="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none resize-none" />
              </div>
            </div>

            <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setStep(2)} disabled={!selectedCity.trim() || !title.trim()}
                className="w-full bg-gray-900 text-white rounded-2xl py-3.5 text-sm font-bold disabled:opacity-40 transition-opacity">
                Next → Add Places
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Places + Map ── */}
        {step === 2 && (
          <>
            <div className="flex items-center gap-3 px-4 pt-2 pb-2 flex-shrink-0">
              <button onClick={() => setStep(1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                <ArrowLeft size={16} strokeWidth={2} className="text-gray-700" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 leading-tight">Add Places</h2>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <MapPin size={10} strokeWidth={1.5} />{selectedCity}
                </p>
              </div>
            </div>

            {/* Map — key forces remount on city change so center/zoom reset */}
            <div className="mx-4 mb-3 rounded-2xl overflow-hidden flex-shrink-0" style={{ height: 170 }}>
              <Suspense fallback={<div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl" />}>
                <MapView
                  key={selectedCity}
                  places={mapPlaces}
                  center={cityCenter ?? [20, 10]}
                  zoom={12}
                  height="170px"
                  hideZoomControls
                  selectedId={undefined}
                  {...(cityCenter ? { fitCity: { center: cityCenter, zoom: 12 } } : {})}
                />
              </Suspense>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-2">

              {/* Added places list */}
              {addedPlaces.length > 0 && (
                <div className="mb-3 space-y-2">
                  {addedPlaces.map((place, i) => (
                    <div key={place.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-2.5">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                        {i + 1}
                      </div>
                      {/* Photo strip — show first photo + count badge */}
                      <div className="relative flex-shrink-0">
                        {place.photoUrl
                          ? <img src={place.photoUrl} alt={place.name} className="w-11 h-11 rounded-xl object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          : <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center text-lg">📍</div>
                        }
                        {place.photoUrls.length > 1 && (
                          <div className="absolute -bottom-1 -right-1 bg-gray-900 text-white rounded-full text-[8px] font-bold w-4 h-4 flex items-center justify-center">
                            {place.photoUrls.length}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                        <p className="text-xs text-gray-400 truncate">{place.neighborhood || place.city}</p>
                        {place.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{place.description}</p>}
                      </div>
                      <button onClick={() => removePlace(place.id)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 flex-shrink-0">
                        <X size={11} strokeWidth={2} className="text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add place button */}
              {!showDraft && (
                <button
                  onClick={() => { setDraft(emptyDraft()); setShowDraft(true); }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-gray-400 active:bg-gray-50 transition-colors mb-3"
                >
                  <Plus size={16} strokeWidth={2} />
                  <span className="text-sm font-medium">Add a place</span>
                </button>
              )}

              {/* ── Draft: add place form (photos → location → storyline) ── */}
              {showDraft && (
                <div className="rounded-2xl border border-gray-200 overflow-hidden mb-3">

                  {/* 1. Photos (carousel) */}
                  <div className="px-3 pt-3 pb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      1 · Photos
                      {draft.photoUrls.length > 0 && (
                        <span className="normal-case font-normal ml-1">({draft.photoUrls.length}/5)</span>
                      )}
                    </p>
                    <input ref={draftPhotoRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleDraftPhotoAdd(f); e.target.value = ''; }} />

                    {draft.photoUrls.length === 0 ? (
                      <button onClick={() => draftPhotoRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-5 text-gray-400 active:bg-gray-50 transition-colors">
                        <Camera size={15} strokeWidth={1.5} />
                        <span className="text-xs">Upload photos</span>
                      </button>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {draft.photoUrls.map((url, i) => (
                          <div key={i} className="relative flex-shrink-0">
                            <img src={url} alt={`photo ${i + 1}`}
                              className="w-20 h-20 object-cover rounded-xl" />
                            <button
                              onClick={() => removeDraftPhoto(i)}
                              className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/60">
                              <X size={9} strokeWidth={2.5} className="text-white" />
                            </button>
                            {i === 0 && (
                              <div className="absolute bottom-0.5 left-0.5 bg-black/50 rounded-md px-1 py-0.5">
                                <span className="text-[8px] text-white font-semibold">Cover</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {draft.photoUrls.length < 5 && (
                          <button
                            onClick={() => draftPhotoRef.current?.click()}
                            className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 active:bg-gray-50 transition-colors">
                            <Plus size={16} strokeWidth={1.5} />
                            <span className="text-[9px] font-medium">Add more</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Location */}
                  <div className="px-3 pb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">2 · Location</p>
                    {draft.selectedLocation ? (
                      <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <Check size={13} strokeWidth={2.5} className="text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{draft.selectedLocation.name}</p>
                          <p className="text-xs text-gray-400 truncate">{draft.selectedLocation.neighborhood || draft.selectedLocation.city}</p>
                        </div>
                        <button onClick={() => setDraft(d => ({ ...d, selectedLocation: null, locationQuery: '', locationResults: [] }))}
                          className="text-gray-400 text-xs underline flex-shrink-0">change</button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search size={13} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input type="text" value={draft.locationQuery}
                            onChange={e => setDraft(d => ({ ...d, locationQuery: e.target.value }))}
                            placeholder={`Search in ${selectedCity}…`}
                            className="w-full bg-gray-100 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none" />
                          {draft.searchingLocation && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                        </div>
                        {draft.locationResults.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {draft.locationResults.map(r => (
                              <button key={r.id} onClick={() => setDraft(d => ({ ...d, selectedLocation: r, locationQuery: r.name, locationResults: [] }))}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl active:bg-gray-100 text-left">
                                <MapPin size={11} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 truncate">{r.name}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{r.neighborhood || r.city}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 3. Storyline + Voice Memo */}
                  <div className="px-3 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">3 · Storyline</p>
                      {/* Mic button */}
                      {!draft.audioPreviewUrl && (
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                            isRecording
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                          }`}
                        >
                          {isRecording ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <Square size={9} strokeWidth={2.5} />
                              {formatSeconds(recordingSeconds)}
                            </>
                          ) : (
                            <><Mic size={10} strokeWidth={2} /> Voice</>
                          )}
                        </button>
                      )}
                    </div>

                    <textarea value={draft.description}
                      onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                      placeholder="Tell your story about this place…" rows={3}
                      className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 outline-none resize-none" />

                    {/* Voice memo preview */}
                    {draft.audioPreviewUrl && (
                      <div className="mt-2 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                        <button onClick={toggleAudioPlay}
                          className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                          {audioPlaying
                            ? <Pause size={11} strokeWidth={2.5} className="text-white" />
                            : <Play size={11} strokeWidth={2.5} className="text-white ml-0.5" />}
                        </button>
                        <div className="flex-1 flex items-center gap-0.5">
                          {Array.from({ length: 24 }).map((_, i) => (
                            <div key={i} className="flex-1 bg-gray-400 rounded-full"
                              style={{ height: `${Math.random() * 12 + 4}px`, opacity: audioPlaying ? 1 : 0.5 }} />
                          ))}
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatSeconds(recordingSeconds)}</span>
                        <button onClick={() => { setDraft(d => ({ ...d, audioBlob: null, audioPreviewUrl: '' })); setAudioPlaying(false); setRecordingSeconds(0); }}
                          className="text-gray-400 flex-shrink-0">
                          <X size={12} strokeWidth={2} />
                        </button>
                        <audio ref={audioPlayerRef} src={draft.audioPreviewUrl} className="hidden" />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 px-3 pb-3">
                    <button onClick={() => { setShowDraft(false); setDraft(emptyDraft()); }}
                      className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">
                      Cancel
                    </button>
                    <button onClick={confirmDraft} disabled={!canConfirmDraft || confirmingDraft}
                      className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5">
                      {confirmingDraft ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
                      {confirmingDraft ? 'Adding…' : 'Add to guide'}
                    </button>
                  </div>
                </div>
              )}

              {addedPlaces.length === 0 && !showDraft && (
                <p className="text-center text-xs text-gray-400 pb-4">Add at least one place to make your guide useful</p>
              )}
            </div>

            <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
              {publishError && <p className="text-xs text-red-500 text-center">{publishError}</p>}
              <button onClick={handlePublish} disabled={publishing}
                className="w-full bg-gray-900 text-white rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {publishing ? <><Loader2 size={16} className="animate-spin" /> {editingGuide ? 'Saving…' : 'Publishing…'}</> : editingGuide ? 'Save changes' : 'Publish Guide'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
