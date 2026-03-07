// Temporary script to compare genre APIs for Taurheim's top artists
const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';

async function getTopArtists() {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=Taurheim&period=3month&limit=50&api_key=${API_KEY}&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.topartists.artist.map(a => ({ name: a.name, playcount: parseInt(a.playcount) }));
}

async function queryMusicBrainz(artists) {
  const counts = {};
  for (const artist of artists) {
    await new Promise(r => setTimeout(r, 1100));
    try {
      const sUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist.name)}&fmt=json&limit=1`;
      const sRes = await fetch(sUrl, { headers: { 'User-Agent': 'LastWave/4.0 (research)' } });
      const sData = await sRes.json();
      if (sData.artists && sData.artists.length > 0 && sData.artists[0].score >= 90) {
        await new Promise(r => setTimeout(r, 1100));
        const lUrl = `https://musicbrainz.org/ws/2/artist/${sData.artists[0].id}?inc=genres&fmt=json`;
        const lRes = await fetch(lUrl, { headers: { 'User-Agent': 'LastWave/4.0 (research)' } });
        const lData = await lRes.json();
        for (const g of (lData.genres || [])) {
          counts[g.name] = (counts[g.name] || 0) + artist.playcount;
        }
      }
    } catch (e) {}
    process.stderr.write('.');
  }
  process.stderr.write('\n');
  return counts;
}

async function queryWikidata(artists) {
  const values = artists.map(a => `"${a.name.replace(/"/g, '')}"@en`).join(' ');
  const sparql = `SELECT ?name ?genreLabel WHERE {
    VALUES ?name { ${values} }
    ?artist rdfs:label ?name .
    ?artist wdt:P136 ?genre .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;

  const wdRes = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), {
    headers: { 'User-Agent': 'LastWave/4.0 (research)', 'Accept': 'application/sparql-results+json' }
  });
  const wdData = await wdRes.json();

  const wdMap = {};
  for (const row of wdData.results.bindings) {
    const a = row.name.value;
    const g = row.genreLabel.value;
    if (!wdMap[a]) wdMap[a] = [];
    if (!wdMap[a].includes(g)) wdMap[a].push(g);
  }

  const counts = {};
  for (const artist of artists) {
    for (const g of (wdMap[artist.name] || [])) {
      counts[g] = (counts[g] || 0) + artist.playcount;
    }
  }
  return counts;
}

async function run() {
  const artists = await getTopArtists();
  console.log(`Fetched ${artists.length} artists\n`);

  process.stderr.write('MusicBrainz: ');
  const mbCounts = await queryMusicBrainz(artists);

  process.stderr.write('Wikidata: ');
  const wdCounts = await queryWikidata(artists);
  process.stderr.write('done\n');

  // Merge all genre names and sort by max count
  const allGenres = new Set([...Object.keys(mbCounts), ...Object.keys(wdCounts)]);
  const rows = [...allGenres].map(g => ({
    genre: g,
    mb: mbCounts[g] || 0,
    wd: wdCounts[g] || 0
  }));
  rows.sort((a, b) => Math.max(b.mb, b.wd) - Math.max(a.mb, a.wd));

  console.log('Genre'.padEnd(35) + 'MusicBrainz'.padStart(12) + 'Wikidata'.padStart(12));
  console.log('-'.repeat(59));
  for (const r of rows) {
    const mbStr = r.mb > 0 ? String(r.mb) : '-';
    const wdStr = r.wd > 0 ? String(r.wd) : '-';
    console.log(r.genre.padEnd(35) + mbStr.padStart(12) + wdStr.padStart(12));
  }
  console.log('-'.repeat(59));
  console.log('Total unique genres'.padEnd(35) + String(Object.keys(mbCounts).length).padStart(12) + String(Object.keys(wdCounts).length).padStart(12));
}

run().catch(console.error);
