export type SuperBowlDay = {
  year: number;
  month: number;
  day: number;
};

type Scoreboard = {
  leagues?: {
    season?: { year: number };
    calendar?: { value: string; entries?: { label: string; value: string }[] }[];
  }[];
  events?: {
    date: string;
    season?: { year: number; type: number };
    competitions?: { notes?: { headline?: string }[] }[];
  }[];
};

const scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const gameDayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

async function getScoreboard(
  season: number,
  signal: AbortSignal,
  week?: string,
): Promise<Scoreboard | undefined> {
  const params = new URLSearchParams({
    dates: String(season),
    seasontype: '3',
    limit: week ? '10' : '1',
  });
  if (week) params.set('week', week);

  const response = await fetch(`${scoreboardUrl}?${params}`, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (response.ok) return await response.json() as Scoreboard;
}

export async function fetchSuperBowlDay(year: number, signal: AbortSignal): Promise<SuperBowlDay | undefined> {
  const season = year - 1;
  try {
    const calendar = await getScoreboard(season, signal);
    // ESPN's postseason week number for the Super Bowl varies by season.
    const week = calendar?.leagues?.find((league) => league.season?.year === season)
      ?.calendar?.find(({ value }) => value === '3')
      ?.entries?.find(({ label }) => label === 'Super Bowl')?.value;
    if (!week || !/^\d+$/.test(week)) return;

    const scoreboard = await getScoreboard(season, signal, week);
    const game = scoreboard?.events?.find((event) =>
      event.season?.year === season && event.season.type === 3 &&
      event.competitions?.some((competition) =>
        competition.notes?.some(({ headline }) => /^Super Bowl\b/i.test(headline ?? '')),
      ),
    );
    if (!game) return;

    const parts = gameDayFormat.formatToParts(new Date(game.date));
    const gameYear = Number(parts.find(({ type }) => type === 'year')?.value);
    const month = Number(parts.find(({ type }) => type === 'month')?.value);
    const day = Number(parts.find(({ type }) => type === 'day')?.value);
    if (gameYear === year) return { year, month, day };
  } catch {
    // Use the calendar fallback if the scoreboard is unavailable.
  }
}
