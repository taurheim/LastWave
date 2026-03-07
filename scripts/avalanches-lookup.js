async function run() {
  // MusicBrainz
  const sRes = await fetch('https://musicbrainz.org/ws/2/artist/?query=artist:The%20Avalanches&fmt=json&limit=1', { headers: { 'User-Agent': 'LastWave/4.0' } });
  const sData = await sRes.json();
  const mb = sData.artists[0];
  console.log('MusicBrainz match: ' + mb.name + ' (score: ' + mb.score + ')');
  await new Promise(r => setTimeout(r, 1100));
  const lRes = await fetch(`https://musicbrainz.org/ws/2/artist/${mb.id}?inc=genres+tags&fmt=json`, { headers: { 'User-Agent': 'LastWave/4.0' } });
  const lData = await lRes.json();
  console.log('  Genres: ' + (lData.genres || []).map(g => g.name + ' (' + g.count + ')').join(', '));
  console.log('  Tags:   ' + (lData.tags || []).map(t => t.name + ' (' + t.count + ')').join(', '));

  // Wikidata
  const sparql = `SELECT ?genreLabel WHERE {
    ?artist rdfs:label "The Avalanches"@en .
    ?artist wdt:P136 ?genre .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  const wdRes = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), {
    headers: { 'User-Agent': 'LastWave/4.0', 'Accept': 'application/sparql-results+json' }
  });
  const wdData = await wdRes.json();
  const genres = wdData.results.bindings.map(r => r.genreLabel.value);
  console.log('\nWikidata genres: ' + genres.join(', '));
}
run().catch(console.error);
