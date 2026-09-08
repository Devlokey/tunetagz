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
 * Generates an SVG representation of the Spotify Code Tag front side matching physical keychain
 */
function generateSpotifyCodeSvg(trackId, options = {}) {
  const {
    orientation = 'vertical',
    color = '#dfba5e'
  } = options;

  const parsed = parseSpotifyUrl(trackId);
  const effectiveId = parsed.isValid ? parsed.id : (trackId || '4cOdK2wGLETKBW3PvgPWqT');
  const bars = generateSoundwaveBars(effectiveId, 23);

  if (orientation === 'horizontal') {
    const width = 400;
    const height = 100;
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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="spotify-soundwave-svg">
        <g transform="translate(18, 17) scale(0.075)" fill="${color}">
          <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm114 358c-4 7-14 9-21 5-58-35-131-43-217-24-8 2-16-3-18-11-2-8 3-16 11-18 94-21 175-12 240 27 7 4 9 14 5 21zm30-67c-6 9-17 12-26 7-66-41-167-53-246-29-10 3-21-3-24-13-3-10 3-21 13-24 90-27 201-14 276 33 9 5 12 17 7 26zm3-70c-79-47-210-51-285-28-12 4-25-3-28-15-4-12 3-25 15-28 86-26 230-21 321 33 11 6 14 21 8 32-6 10-20 14-31 6z"/>
        </g>
        <g>${svgBars}</g>
      </svg>
    `.trim();
  } else {
    // Authentic Vertical Barcode format matching physical keychain (media_1788876088753.png)
    const width = 70;
    const height = 270;
    const startY = 216;
    const spacing = 8.8;
    const barHeight = 4;

    let svgBars = '';
    bars.forEach((hPercent, idx) => {
      const barWidth = Math.round(12 + (hPercent / 100) * 38);
      const y = Math.round(startY - idx * spacing);
      const x = Math.round((width - barWidth) / 2);
      svgBars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="2" fill="${color}" />\n`;
    });

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="spotify-soundwave-svg vertical-soundwave" aria-label="Spotify Soundwave Barcode">
        <g transform="translate(20, 232) scale(0.06)" fill="${color}">
          <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm114 358c-4 7-14 9-21 5-58-35-131-43-217-24-8 2-16-3-18-11-2-8 3-16 11-18 94-21 175-12 240 27 7 4 9 14 5 21zm30-67c-6 9-17 12-26 7-66-41-167-53-246-29-10 3-21-3-24-13-3-10 3-21 13-24 90-27 201-14 276 33 9 5 12 17 7 26zm3-70c-79-47-210-51-285-28-12 4-25-3-28-15-4-12 3-25 15-28 86-26 230-21 321 33 11 6 14 21 8 32-6 10-20 14-31 6z"/>
        </g>
        <g>${svgBars}</g>
      </svg>
    `.trim();
  }
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
