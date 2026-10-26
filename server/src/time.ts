const kstDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** KST 기준 YYYY-MM-DD */
export function toKstDate(d: Date = new Date()): string {
  return kstDate.format(d);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
