export function formatShortDateKey(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const [, m, d] = dateKey.split("-");
  return `${m}.${d}~`;
}

export function spanDaysLabel(n) {
  const v = Math.max(1, Number(n) || 1);
  return `${v}일간`;
}

export function repeatWeeksLabel(n) {
  const v = Math.max(1, Number(n) || 1);
  if (v === 1) return "이번주만";
  return `${v}주연속`;
}

export function expandEventDates(eventDate, spanDays, repeatWeeks) {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return [];
  const span = Math.min(Math.max(Number(spanDays) || 1, 1), 31);
  const weeks = Math.min(Math.max(Number(repeatWeeks) || 1, 1), 52);
  const [y, m, d] = eventDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const dates = new Set();
  for (let w = 0; w < weeks; w++) {
    for (let day = 0; day < span; day++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + day);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      dates.add(key);
    }
  }
  return [...dates].sort();
}

export function ownerLabel(o) {
  return o.nickname || o.name || o.email || `#${o.id}`;
}

export function filterTitle(owners) {
  if (!owners?.length) return "일정";
  if (owners.length === 1) return `${ownerLabel(owners[0])}의 일정`;
  return `${owners.map(ownerLabel).join(", ")}의 일정`;
}

export function jointOwnerTitle(ownerIds, owners) {
  const labels = ownerIds
    .map((id) => owners.find((o) => o.id === id))
    .filter(Boolean)
    .map(ownerLabel);
  if (!labels.length) return "명의";
  if (labels.length === 1) return `${labels[0]} 명의`;
  return `${labels.join(" · ")} 공동명의`;
}
