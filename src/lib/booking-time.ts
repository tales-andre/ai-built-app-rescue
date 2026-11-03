import { SALON } from "./salon";

// Build the appointment date from the date and time the customer picked
export function toAppointmentDate(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}

// Check the salon is open at this time
export function isOpen(start: Date): boolean {
  const day = start.getDay();
  const hour = start.getHours();
  if (SALON.closedDays.includes(day.toString())) return false;
  return hour >= SALON.openHour && hour < SALON.closeHour;
}
