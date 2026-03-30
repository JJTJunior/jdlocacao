/**
 * Converts a YYYY-MM-DD date string to a full ISO timestamp
 * using the current local time. If the string is already a full
 * timestamp, returns it as-is.
 */
export const toTimestamp = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString();
  // Already a full timestamp (contains T or +)
  if (dateStr.includes('T') || dateStr.includes('+')) return dateStr;
  // It's a date-only string like YYYY-MM-DD — attach NOON time to avoid timezone day-shift
  const [year, month, day] = dateStr.split('-').map(Number);
  const withTime = new Date(year, month - 1, day, 12, 0, 0);
  return withTime.toISOString();
};

/**
 * Detects if a raw date string represents a "date-only" value —
 * either literally YYYY-MM-DD, or a timestamp at midnight/noon UTC
 * (which is what Supabase returns for date-only inserts).
 */
const isDateOnly = (raw: string): boolean => {
  if (!raw) return true;
  // Pure date string
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return true;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) return true;
  // Supabase timestamptz midnight: 2026-03-29T00:00:00+00:00 or T00:00:00Z or T00:00:00.000000+00:00
  if (/T00:00:00(\.\d+)?(Z|\+00(:?00)?)$/i.test(raw.trim())) return true;
  // Noon placeholder: T12:00:00Z or T12:00:00+00:00
  if (/T12:00:00(\.\d+)?(Z|\+00(:?00)?)$/i.test(raw.trim())) return true;
  return false;
};

/**
 * Extracts the YYYY-MM-DD part from any date string,
 * returning it as a local-noon Date to avoid timezone day-shift.
 */
const parseDateOnly = (raw: string): Date | null => {
  // Try to extract YYYY-MM-DD from ISO or similar
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  // DD/MM/YYYY
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const d = new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]), 12, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

export const parseSafeDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;

  const cleanStr = dateStr.trim();

  // If it's a date-only value (pure date or midnight/noon UTC placeholder),
  // parse as LOCAL noon to prevent timezone day-shift
  if (isDateOnly(cleanStr)) {
    const localDate = parseDateOnly(cleanStr);
    if (localDate) return localDate;
  }

  // Full timestamp with real time info — parse normally
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;

  // Fallback: replace space with T (e.g., '2026-03-27 14:30:00')
  d = new Date(cleanStr.replace(' ', 'T'));
  if (!isNaN(d.getTime())) return d;

  return null;
};

export const formatSafeDate = (dateStr: string | null | undefined): string => {
  const d = parseSafeDate(dateStr);
  if (!d) return 'Data Inválida';
  return d.toLocaleDateString('pt-BR');
};

export const formatSafeDateTime = (dateStr: string | null | undefined): string => {
  const d = parseSafeDate(dateStr);
  if (!d) return 'Data Inválida';

  // Only show time when the raw value has REAL time info (not midnight/noon placeholder)
  if (dateStr && !isDateOnly(dateStr)) {
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR');
};
