export type LogoSeason =
  | 'regular'
  | 'new-year'
  | 'valentines'
  | 'super-bowl'
  | 'easter'
  | 'earth-day'
  | 'fourth-of-july'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas';

function getEasterSunday(year: number): Date {
  // Oudin's Gregorian Easter calculation, published by the U.S. Naval Observatory.
  const century = Math.trunc(year / 100);
  const lunarCycleYear = year % 19;
  const solarCorrection = Math.trunc((century - 17) / 25);
  const leapCenturies = Math.trunc(century / 4);
  const centuryCorrection = Math.trunc((century - solarCorrection) / 3);
  const epact = (century - leapCenturies - centuryCorrection + 19 * lunarCycleYear + 15) % 30;
  const lateMoon = Math.trunc(epact / 28);
  const lateMoonAdjustment =
    lateMoon * (1 - lateMoon * Math.trunc(29 / (epact + 1)) * Math.trunc((21 - lunarCycleYear) / 11));
  const correctedEpact = epact - lateMoonAdjustment;
  const weekday = (year + Math.trunc(year / 4) + correctedEpact + 2 - century + leapCenturies) % 7;
  const easterOffset = correctedEpact - weekday;
  const easterMonth = 3 + Math.trunc((easterOffset + 40) / 44);
  const easterDay = easterOffset + 28 - 31 * Math.trunc(easterMonth / 4);

  return new Date(year, easterMonth - 1, easterDay);
}

function getNthWeekday(year: number, month: number, weekday: number, occurrence: number): Date {
  const firstDay = new Date(year, month, 1).getDay();
  const daysUntilWeekday = (weekday - firstDay + 7) % 7;
  return new Date(year, month, 1 + daysUntilWeekday + (occurrence - 1) * 7);
}

function isHolidayWeek(today: Date, holiday: Date): boolean {
  const firstDay = new Date(holiday);
  firstDay.setDate(firstDay.getDate() - 6);
  return today >= firstDay && today <= holiday;
}

export function getLogoSeason(date: Date): LogoSeason {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month === 11) return 'christmas';

  const holidays: { season: LogoSeason; day: Date }[] = [
    { season: 'new-year', day: new Date(year, 0, 1) },
    { season: 'valentines', day: new Date(year, 1, 14) },
    { season: 'easter', day: getEasterSunday(year) },
    { season: 'earth-day', day: new Date(year, 3, 22) },
    { season: 'fourth-of-july', day: new Date(year, 6, 4) },
    { season: 'halloween', day: new Date(year, 9, 31) },
    { season: 'thanksgiving', day: getNthWeekday(year, 10, 4, 4) },
    { season: 'super-bowl', day: getNthWeekday(year, 1, 0, 2) },
  ];

  const today = new Date(year, month, date.getDate());
  // The order gives Valentine's Day the morning and the Super Bowl the afternoon.
  const activeHolidays = holidays.filter(({ day }) => isHolidayWeek(today, day));
  const active = date.getHours() < 12 ? activeHolidays[0] : activeHolidays.at(-1);
  return active?.season ?? 'regular';
}
