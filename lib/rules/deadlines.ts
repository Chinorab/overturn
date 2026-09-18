import { addDays, addHours, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { ISODate } from "@/lib/schemas/core";
import type { Deadline } from "./schema";

export type DeadlineStatus = "ok" | "soon" | "urgent" | "passed";

export const SOON_DAYS = 30;
export const URGENT_DAYS = 7;

export function toISO(d: Date): ISODate {
  return format(d, "yyyy-MM-dd");
}

/** due = anchor + amount. Months are calendar months (Jan 31 + 1 month = Feb 28/29). */
export function computeDue(anchor: ISODate, deadline: Deadline): ISODate {
  const base = parseISO(anchor);
  switch (deadline.unit) {
    case "days":
      return toISO(addDays(base, deadline.amount));
    case "months":
      return toISO(addMonths(base, deadline.amount));
    case "hours":
      return toISO(addHours(base, deadline.amount));
  }
}

export function daysLeft(due: ISODate, today: ISODate): number {
  return differenceInCalendarDays(parseISO(due), parseISO(today));
}

export function statusFor(days: number): DeadlineStatus {
  if (days < 0) return "passed";
  if (days <= URGENT_DAYS) return "urgent";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
