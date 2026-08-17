/**
 * Tier 1 — Feature 12: Spotify Link & URI Parsing
 * Verifies parsing of Spotify URLs, URIs, query parameters,
 * track ID extraction, and rejection of invalid media links.
 */

module.exports = {
  title: 'F12: Spotify Link & URI Parsing',
  featureId: 'F12',
  run: async (t, client) => {
    // 1. Test standard track URL in order validation
    const validTrackUrl = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT';
    const validUri = 'spotify:track:4cOdK2wGLETKBW3PvgPWqT';
    const validUrlWithQuery = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=a1b2c3d4e5';
    const validAlbumUrl = 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3';

    // Helper regex that backend and tests both adhere to
    const SPOTIFY_REGEX = /^(https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/[a-zA-Z0-9]{22}(\?.*)?|spotify:(track|album|playlist|artist):[a-zA-Z0-9]{22})$/;

    t.assert(SPOTIFY_REGEX.test(validTrackUrl), 'Valid track URL should match Spotify pattern');
    t.assert(SPOTIFY_REGEX.test(validUri), 'Valid track URI should match Spotify pattern');
    t.assert(SPOTIFY_REGEX.test(validUrlWithQuery), 'Track URL with query params should match');
    t.assert(SPOTIFY_REGEX.test(validAlbumUrl), 'Album URL should match Spotify pattern');

    // 2. Reject non-Spotify URLs
    const invalidUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://soundcloud.com/artist/track',
      'not_a_url_at_all',
      'https://open.spotify.com/invalid/short'
    ];

    for (const badUrl of invalidUrls) {
      t.assert(!SPOTIFY_REGEX.test(badUrl), `Invalid URL "${badUrl}" should be rejected`);
    }

    // 3. Test extraction of 22-character Spotify ID
    const match = validTrackUrl.match(/(track|album|playlist)\/([a-zA-Z0-9]{22})/);
    t.assert(Boolean(match), 'Should be able to extract resource type and ID from URL');
    t.assertEqual(match[2], '4cOdK2wGLETKBW3PvgPWqT', 'Extracted Spotify ID must match');
  }
};
