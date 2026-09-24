import calendarDays from "./koreanCalendarDays.json";

// dateKey: "YYYY-MM-DD"
export function getDayInfo(dateKey) {
  const entry = calendarDays[dateKey];
  if (!entry) return { holidayNames: [], minorNames: [] };
  return { holidayNames: entry.holiday || [], minorNames: entry.minor || [] };
}

export function isHoliday(dateKey) {
  return getDayInfo(dateKey).holidayNames.length > 0;
}
