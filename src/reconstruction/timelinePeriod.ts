import { localDayIdForDate, parseLocalDayId } from '../data/localDay';

export type TimelinePeriod = 'day' | 'week' | 'month';

export function isLiveTimelinePeriod(
  period: TimelinePeriod,
  selectedDayId: string,
  now = new Date(),
) {
  return period === 'day' && selectedDayId === localDayIdForDate(now);
}

export function dayIdsForTimelinePeriod(period: TimelinePeriod, selectedDayId: string) {
  const selectedDate = parseLocalDayId(selectedDayId);
  if (period === 'day') return [selectedDayId];

  if (period === 'week') {
    const monday = new Date(selectedDate);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return localDayIdForDate(date);
    });
  }

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const dayCount = new Date(year, month + 1, 0, 12).getDate();
  return Array.from(
    { length: dayCount },
    (_, index) => localDayIdForDate(new Date(year, month, index + 1, 12)),
  );
}
