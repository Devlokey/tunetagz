const crypto = require('crypto');

/**
 * Spotify Service & Customizer Engine
 */

/**
 * Parses a Spotify URL or URI and extracts metadata
 */
function parseSpotifyUrl(input) {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      error: 'Spotify link or URI is required'
    };
  }

  const trimmed = input.trim();

  // 1. Spotify URI format: spotify:track:4cOdK2wGLETKBW3PvgPWqT
  const uriMatch = trimmed.match(/^spotify:(track|album|playlist|artist):([a-zA-Z0-9]{22})/i);
  if (uriMatch) {
    return {
      isValid: true,
      type: uriMatch[1].toLowerCase(),
      id: uriMatch[2],
      uri: `spotify:${uriMatch[1].toLowerCase()}:${uriMatch[2]}`,
      url: `https://open.spotify.com/${uriMatch[1].toLowerCase()}/${uriMatch[2]}`
    };
  }

  // 2. Spotify Web URL format: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
  const urlMatch = trimmed.match(/https?:\/\/(?:open\.)?spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]{22})/i);
  if (urlMatch) {
    return {
      isValid: true,
      type: urlMatch[1].toLowerCase(),
      id: urlMatch[2],
      uri: `spotify:${urlMatch[1].toLowerCase()}:${urlMatch[2]}`,
      url: `https://open.spotify.com/${urlMatch[1].toLowerCase()}/${urlMatch[2]}`
    };
  }

  // 3. Spotify shortened link: https://spotify.link/... or custom
  if (trimmed.startsWith('https://spotify.link/') || trimmed.startsWith('http://spotify.link/')) {
    return {
      isValid: true,
      type: 'track',
      id: trimmed.replace(/https?:\/\/spotify\.link\//, '').split('?')[0] || 'custom',
      uri: `spotify:track:shortened`,
      url: trimmed
    };
  }

  // 4. Any raw 22-character Spotify ID
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return {
      isValid: true,
      type: 'track',
      id: trimmed,
      uri: `spotify:track:${trimmed}`,
      url: `https://open.spotify.com/track/${trimmed}`
    };
  }

  return {
    isValid: false,
    error: 'Invalid Spotify link format. Please provide a valid Spotify track, album, or playlist URL.'
  };
}

/**
 * Deterministically generates an array of 23 bar heights (1-8 scale) from a Spotify track ID or string
 */
function generateSoundwaveBars(trackId = 'default', barCount = 23) {
  const hash = crypto.createHash('md5').update(String(trackId)).digest('hex');
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    const charCode = parseInt(hash.charAt(i % hash.length), 16);
    // Height between 15% and 100%
    const heightPercent = 15 + Math.round((charCode / 15) * 85);
    bars.push(heightPercent);
  }
  return bars;
}

/**
 * Generates an SVG representation of the Spotify Code Tag front side
 */
function generateSpotifyCodeSvg(trackId, options = {}) {
  const {
    width = 400,
    height = 100,
    color = '#D4AF37', // Gold color
    backgroundColor = '#121212'
  } = options;

  const parsed = parseSpotifyUrl(trackId);
  const effectiveId = parsed.isValid ? parsed.id : (trackId || '4cOdK2wGLETKBW3PvgPWqT');
  const bars = generateSoundwaveBars(effectiveId, 23);

  const barWidth = 6;
  const barGap = 6;
  const startX = 80;
  const centerY = height / 2;

  let svgBars = '';
  bars.forEach((hPercent, idx) => {
    const barHeight = (hPercent / 100) * (height - 30);
    const x = startX + idx * (barWidth + barGap);
    const y = centerY - barHeight / 2;
    svgBars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="${barWidth / 2}" fill="${color}" />\n`;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="${backgroundColor}" rx="12" />
      <!-- Spotify Logo Outline -->
      <g transform="translate(20, 25)">
        <circle cx="25" cy="25" r="22" fill="${color}" />
        <path d="M 12 21 C 20 18 30 19 38 23" stroke="${backgroundColor}" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <path d="M 14 27 C 21 24 29 25 36 29" stroke="${backgroundColor}" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M 16 33 C 22 30 28 31 34 34" stroke="${backgroundColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
      </g>
      <!-- Soundwave Bars -->
      <g>
        ${svgBars}
      </g>
    </svg>
  `.trim();
}

/**
 * Validates custom text input
 */
function validateCustomText(text) {
  if (!text) return { isValid: true, sanitized: '' };
  if (typeof text !== 'string') text = String(text);

  const trimmed = text.trim();
  if (trimmed.length > 30) {
    return {
      isValid: false,
      error: 'Custom engraving text must not exceed 30 characters.'
    };
  }

  // Strip harmful characters while preserving common punctuation
  const sanitized = trimmed.replace(/[<>]/g, '');
  return {
    isValid: true,
    sanitized
  };
}

module.exports = {
  parseSpotifyUrl,
  generateSoundwaveBars,
  generateSpotifyCodeSvg,
  validateCustomText
};
