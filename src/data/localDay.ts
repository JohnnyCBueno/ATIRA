export function localDayIdForTimestamp(timestamp: string | Date) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Cannot derive a local day from an invalid timestamp.');
  }
  return localDayIdForDate(date);
}

export function localDayIdForDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDayId(dayId: string) {
  const [year, month, day] = dayId.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
