import { fromZonedTime } from "date-fns-tz";
import { SALON } from "./salon";

// The customer picks a date and time on the salon's wall clock. Servers usually
// run in UTC, so `new Date("2026-11-10T10:00")` would mean 10:00 UTC (4:00 AM in
// Chicago). Convert explicitly from the salon's time zone, daylight saving included.
export function toAppointmentDate(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}`, SALON.timeZone);
}

/** Day of week (0 = Sunday) and hour of an instant, on the salon's wall clock. */
export function salonClock(instant: Date): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SALON.timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(instant);
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday), hour };
}

// Check the salon is open at this time
export function isOpen(start: Date): boolean {
  const { day, hour } = salonClock(start);
  if (SALON.closedDays.includes(day.toString())) return false;
  return hour >= SALON.openHour && hour < SALON.closeHour;
}

/** How the app shows an appointment time: always in salon time. */
export function formatSalonTime(instant: Date | string): string {
  return new Date(instant).toLocaleString("en-US", {
    timeZone: SALON.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
