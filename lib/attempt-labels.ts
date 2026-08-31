export function attemptSourceLabel(source: string | null | undefined): string {
  return source === "teacher_ocr" ? "Paper scan" : "Digital";
}

export function formatAttemptWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
