/**
 * Utilities for extracting and inspecting Apple Music metadata
 */

/**
 * Extract all potentially useful metadata from a MusicKit item
 */
export function extractAppleMusicMetadata(item: any) {
  const attributes = item?.attributes ?? item;
  
  return {
    // Basic info
    id: item?.id || attributes?.playParams?.id,
    name: attributes?.name,
    artistName: attributes?.artistName,
    albumName: attributes?.albumName,
    composerName: attributes?.composerName,
    genreNames: attributes?.genreNames,
    
    // Identifiers that might help with MBID lookup
    isrc: attributes?.isrc, // International Standard Recording Code - very useful!
    upc: attributes?.upc, // Universal Product Code
    playParams: attributes?.playParams,
    catalogId: attributes?.playParams?.catalogId,
    
    // Duration and track info
    durationInMillis: attributes?.durationInMillis,
    trackNumber: attributes?.trackNumber,
    discNumber: attributes?.discNumber,
    
    // Release info
    releaseDate: attributes?.releaseDate,
    contentRating: attributes?.contentRating,
    
    // URLs and artwork
    url: attributes?.url,
    artwork: attributes?.artwork,
    
    // Full raw data for debugging
    raw: attributes,
  };
}

/**
 * Log full metadata structure for debugging
 */
export function debugLogMetadata(item: any) {
  const metadata = extractAppleMusicMetadata(item);
  console.log('[ListenBrainz+] Full Apple Music metadata:', metadata);
  return metadata;
}
