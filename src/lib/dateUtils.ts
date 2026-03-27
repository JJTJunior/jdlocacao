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
      const formatted = `${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`;
      const d = new Date(formatted);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Try parsing the cleaned string
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  
  // If it's still invalid, what if it's literally "Invalid Date" string?
  if (cleanStr === 'Invalid Date') {
    return new Date(); // Fallback to now just to show something
  }

  // Fallback to replacing space with T (e.g., '2026-03-27 10:00:00')
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
  
  // Check if we should append time
  const hasTime = dateStr && dateStr.includes('T') && !dateStr.endsWith('T00:00:00Z') && !dateStr.endsWith('T12:00:00Z') && !dateStr.endsWith('T12:00:00.000Z') && !dateStr.includes('T12:00:00');
  
  if (hasTime) {
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR');
};
