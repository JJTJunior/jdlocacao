/**
 * Converts a YYYY-MM-DD date string to a full ISO timestamp
 * using the current time. If the string is already a full timestamp,
 * returns it as-is.
 */
export const toTimestamp = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString();
  // Already a full timestamp (contains T or +)
  if (dateStr.includes('T') || dateStr.includes('+')) return dateStr;
  // It's a date-only string like YYYY-MM-DD, attach current time
  const now = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const withTime = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
  return withTime.toISOString();
};

export const parseSafeDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  
  let cleanStr = dateStr;
  
  // Clean up double T's if they exist (e.g. from concatenating T12:00:00 to an ISO string)
  if (cleanStr.includes('T')) {
    const parts = cleanStr.split('T');
    if (parts.length > 2) {
      cleanStr = parts[0] + 'T' + parts[1];
    }
  }

  // Handle DD/MM/YYYY
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split(' ')[0].split('/');
    if (parts.length === 3) {
      // Use local noon to avoid timezone shifts
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Handle YYYY-MM-DD (date-only, no time) — parse as local date, not UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    const [y, m, d] = cleanStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0); // noon local to avoid day shift
    if (!isNaN(date.getTime())) return date;
  }

  // Try parsing the cleaned string (full timestamps)
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  
  // Fallback to replacing space with T (e.g., '2026-03-27 10:00:00')
  d = new Date(cleanStr.replace(' ', 'T'));
  if (!isNaN(d.getTime())) return d;

  return null;
};

/**
 * Returns true if the date string contains actual time information
 * (not just a date-only value or midnight placeholder).
 */
const hasRealTime = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  // Date-only: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  // DD/MM/YYYY without time
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false;
  // Contains T with actual non-midnight, non-noon time
  if (dateStr.includes('T')) {
    const timePart = dateStr.split('T')[1];
    if (!timePart) return false;
    // Extract HH:MM from time part
    const match = timePart.match(/^(\d{2}):(\d{2})/);
    if (!match) return false;
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    // Consider 00:00 and 12:00 as "no real time" (placeholder values)
    if (h === 0 && m === 0) return false;
    if (h === 12 && m === 0) return false;
    return true;
  }
  return false;
};

export const formatSafeDate = (dateStr: string | null | undefined): string => {
  const d = parseSafeDate(dateStr);
  if (!d) return 'Data Inválida';
  return d.toLocaleDateString('pt-BR');
};

export const formatSafeDateTime = (dateStr: string | null | undefined): string => {
  const d = parseSafeDate(dateStr);
  if (!d) return 'Data Inválida';
  
  if (hasRealTime(dateStr)) {
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR');
};
