import { readFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';

const MIN_DAYS = 14;
const MAX_DAYS = 45;

async function main() {
  const raw = await readFile(new URL('../site/data.json', import.meta.url), 'utf8');
  const { people } = JSON.parse(raw);

  const upcoming = people.filter((p) => p.daysUntil >= MIN_DAYS && p.daysUntil <= MAX_DAYS);

  console.log(`Found ${upcoming.length} birthday(s) in the ${MIN_DAYS}-${MAX_DAYS} day window:`);
  for (const p of upcoming) {
    console.log(`  ${p.name}: ${p.hebrewLabel} -> ${p.nextGregorianDate} (${p.daysUntil} days)`);
  }

  if (upcoming.length === 0) {
    console.log('No reminders to send this run.');
    return;
  }

  const recipients = (process.env.RECIPIENTS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const lines = upcoming.map(
    (p) => `${p.name} — ${p.hebrewLabel} (${p.nextGregorianDate}, בעוד ${p.daysUntil} ימים)`
  );
  const body = ['ימי הולדת שמתקרבים:', '', ...lines].join('\n');

  if (process.env.DRY_RUN === 'true') {
    console.log('DRY RUN - no email sent. Message body would be:');
    console.log(body);
    return;
  }

  if (recipients.length === 0) {
    throw new Error('No RECIPIENTS configured (set the RECIPIENTS secret)');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: recipients.join(','),
    subject: 'תזכורת: ימי הולדת מתקרבים',
    text: body,
  });

  console.log('Reminder email sent to:', recipients.join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
