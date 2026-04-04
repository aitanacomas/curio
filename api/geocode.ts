import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const key = process.env.VITE_GOOGLE_PLACES_KEY;
  if (!key) return res.status(500).json({ error: 'Missing API key' });

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.location',
        'Referer': 'https://curio-travel-app.vercel.app',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'en' }),
    });
    const data = await response.json();
    const loc = data.places?.[0]?.location;
    if (loc) {
      res.setHeader('Cache-Control', 's-maxage=86400'); // cache 24h
      return res.json({ lat: loc.latitude, lng: loc.longitude });
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    return res.status(500).json({ error: 'Fetch failed' });
  }
}
