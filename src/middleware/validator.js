/**
 * Request Validation Utilities
 */

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // RFC 5322 standard email regex pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim()) && email.trim().length <= 255;
}

function isValidPhone(phone) {
  if (!phone) return true; // phone is often optional
  if (typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15 && /^\d+$/.test(cleaned);
}

function isValidPostalCode(code) {
  if (!code || typeof code !== 'string') return false;
  const cleaned = code.trim();
  // 6 digits for Indian PIN codes or 3-10 alphanumeric characters for international
  return /^[0-9]{6}$/.test(cleaned) || /^[a-zA-Z0-9\s\-]{3,10}$/.test(cleaned);
}

function sanitizeText(text, maxLen = 30) {
  if (!text) return '';
  if (typeof text !== 'string') text = String(text);
  const sanitized = text
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .trim();
  return sanitized.slice(0, maxLen);
}

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidPostalCode,
  sanitizeText
};
