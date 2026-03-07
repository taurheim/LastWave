// Improved Wikidata genre lookup with proper disambiguation
const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';

async function getTopArtists() {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=Taurheim&period=3month&limit=50&api_key=${API_KEY}&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.topartists.artist.map(a => ({ name: a.name, playcount: parseInt(a.playcount) }));
}

async function queryWikidataImproved(artists) {
  // Build VALUES clause with artist names
  const values = artists.map(a => `"${a.name.replace(/"/g, '')}"@en`).join(' ');

  // Key improvements:
  // 1. Filter P31 (instance of) to only music-related entities
  //    Q5 = human, Q215380 = musical group, Q2088357 = musical duo,
  //    Q4438121 = musical ensemble, Q56816954 = musical project
  // 2. Also try skos:altLabel for alternative names (e.g. JAY-Z)
  // 3. Require P136 (genre) to exist

  const sparql = `SELECT ?name ?artistLabel ?genreLabel ?instanceLabel WHERE {
    VALUES ?name { ${values} }
    {
      ?artist rdfs:label ?name .
    } UNION {
      ?artist skos:altLabel ?name .
    }
    VALUES ?type {
      wd:Q5
      wd:Q215380
      wd:Q2088357
      wd:Q4438121
      wd:Q56816954
    }
    ?artist wdt:P31 ?type .
    ?artist wdt:P136 ?genre .
    ?artist wdt:P31 ?instance .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  console.log('Querying Wikidata (improved disambiguation)...');
  const wdUrl = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);
  const wdRes = await fetch(wdUrl, {
    headers: { 'User-Agent': 'LastWave/4.0 (research)', 'Accept': 'application/sparql-results+json' }
  });

  if (!wdRes.ok) {
    console.log('Wikidata error: ' + wdRes.status);
    console.log((await wdRes.text()).slice(0, 500));
    return {};
  }

  const wdData = await wdRes.json();

  // Build artist -> { genres, entity } map
  const artistData = {};
  for (const row of wdData.results.bindings) {
    const searchName = row.name.value;
    const entityLabel = row.artistLabel.value;
    const genre = row.genreLabel.value;
    const instance = row.instanceLabel.value;

    if (!artistData[searchName]) {
      artistData[searchName] = { entityLabel, instance, genres: new Set() };
    }
    artistData[searchName].genres.add(genre);
  }

  return artistData;
}

async function run() {
  const artists = await getTopArtists();
  console.log(`Fetched ${artists.length} artists\n`);

  const wdData = await queryWikidataImproved(artists);

  // Per-artist results
  let found = 0;
  const missing = [];
  const genreCounts = {};

  console.log('\n--- Per-artist genres ---\n');
  for (const artist of artists) {
    const match = wdData[artist.name];
    if (match && match.genres.size > 0) {
      found++;
      const genres = [...match.genres];
      console.log(`${artist.name} (${artist.playcount} plays) -> ${match.entityLabel} [${match.instance}]`);
      console.log(`  ${genres.join(', ')}`);
      for (const g of genres) {
        genreCounts[g] = (genreCounts[g] || 0) + artist.playcount;
      }
    } else {
      missing.push(artist.name);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Found: ${found}/${artists.length}`);
  console.log(`Missing: ${missing.join(', ')}`);
  console.log(`${'='.repeat(60)}\n`);

  // Top genres
  const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  console.log('Top genres (weighted by plays):');
  sorted.forEach(([genre, count], i) => {
    console.log(`  ${(i + 1).toString().padStart(3)}. ${genre.padEnd(35)} ${count} plays`);
  });
  console.log(`\nTotal unique genres: ${sorted.length}`);
}

run().catch(console.error);
