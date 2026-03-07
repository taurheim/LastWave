/**
 * Cache last.fm data for minPlays prediction algorithm testing.
 *
 * Usage: npx tsx scripts/cache-prediction-data.ts
 *
 * Fetches 1-year weekly data for 100+ users.
 * Only fetches users whose cache file doesn't already exist.
 * Saves JSON files to tests/fixtures/wave-prediction/<username>.json
 */

const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const CADENCE_MS = 110;
const MIN_PLAYS = 10;

import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '../tests/fixtures/wave-prediction',
);

// Original 10 users from cache-accuracy-data.ts + friends discovered via last.fm API
const USERS = [
  // Original accuracy-test users
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
  // Friends-of-friends discovered via user.getfriends API
  '77DaveZ',
  'aleaaaaa',
  'Alexbloke10',
  'aliceunderstars',
  'AlphaTeam',
  'AlterMann',
  'alvin_lao',
  'andreshenaoo',
  'andrwgldmn',
  'annaelle_vg',
  'AnnMorG',
  'Annunak',
  'Anshlavs',
  'aoaaoa',
  'arelyradd',
  'arope23',
  'Asap_rickey',
  'asderyok',
  'ashlyn---',
  'ave58',
  'AYDRA',
  'babydwake',
  'Bean_Seventeen',
  'beantacos',
  'bellaseriously',
  'bickybilly',
  'Bill_M',
  'bopchara',
  'calistian',
  'Campfireharvest',
  'Cannonadd',
  'captmilox',
  'CARJACKED_OREO',
  'chamoisguy',
  'Charlie19877',
  'chromxtica',
  'clearverdict',
  'Codename_JOE',
  'cross37',
  'dafloofycaptain',
  'dahalto',
  'danin317',
  'daximew',
  'depreciavel',
  'DiegoCalquin',
  'digicait',
  'DJ_ZLOn',
  'Dryjan_',
  'dubstepgrowl',
  'e3lise',
  'elnik666',
  'ENFOR_',
  'Esphaine',
  'ewarsaba',
  'FallingInhaler',
  'farg-svobodan',
  'fastasthenight',
  'Faust_1808',
  'Finakala',
  'flightwheel',
  'Fluffybacon3',
  'Foulex',
  'Fox_Si',
  'foxbop',
  'Fuckuh',
  'Ganelon13',
  'gat0rgirl13',
  'GoGuerilla',
  'Going_usa',
  'goldenstuffed',
  'GoninthePit',
  'goto505at1251',
  'GregIannacone',
  'GreySkyline',
  'Gruggloid',
  'Hallonsoda',
  'HammyBb',
  'hazier1995',
  'hellomilk',
  'HertzmanB',
  'hi_im_joshua',
  'HoarseBard',
  'humanquac',
  'iegovaah',
  'itsleec',
  'Jakemoof',
  'jamiecoley',
  'Jaxon503',
  'joe_crozier',
  'Jumbo_Black',
  'K_Mozgalom',
  'Kaedal',
  'kauaaniceto',
  'KirbyJason',
  'kozlotura',
  'Kvltwoods',
  'lavvie_wavvie',
  'Lenkacore',
  'lifeinfisheye',
  'Liza___',
  'lolahol',
  'Lostraver',
  'loveprimari',
  'low_signal',
  'LugalKi_En',
  'Mara-marena',
  'Masonrrichards',
  'mathos1432',
  'meatyclownman',
  'Mikk0_',
  'Mista_Al_Capwn',
  'MixtapesHappen',
  'MrHorrnet',
  'mrUnheaven',
  'muGGGs',
  'my_dyad',
  'mynfcp',
  'nategura',
  'NestingKoala',
  'nickbabick',
  'NiflheimFm',
  'NigelHitch',
  'nikifir4ik',
  'nyancrimew',
  'Odkleja',
  'olive-doortea',
  'oliviawoof',
  'OrgaaZm',
  'oscarbuelna',
  'ossifer-bones',
  'overthehedge06',
  'oxonio',
  'paolacheerios',
  'paraleldisjecta',
  'parisg57',
  'peeltheavo',
  'Pepega77',
  'PhoenixSheppy',
  'Plannet-telex',
  'plinirh',
  'PllyViolence',
  'popicongoddess',
  'prepare4claire',
  'Proggy_foggy',
  'protivoga3',
  'Psychostatus666',
  'puppy_xD',
  'qimi',
  'r5a2k3',
  'raccstachio',
  'RANDOMXmus',
  'realryangoslig',
  'redw_is',
  'ReinieR89',
  'rottenviking',
  'sauterio',
  'SeanAves9',
  'shade4u',
  'shadz1',
  'Shlaker13',
  'sIutt',
  'SkazeS',
  'Skeetulz',
  'snow-mancob',
  'snyeoz',
  'soft_green',
  'sophdurs',
  'spaceBass13',
  'stephmdoty',
  'StreamingSongz',
  'SultrixSymphony',
  'Sunbeeenlight',
  'Svvarg',
  'Tailor69',
  'technicallyri_',
  'TheRealJKJones',
  'threehannah',
  'thurston__',
  'tinosoft',
  'tracyyph',
  'TrixieLuIamoon',
  'troop53no',
  'TurdHeart',
  'txtmepls',
  'tylerpost200',
  'uhhmya',
  'upiki',
  'UselessSuicide',
  'valkzuh',
  'vHallas',
  'victorioussword',
  'vinylbagel',
  'w0rldprincess',
  'warbunnie',
  'Weasel_14',
  'wielmar',
  'willisgirl',
  'XeNassassin',
  'Yashsway',
  'ysayefantasy',
  'zivfm',
  'Zonrup',
  'zzashpaupat',
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

  process.stdout.write(`  Fetching ${segments.length} segments `);
  const segmentData: SegmentEntry[][] = [];
  for (const [from, to] of segments) {
    segmentData.push(await fetchSegment(username, from, to));
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, CADENCE_MS));
  }
  console.log(' done');

  const map: Record<string, { title: string; counts: number[] }> = {};
  segmentData.forEach((seg, idx) => {
    seg.forEach(({ title, count }) => {
      if (!map[title]) map[title] = { title, counts: new Array(segmentData.length).fill(0) };
      map[title].counts[idx] = count;
    });
  });

  const artists = Object.values(map).filter(d => Math.max(...d.counts) >= MIN_PLAYS);
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

  console.log(`Total users in list: ${USERS.length}`);

  const usersToFetch: string[] = [];
  let cachedCount = 0;
  for (const user of USERS) {
    const file = path.join(FIXTURE_DIR, `${user}.json`);
    if (fs.existsSync(file)) {
      cachedCount++;
    } else {
      usersToFetch.push(user);
    }
  }

  console.log(`Already cached: ${cachedCount}`);
  console.log(`Need to fetch: ${usersToFetch.length}\n`);

  if (usersToFetch.length === 0) {
    console.log('All users already cached. Nothing to fetch.');
    return;
  }

  let successCount = cachedCount;
  let failCount = 0;

  for (const user of usersToFetch) {
    console.log(`[${successCount + failCount + 1}/${USERS.length}] Fetching "${user}"...`);
    try {
      const data = await fetchUser(user);
      const file = path.join(FIXTURE_DIR, `${user}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      successCount++;
      console.log(`  → Saved (${data.artists.length} artists)\n`);
    } catch (err: any) {
      failCount++;
      console.error(`  ✗ Skipping ${user}: ${err.message}\n`);
    }
  }

  console.log('─'.repeat(40));
  console.log(`Done. Successfully cached: ${successCount}/${USERS.length} (${failCount} failed)`);
}

main().catch(err => { console.error(err); process.exit(1); });
