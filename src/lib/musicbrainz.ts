/**
 * MusicBrainz API client for looking up MBIDs
 * 
 * MusicBrainz API docs: https://musicbrainz.org/doc/MusicBrainz_API
 * Rate limit: Max 1 request per second (we'll implement throttling)
 */

interface MBIDLookupResult {
  recording_mbid?: string;
  artist_mbids?: string[];
  release_mbid?: string;
  release_group_mbid?: string;
}

interface RecordingSearchResult {
  id: string;
  score: number;
  title: string;
  'artist-credit'?: Array<{ artist: { id: string; name: string } }>;
  releases?: Array<{ id: string; 'release-group'?: { id: string } }>;
  isrcs?: string[];
}

interface MBSearchResponse {
  recordings?: RecordingSearchResult[];
}

// Rate limiting: max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second in milliseconds

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  
  return fetch(url, {
    headers: {
      'User-Agent': 'CiderListenBrainzPlus/1.0.0 ( https://github.com/ciderapp )',
      'Accept': 'application/json',
    },
  });
}

/**
 * Look up recording by ISRC code
 * This is the most reliable method when available
 */
export async function lookupByISRC(isrc: string): Promise<MBIDLookupResult | null> {
  try {
    console.log(`[MusicBrainz] Looking up ISRC: ${isrc}`);
    const url = `https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?fmt=json&inc=artist-credits+releases+release-groups`;
    console.log(`[MusicBrainz] Fetching: ${url}`);
    const response = await rateLimitedFetch(url);
    
    if (!response.ok) {
      console.warn(`[MusicBrainz] ISRC lookup failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[MusicBrainz] ISRC response:`, data);
    const recordings = data.recordings || [];
    console.log(`[MusicBrainz] Found ${recordings.length} recordings for ISRC`);
    
    if (recordings.length === 0) {
      return null;
    }
    
    // Take the first recording (they should all be the same recording by definition of ISRC)
    const recording = recordings[0];
    
    return {
      recording_mbid: recording.id,
      artist_mbids: recording['artist-credit']?.map((ac: any) => ac.artist.id) || [],
      release_mbid: recording.releases?.[0]?.id,
      release_group_mbid: recording.releases?.[0]?.[' release-group']?.id,
    };
  } catch (err) {
    console.error('[MusicBrainz] ISRC lookup error:', err);
    return null;
  }
}

/**
 * Search for recording by artist, track, and album names
 * Less reliable than ISRC but useful as fallback
 */
export async function searchRecording(
  artistName: string,
  trackName: string,
  albumName?: string
): Promise<MBIDLookupResult | null> {
  try {
    // Build query string
    const parts: string[] = [
      `recording:"${trackName}"`,
      `artist:"${artistName}"`,
    ];
    
    if (albumName) {
      parts.push(`release:"${albumName}"`);
    }
    
    const query = encodeURIComponent(parts.join(' AND '));
    const url = `https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=1`;
    console.log(`[MusicBrainz] Text search: ${url}`);
    
    const response = await rateLimitedFetch(url);
    console.log(`[MusicBrainz] Text search response status: ${response.status}`);
    
    if (!response.ok) {
      console.warn(`[MusicBrainz] Recording search failed: ${response.status}`);
      return null;
    }
    
    const data: MBSearchResponse = await response.json();
    console.log(`[MusicBrainz] Text search response:`, data);
    const recordings = data.recordings || [];
    console.log(`[MusicBrainz] Found ${recordings.length} recordings via text search`);
    
    if (recordings.length === 0) {
      console.log(`[MusicBrainz] No text search results`);
      return null;
    }
    
    const recording = recordings[0];
    console.log(`[MusicBrainz] Best match score: ${recording.score}`);
    
    // Only use results with a decent confidence score
    if (recording.score < 85) {
      console.warn(`[MusicBrainz] Low confidence match (score: ${recording.score})`);
      return null;
    }
    
    return {
      recording_mbid: recording.id,
      artist_mbids: recording['artist-credit']?.map(ac => ac.artist.id) || [],
      release_mbid: recording.releases?.[0]?.id,
      release_group_mbid: recording.releases?.[0]?.['release-group']?.id,
    };
  } catch (err) {
    console.error('[MusicBrainz] Recording search error:', err);
    return null;
  }
}

/**
 * Main entry point: try ISRC first, then fall back to text search
 */
export async function lookupMBIDs(
  artistName: string,
  trackName: string,
  albumName?: string,
  isrc?: string
): Promise<MBIDLookupResult | null> {
  // Try ISRC first if available (most reliable)
  if (isrc) {
    console.log('[MusicBrainz] Looking up by ISRC:', isrc);
    const result = await lookupByISRC(isrc);
    if (result) {
      console.log('[MusicBrainz] Found via ISRC:', result);
      return result;
    }
    console.log('[MusicBrainz] ISRC lookup failed, falling back to text search');
  }
  
  // Fall back to text search
  console.log('[MusicBrainz] Searching by text:', { artistName, trackName, albumName });
  const result = await searchRecording(artistName, trackName, albumName);
  
  if (result) {
    console.log('[MusicBrainz] Found via text search:', result);
  } else {
    console.log('[MusicBrainz] No match found');
  }
  
  return result;
}
