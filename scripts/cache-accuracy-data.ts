/**
 * Cache last.fm data for the wave accuracy test suite.
 *
 * Usage: npx tsx scripts/cache-accuracy-data.ts
 *
 * Fetches 1-year weekly data for each user in the USERS list.
 * Only fetches users whose cache file doesn't already exist.
 * Saves JSON files to tests/fixtures/wave-accuracy/<username>.json
 */

const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const CADENCE_MS = 110;
const MIN_PLAYS = 10;

import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '../tests/fixtures/wave-accuracy',
);

const USERS = [
  'Taurheim',
  'BeensVonBenis',
  'crewsackan',
  'grimmless',
  '0x255',
  'aura636',
  'reose',
  'gudetamaguy86',
  'yvesdot',
  'cwalkpinoy',
  // Add new users here — only uncached ones will be fetched
];

interface SegmentEntry {
  title: string;
  count: number;
}

interface CachedData {
  username: string;
  preset: '1y';
  fetchedAt: string;
  numSegments: number;
  artists: { title: string; counts: number[] }[];
}

async function fetchSegment(user: string, from: number, to: number): Promise<SegmentEntry[]> {
  const url = `${API_BASE}?method=user.getweeklyartistchart&api_key=${API_KEY}&format=json&user=${encodeURIComponent(user)}&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${user}`);
  const json = await res.json();
  const root = json.weeklyartistchart;
  if (!root?.artist) return [];
  const artists = Array.isArray(root.artist) ? root.artist : [root.artist];
  return artists.map((a: any) => ({ title: a.name, count: parseInt(a.playcount, 10) }));
}

function splitTimeSpan(startUnix: number, endUnix: number): [number, number][] {
  const dt = 604800; // 1 week
  const segs: [number, number][] = [];
  for (let t = startUnix; t < endUnix; t += dt) segs.push([t, t + dt]);
  return segs;
}

async function fetchUser(username: string): Promise<CachedData> {
  const now = Date.now();
  const startUnix = Math.floor((now - 31536000000) / 1000);
  const endUnix = Math.floor(now / 1000);
  const segments = splitTimeSpan(startUnix, endUnix);

  console.log(`  Fetching ${segments.length} segments...`);
  const segmentData: SegmentEntry[][] = [];
  for (const [from, to] of segments) {
    segmentData.push(await fetchSegment(username, from, to));
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, CADENCE_MS));
  }
  console.log(' done');

  // Join segments into per-artist count arrays
  const map: Record<string, { title: string; counts: number[] }> = {};
  segmentData.forEach((seg, idx) => {
    seg.forEach(({ title, count }) => {
      if (!map[title]) map[title] = { title, counts: new Array(segmentData.length).fill(0) };
      map[title].counts[idx] = count;
    });
  });

  // Filter by min plays
  let artists = Object.values(map).filter(d => Math.max(...d.counts) >= MIN_PLAYS);

  console.log(`  ${artists.length} artists after filtering (min ${MIN_PLAYS} plays)`);

  return {
    username,
    preset: '1y',
    fetchedAt: new Date().toISOString(),
    numSegments: segments.length,
    artists,
  };
}

async function main() {
  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  const usersToFetch: string[] = [];
  for (const user of USERS) {
    const file = path.join(FIXTURE_DIR, `${user}.json`);
    if (fs.existsSync(file)) {
      console.log(`✓ ${user} already cached`);
    } else {
      usersToFetch.push(user);
    }
  }

  if (usersToFetch.length === 0) {
    console.log('\nAll users already cached. Nothing to fetch.');
    return;
  }

  console.log(`\nNeed to fetch ${usersToFetch.length} user(s): ${usersToFetch.join(', ')}\n`);

  for (const user of usersToFetch) {
    console.log(`Fetching "${user}"...`);
    try {
      const data = await fetchUser(user);
      const file = path.join(FIXTURE_DIR, `${user}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      console.log(`  → Saved to ${path.relative(process.cwd(), file)}\n`);
    } catch (err) {
      console.error(`  ✗ Failed to fetch ${user}:`, err);
    }
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
