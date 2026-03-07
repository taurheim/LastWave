// Test Deezer API for genre lookup on Taurheim's top artists
const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';

async function run() {
  // Get top artists from Last.fm
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=Taurheim&period=3month&limit=50&api_key=${API_KEY}&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  const artists = data.topartists.artist.map(a => ({ name: a.name, playcount: parseInt(a.playcount) }));
  console.log(`Fetched ${artists.length} artists\n`);

  const genreCounts = {};
  let found = 0;
  const missing = [];

  for (const artist of artists) {
    try {
      const dUrl = `https://api.deezer.com/search/artist?q=${encodeURIComponent(artist.name)}&limit=1`;
      const dRes = await fetch(dUrl);
      const dData = await dRes.json();

      if (dData.data && dData.data.length > 0) {
        const dArtist = dData.data[0];
        // Get full artist info (includes genre via tracklist or top tracks)
        const artistUrl = `https://api.deezer.com/artist/${dArtist.id}`;
        const aRes = await fetch(artistUrl);
        const aData = await aRes.json();

        // Try getting top tracks to find genre
        const topUrl = `https://api.deezer.com/artist/${dArtist.id}/top?limit=5`;
        const tRes = await fetch(topUrl);
        const tData = await tRes.json();

        const genres = new Set();

        // Check if artist has direct genre info
        if (aData.genre_id) {
          // Need to look up genre name
          const gUrl = `https://api.deezer.com/genre/${aData.genre_id}`;
          const gRes = await fetch(gUrl);
          const gData = await gRes.json();
          if (gData.name && gData.name !== 'Undefined') genres.add(gData.name);
        }

        // Also get genres from albums
        const albumUrl = `https://api.deezer.com/artist/${dArtist.id}/albums?limit=3`;
        const albRes = await fetch(albumUrl);
        const albData = await albRes.json();
        if (albData.data) {
          for (const album of albData.data) {
            const fullAlbUrl = `https://api.deezer.com/album/${album.id}`;
            const fRes = await fetch(fullAlbUrl);
            const fData = await fRes.json();
            if (fData.genres && fData.genres.data) {
              for (const g of fData.genres.data) {
                if (g.name && g.name !== 'Undefined') genres.add(g.name);
              }
            }
          }
        }

        if (genres.size > 0) {
          found++;
          const genreArr = [...genres];
          console.log(`${artist.name} (${artist.playcount}) -> ${genreArr.join(', ')}`);
          for (const g of genreArr) {
            genreCounts[g] = (genreCounts[g] || 0) + artist.playcount;
          }
        } else {
          missing.push(artist.name);
          console.log(`${artist.name} (${artist.playcount}) -> NO GENRES`);
        }
      } else {
        missing.push(artist.name);
        console.log(`${artist.name} (${artist.playcount}) -> NOT FOUND`);
      }
    } catch (e) {
      missing.push(artist.name + ' (err)');
      console.log(`${artist.name} -> ERROR: ${e.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Found: ${found}/${artists.length}`);
  console.log(`Missing: ${missing.join(', ')}`);
  console.log(`${'='.repeat(60)}\n`);

  const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  console.log('Top genres (weighted by plays):');
  sorted.forEach(([genre, count], i) => {
    console.log(`  ${(i + 1).toString().padStart(3)}. ${genre.padEnd(30)} ${count} plays`);
  });
  console.log(`\nTotal unique genres: ${sorted.length}`);
}

run().catch(console.error);
