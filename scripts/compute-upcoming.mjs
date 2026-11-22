import { readFile, writeFile } from 'node:fs/promises';
import { HDate, months } from '@hebcal/core';

const MONTH_NUM = {
  Nisan: months.NISAN,
  Iyyar: months.IYYAR,
  Sivan: months.SIVAN,
  Tamuz: months.TAMUZ,
  Av: months.AV,
  Elul: months.ELUL,
  Tishrei: months.TISHREI,
  Cheshvan: months.CHESHVAN,
  Kislev: months.KISLEV,
  Tevet: months.TEVET,
  Shevat: months.SHVAT,
};

function monthNumberForYear(monthKey, hyear) {
  if (monthKey === 'Adar') {
    return HDate.isLeapYear(hyear) ? months.ADAR_II : months.ADAR_I;
  }
  const num = MONTH_NUM[monthKey];
  if (!num) throw new Error(`Unknown Hebrew month key: ${monthKey}`);
  return num;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Adar birthdays are resolved to Adar II in leap years (the common convention
// when the original Adar I/II of birth is unknown). This is verified below
// against hdate.getMonthName() so a wrong month-number assumption fails loudly
// instead of silently producing a wrong date.
function nextOccurrence(day, monthKey, today) {
  const todayHDate = new HDate(today);
  const startYear = todayHDate.getFullYear();
  for (let i = 0; i < 3; i++) {
    const hyear = startYear + i;
    const monthNum = monthNumberForYear(monthKey, hyear);
    const candidate = new HDate(day, monthNum, hyear);
    const gregDate = startOfDay(candidate.greg());
    if (gregDate.getTime() >= startOfDay(today).getTime()) {
      return { gregDate, hdate: candidate };
    }
  }
  throw new Error(`Could not find next occurrence for day ${day} month ${monthKey}`);
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function assertMonthNameMatches(monthKey, resolvedName) {
  const expectedPrefix = normalize(monthKey === 'Adar' ? 'Adar' : monthKey);
  if (!normalize(resolvedName).startsWith(expectedPrefix)) {
    throw new Error(
      `Month mismatch: expected something starting with "${expectedPrefix}" but hebcal resolved "${resolvedName}". ` +
        'The month-number mapping in this script is likely wrong - fix MONTH_NUM before trusting any dates.'
    );
  }
}

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS);
}

async function main() {
  const raw = await readFile(new URL('../data/birthdays.json', import.meta.url), 'utf8');
  const people = JSON.parse(raw);
  const today = new Date();

  const results = people.map((person) => {
    const { gregDate, hdate } = nextOccurrence(person.day, person.monthKey, today);
    const resolvedMonthName = hdate.getMonthName();
    assertMonthNameMatches(person.monthKey, resolvedMonthName);
    return {
      name: person.name,
      hebrewLabel: person.hebrewLabel,
      monthKey: person.monthKey,
      resolvedMonthName,
      nextGregorianDate: gregDate.toISOString().slice(0, 10),
      daysUntil: daysBetween(today, gregDate),
    };
  });

  results.sort((a, b) => a.daysUntil - b.daysUntil);

  console.log('Computed upcoming birthdays:');
  for (const r of results) {
    console.log(
      `${r.name}: ${r.hebrewLabel} (resolved as ${r.resolvedMonthName}) -> ${r.nextGregorianDate} (in ${r.daysUntil} days)`
    );
  }

  await writeFile(
    new URL('../site/data.json', import.meta.url),
    JSON.stringify({ generatedAt: today.toISOString(), people: results }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
