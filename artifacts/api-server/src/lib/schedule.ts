// Shift rotation logic:
// Anchor week: March 30, 2026 (Monday) — the week containing April 1, 2026 (Wed = Shift B)
// Pattern in even weeks (week 0, 2, 4...):
//   Shift A works: Mon, Tue, Fri, Sat, Sun
//   Shift B works: Wed, Thu
// Pattern in odd weeks (week 1, 3, 5...):
//   Shift A works: Wed, Thu
//   Shift B works: Mon, Tue, Fri, Sat, Sun

const ANCHOR_MONDAY = new Date("2026-03-30T00:00:00.000Z");

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

export function getWorkingShiftLetter(date: Date): "a" | "b" {
  const monday = getWeekMonday(date);
  const weeksDiff = Math.round(
    (monday.getTime() - ANCHOR_MONDAY.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  const isEvenWeek = ((weeksDiff % 2) + 2) % 2 === 0;
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const isMonTueFriSatSun = [0, 1, 2, 5, 6].includes(dayOfWeek);

  if (isEvenWeek) {
    return isMonTueFriSatSun ? "a" : "b";
  } else {
    return isMonTueFriSatSun ? "b" : "a";
  }
}

export function getDayName(dayOfWeek: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayOfWeek];
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
