# MBID Enrichment Implementation

## Overview

The plugin now automatically enriches scrobbles with **MusicBrainz IDs (MBIDs)** - unique identifiers that link scrobbles to the MusicBrainz database. This significantly improves the accuracy and linkability of your listening history on ListenBrainz.

## What are MBIDs?

MBIDs are unique identifiers from the MusicBrainz database that identify:

- **Recording MBID**: The specific recording/track
- **Artist MBIDs**: The artists who performed the track
- **Release MBID**: The album/release the track is from
- **Release Group MBID**: The logical grouping of releases

## How It Works

### 1. ISRC-Based Lookup (Primary Method)

- Apple Music metadata often includes **ISRC codes** (International Standard Recording Code)
- ISRCs are industry-standard identifiers that uniquely identify recordings
- When available, we use ISRC to look up MBIDs from MusicBrainz
- This is the most reliable method with near-perfect accuracy

### 2. Text-Based Search (Fallback)

- If no ISRC is available, we search MusicBrainz by artist, track, and album names
- Only accepts matches with 85%+ confidence score
- Less reliable than ISRC but still useful

### 3. Caching Layer

- All MBID lookups are cached in localStorage for 30 days
- Cache prevents redundant API calls for tracks you've scrobbled before
- Stores up to 1000 tracks (oldest entries automatically removed)
- Even negative results (no MBIDs found) are cached to avoid repeated lookups

### 4. Rate Limiting

- MusicBrainz API requires max 1 request per second
- Built-in rate limiting ensures compliance
- Lookups happen asynchronously and don't block scrobbling

## Features

### Enriched Scrobble Data

When MBIDs are found, scrobbles include:

```json
{
  "track_metadata": {
    "artist_name": "Artist Name",
    "track_name": "Track Name",
    "release_name": "Album Name",
    "additional_info": {
      "recording_mbid": "uuid",
      "artist_mbids": ["uuid1", "uuid2"],
      "release_mbid": "uuid",
      "release_group_mbid": "uuid",
      "isrc": "USRC12345678",
      "tracknumber": 3,
      "music_service": "Apple Music"
    }
  }
}
```

### Debug UI

The **Advanced** page now shows:

- **MBID Cache Statistics**: Number of cached tracks and cache age
- **Clear Cache** button: Manually clear the cache if needed
- **Log messages** show MBID lookup status:
  - `Looking up MBIDs for: <track>`
  - `✓ Found MBIDs (via ISRC)` or `✓ Found MBIDs (via text search)`
  - `✗ No MBIDs found`
  - `MBIDs from cache (isrc/text-search/none)`
- Scrobble queue messages show `[+MBID]` indicator when MBIDs are attached

## File Structure

### New Files Created

- **`src/lib/appleMetadata.ts`**: Utilities for extracting Apple Music metadata (including ISRC)
- **`src/lib/musicbrainz.ts`**: MusicBrainz API client with ISRC and text search
- **`src/lib/mbidCache.ts`**: Caching layer with localStorage persistence

### Modified Files

- **`src/main.ts`**: Integrated MBID lookup into scrobbling workflow
- **`src/pages/AdvancedPage.vue`**: Added MBID cache statistics section

## API Compliance

### MusicBrainz API Requirements

- **Rate Limit**: Max 1 request per second (enforced via throttling)
- **User-Agent**: Set to `CiderListenBrainzPlus/1.0.0`
- **Endpoints Used**:
  - `/ws/2/isrc/{isrc}` - ISRC lookup
  - `/ws/2/recording/?query=...` - Text search

## Benefits

1. **Accurate Metadata Linking**: MBIDs ensure your scrobbles link to the correct recordings in MusicBrainz
2. **Better Statistics**: ListenBrainz can provide more accurate listening statistics with MBID data
3. **Future-Proof**: MBID-enriched scrobbles are more valuable for future ListenBrainz features
4. **Performance**: Caching means most tracks only require one API call ever
5. **Offline Safety**: Works with the existing queue system - lookups don't block scrobbling

## Cache Management

### Automatic Cleanup

- Entries older than 30 days are automatically removed
- Cache limited to 1000 entries (oldest removed first)
- Negative results are cached to avoid repeated failed lookups

### Manual Management

- Visit **Advanced** page in plugin settings
- View cache statistics (entry count and age)
- Click **Clear Cache** to reset

## Limitations

1. **Rate Limiting**: Only 1 MusicBrainz request per second
   - For rapid song changes, some lookups may be delayed
   - Cached tracks bypass this limitation

2. **ISRC Availability**: Not all Apple Music tracks have ISRCs
   - Falls back to less reliable text search
   - Some tracks may not get MBIDs at all

3. **Network Required**: MBID lookups require internet connection
   - Scrobbles still queue without MBIDs if offline
   - Lookups can't be retried for already-scrobbled tracks

## Debugging

### Check ISRC Availability

Open console and look for:

```text
[ListenBrainz+] ISRC found: USRC12345678
```

### Monitor MBID Lookups

Check logs in **Advanced** page:

- `Looking up MBIDs` = Lookup in progress
- `✓ Found MBIDs` = Success
- `✗ No MBIDs found` = Not found in MusicBrainz
- `MBIDs from cache` = Retrieved from cache (no API call)

### Verify Scrobbles Include MBIDs

Look for `[+MBID]` indicator in queue messages:

```text
Added to queue: Artist - Track [+MBID] (240s / 240s)
```

## Future Enhancements

Potential improvements for future versions:

- Batch MBID lookups for queue items
- Pre-emptive MBID lookup when track changes (before scrobble threshold)
- Export/import MBID cache
- Show MBID details in Advanced page for current track
- Retry MBID lookup for failed scrobbles
