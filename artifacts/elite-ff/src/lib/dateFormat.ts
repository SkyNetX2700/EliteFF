type DateValue = string | number | Date | null | undefined;

function toDate(value: DateValue) {
  if (value instanceof Date) return value;
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime12(value: DateValue, includeYear = true) {
  const date = toDate(value);
  if (!date) return "TBD";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatTime12(value: DateValue, includeSeconds = false) {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: true,
  }).format(date);
}