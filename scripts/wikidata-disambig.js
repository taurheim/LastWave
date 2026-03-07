// Improved Wikidata genre lookup with wbsearchentities disambiguation
const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';

async function getTopArtists() {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=Taurheim&period=3month&limit=50&api_key=${API_KEY}&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.topartists.artist.map(a => ({ name: a.name, playcount: parseInt(a.playcount) }));
}

// Music-related P31 types
const MUSIC_TYPES = new Set([
  'Q5',        // human
  'Q215380',   // musical group
  'Q2088357',  // musical duo
  'Q4438121',  // musical ensemble
  'Q56816954', // musical project
  'Q18127',    // record label (unlikely but just in case)
]);

// Music-related occupations (P106) to prefer
const MUSIC_OCCUPATIONS = new Set([
  'Q177220',   // singer
  'Q639669',   // musician
  'Q488205',   // singer-songwriter
  'Q183945',   // record producer
  'Q486748',   // rapper
  'Q855091',   // guitarist
  'Q36834',    // composer
  'Q158852',   // DJ
  'Q753110',   // songwriter
  'Q806349',   // bandleader
]);

async function findBestEntity(artistName) {
  // Step 1: Use wbsearchentities for fuzzy matching
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&limit=10&format=json`;
  const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'LastWave/4.0 (research)' } });
  const searchData = await searchRes.json();

  if (!searchData.search || searchData.search.length === 0) {
    return null;
  }

  // Step 2: Get details for all candidates in one SPARQL query
  const ids = searchData.search.map(s => 'wd:' + s.id).join(' ');
  const sparql = `SELECT ?item ?itemLabel ?type ?occupation ?genreLabel ?sitelinks WHERE {
    VALUES ?item { ${ids} }
    ?item wdt:P31 ?type .
    OPTIONAL { ?item wdt:P106 ?occupation . }
    OPTIONAL { ?item wdt:P136 ?genre . }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  const sparqlUrl = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);
  const sparqlRes = await fetch(sparqlUrl, {
    headers: { 'User-Agent': 'LastWave/4.0 (research)', 'Accept': 'application/sparql-results+json' }
  });
  const sparqlData = await sparqlRes.json();

  // Step 3: Score each candidate
  const candidates = {};
  for (const row of sparqlData.results.bindings) {
    const id = row.item.value.split('/').pop();
    if (!candidates[id]) {
      candidates[id] = {
        id,
        label: row.itemLabel?.value || '',
        sitelinks: parseInt(row.sitelinks?.value || '0'),
        isMusician: false,
        isMusicType: false,
        hasGenres: false,
        genres: new Set(),
        score: 0,
      };
    }
    const c = candidates[id];

    const typeId = row.type?.value?.split('/').pop();
    if (typeId && MUSIC_TYPES.has(typeId)) c.isMusicType = true;

    const occId = row.occupation?.value?.split('/').pop();
    if (occId && MUSIC_OCCUPATIONS.has(occId)) c.isMusician = true;

    if (row.genreLabel?.value) {
      c.hasGenres = true;
      c.genres.add(row.genreLabel.value);
    }
  }

  // Score: music type +10, musician occupation +10, has genres +5, sitelinks as tiebreaker
  for (const c of Object.values(candidates)) {
    c.score = (c.isMusicType ? 10 : 0)
            + (c.isMusician ? 10 : 0)
            + (c.hasGenres ? 5 : 0)
            + Math.min(c.sitelinks / 100, 5); // up to 5 bonus for notability
  }

  // Pick best candidate that has genres
  const ranked = Object.values(candidates)
    .filter(c => c.hasGenres && (c.isMusicType || c.isMusician))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  return ranked[0];
}

async function run() {
  const artists = await getTopArtists();
  console.log(`Fetched ${artists.length} artists\n`);

  const genreCounts = {};
  let found = 0;
  const missing = [];

  for (const artist of artists) {
    const match = await findBestEntity(artist.name);
    if (match) {
      found++;
      const genres = [...match.genres];
      console.log(`${artist.name} (${artist.playcount}) -> ${match.label} [${match.id}] (score:${match.score.toFixed(1)})`);
      console.log(`  ${genres.join(', ')}`);
      for (const g of genres) {
        genreCounts[g] = (genreCounts[g] || 0) + artist.playcount;
      }
    } else {
      missing.push(artist.name);
      console.log(`${artist.name} (${artist.playcount}) -> NOT FOUND`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== WIKIDATA (improved disambiguation) ===`);
  console.log(`Found: ${found}/${artists.length}`);
  console.log(`Missing: ${missing.join(', ')}`);
  console.log(`${'='.repeat(60)}\n`);

  const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  console.log('Top genres (weighted by plays):');
  sorted.forEach(([genre, count], i) => {
    console.log(`  ${(i + 1).toString().padStart(3)}. ${genre.padEnd(35)} ${count} plays`);
  });
  console.log(`\nTotal unique genres: ${sorted.length}`);
}

run().catch(console.error);
