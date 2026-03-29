/**
 * Genre lookup module — 3-tier approach:
 *   1. Wikidata (batch, fast, curated genres)
 *   2. MusicBrainz fallback (album-verified, rate-limited)
 *   3. Last.fm tags fallback (when MB confirms artist but has no genres)
 *
 * Results are cached in localStorage with a versioned key prefix.
 */

const CACHE_PREFIX = 'genre:v1:';
const WIKIDATA_UA = 'LastWave/4.0 (https://github.com/lastwave)';

// In dev, proxy through Vite to avoid CORS. In prod, hit APIs directly with origin=*.
const META_ENV = import.meta.env as Record<string, unknown>;
const WIKIDATA_API = META_ENV.DEV
  ? '/api/wikidata/w/api.php'
  : 'https://www.wikidata.org/w/api.php';
const SPARQL_ENDPOINT = META_ENV.DEV ? '/api/sparql/sparql' : 'https://query.wikidata.org/sparql';

// ─── Name handling ────────────────────────────────────────

const MUSIC_TYPE_KEYWORDS = [
  'band',
  'group',
  'duo',
  'trio',
  'quartet',
  'ensemble',
  'musician',
  'singer',
  'rapper',
  'musical',
  'dj',
  'human',
];
const MUSIC_OCCUPATION_KEYWORDS = [
  'singer',
  'musician',
  'rapper',
  'songwriter',
  'composer',
  'producer',
  'dj',
  'guitarist',
  'drummer',
  'bassist',
  'pianist',
  'vocalist',
  'instrumentalist',
  'disc jockey',
  'record producer',
  'music artist',
];

function isMusicRelated(types: Set<string>, occupations: Set<string>): boolean {
  const tt = [...types].map((t) => t.toLowerCase());
  const oo = [...occupations].map((o) => o.toLowerCase());
  return (
    tt.some((t) => MUSIC_TYPE_KEYWORDS.some((kw) => t.includes(kw))) ||
    oo.some((o) => MUSIC_OCCUPATION_KEYWORDS.some((kw) => o.includes(kw)))
  );
}

function normalizeForSearch(name: string): string {
  return name
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u2010-\u2014]/g, '-')
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForComparison(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nameSimilarity(searchName: string, resultName: string): number {
  const a = normalizeForComparison(searchName);
  const b = normalizeForComparison(resultName);

  if (a.length === 0 || b.length === 0) {
    const rawA = searchName.toLowerCase().trim();
    const rawB = resultName.toLowerCase().trim();
    if (rawA === rawB) return 1.0;
    if (rawA.includes(rawB) || rawB.includes(rawA)) return 0.7;
    return 0;
  }

  if (a === b) return 1.0;

  // Stage name = surname pattern
  const aWords = searchName.toLowerCase().split(/\s+/);
  const bWords = resultName.toLowerCase().split(/\s+/);
  if (aWords.length === 1 && bWords.length === 2 && aWords[0].length >= 3) {
    if (normalizeForComparison(bWords[bWords.length - 1]) === normalizeForComparison(aWords[0]))
      return 0.85;
  }

  const lenRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  if ((b.startsWith(a) || a.startsWith(b)) && lenRatio >= 0.7) return 0.9;
  if (a.length >= 4 && b.length >= 4 && (b.includes(a) || a.includes(b)) && lenRatio >= 0.5)
    return 0.7;

  const searchWords = new Set(searchName.toLowerCase().split(/\s+/));
  const resultWords = new Set(resultName.toLowerCase().split(/\s+/));
  const overlap = [...searchWords].filter((w) => resultWords.has(w) && w.length > 1).length;
  if (overlap > 0) return 0.3 + (overlap / Math.max(searchWords.size, resultWords.size)) * 0.4;
  return 0;
}

function albumMatchScore(sourceAlbums: string[], lastfmAlbums: string[]): number {
  if (sourceAlbums.length === 0) return 0;
  const srcNorm = new Set(sourceAlbums.map(normalizeForComparison).filter((s) => s.length >= 3));
  const lfmNorm = lastfmAlbums.map(normalizeForComparison).filter((s) => s.length >= 3);
  let matches = 0;
  for (const lfm of lfmNorm) {
    if (srcNorm.has(lfm)) matches++;
  }
  return matches;
}

// ─── Wikidata entity types ────────────────────────────────

interface WikidataEntity {
  id: string;
  label: string;
  types: Set<string>;
  occupations: Set<string>;
  genres: Set<string>;
  sitelinks: number;
}

interface RankedCandidate extends WikidataEntity {
  score: number;
  albumMatches: number;
  similarity: number;
}

// ─── API response types ──────────────────────────────────

interface WikidataSearchResponse {
  search: Array<{ id: string }>;
}

interface SparqlValue {
  value: string;
}

interface EntitySparqlBinding {
  item: SparqlValue;
  itemLabel?: SparqlValue;
  typeLabel?: SparqlValue;
  occupationLabel?: SparqlValue;
  genreLabel?: SparqlValue;
  sitelinks?: SparqlValue;
}

interface DiscographySparqlBinding {
  performer: SparqlValue;
  workLabel?: SparqlValue;
}

interface SparqlResponse<T> {
  results: { bindings: T[] };
}

interface LastfmAlbumsResponse {
  topalbums?: { album: Array<{ name: string }> };
}

interface LastfmTagsResponse {
  toptags?: { tag: Array<{ name: string; count: string }> };
}

interface MusicBrainzSearchResponse {
  artists?: Array<{ id: string; name: string; score: number }>;
}

interface MusicBrainzArtistResponse {
  genres?: Array<{ name: string }>;
  'release-groups'?: Array<{ title: string }>;
}

// ─── Cache ────────────────────────────────────────────────

function getCached(artistName: string): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + artistName);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return null;
}

function setCache(artistName: string, genres: string[]): void {
  try {
    localStorage.setItem(CACHE_PREFIX + artistName, JSON.stringify(genres));
  } catch {
    /* localStorage full or unavailable */
  }
}

// ─── API helpers ──────────────────────────────────────────

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': WIKIDATA_UA, ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sparqlQuery(query: string): Promise<unknown> {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': WIKIDATA_UA,
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'query=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}`);
  return res.json();
}

async function searchWikidata(query: string): Promise<Array<{ id: string }>> {
  const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=10&format=json&origin=*`;
  const data = (await fetchJson(url)) as WikidataSearchResponse;
  return data.search || [];
}

async function fetchLastfmAlbums(artistName: string, apiKey: string): Promise<string[]> {
  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(artistName)}&api_key=${apiKey}&format=json&limit=10`;
  const data = (await fetchJson(url)) as LastfmAlbumsResponse;
  return (data.topalbums?.album || []).map((a) => a.name).filter((n) => n && n !== '(null)');
}

async function fetchLastfmTags(artistName: string, apiKey: string): Promise<string[]> {
  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(artistName)}&api_key=${apiKey}&format=json`;
  const data = (await fetchJson(url)) as LastfmTagsResponse;
  return (data.toptags?.tag || [])
    .filter((t) => parseInt(t.count) >= 25)
    .slice(0, 5)
    .map((t) => t.name);
}

// ─── Tier 1: Wikidata batch lookup ───────────────────────

async function wikidataBatchLookup(artists: Array<{ name: string; albums: string[] }>): Promise<{
  found: Record<string, string[]>;
  needsFallback: Array<{ name: string; albums: string[]; reason: string }>;
}> {
  const found: Record<string, string[]> = {};
  const needsFallback: Array<{ name: string; albums: string[]; reason: string }> = [];

  // Build search variants per artist
  const searchVariants = artists.map((a) => {
    const variants = [a.name];
    const normalized = normalizeForSearch(a.name);
    if (normalized !== a.name) variants.push(normalized);
    if (a.name.length <= 4) {
      variants.push(a.name + ' musician');
      variants.push(a.name + ' rapper');
    }
    return { ...a, variants };
  });

  // Parallel wbsearchentities
  const searchResults = await Promise.all(
    searchVariants.flatMap((sv) =>
      sv.variants.map(async (v) => {
        const results = await searchWikidata(v);
        return { artistName: sv.name, results };
      }),
    ),
  );

  // Collect candidates per artist
  const candidatesPerArtist: Record<string, Set<string>> = {};
  for (const { artistName, results } of searchResults) {
    if (!candidatesPerArtist[artistName]) candidatesPerArtist[artistName] = new Set();
    for (const r of results) candidatesPerArtist[artistName].add(r.id);
  }

  // All unique entity IDs
  const allEntityIds = new Set<string>();
  for (const ids of Object.values(candidatesPerArtist)) {
    for (const id of ids) allEntityIds.add(id);
  }

  if (allEntityIds.size === 0) {
    for (const a of artists) needsFallback.push({ ...a, reason: 'not_found' });
    return { found, needsFallback };
  }

  // Batch SPARQL for types, occupations, genres, sitelinks
  const ids = [...allEntityIds].map((id) => 'wd:' + id).join(' ');
  const sparql = `SELECT ?item ?itemLabel ?typeLabel ?occupationLabel ?genreLabel ?sitelinks WHERE {
    VALUES ?item { ${ids} }
    OPTIONAL { ?item wdt:P31 ?type . }
    OPTIONAL { ?item wdt:P106 ?occupation . }
    OPTIONAL { ?item wdt:P136 ?genre . }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  const sparqlData = (await sparqlQuery(sparql)) as SparqlResponse<EntitySparqlBinding>;

  // Parse entities
  const entities: Record<string, WikidataEntity> = {};
  for (const row of sparqlData.results.bindings) {
    const id = row.item.value.split('/').pop()!;
    if (!entities[id]) {
      entities[id] = {
        id,
        label: row.itemLabel?.value || '',
        types: new Set(),
        occupations: new Set(),
        genres: new Set(),
        sitelinks: 0,
      };
    }
    const e = entities[id];
    if (row.typeLabel?.value) e.types.add(row.typeLabel.value);
    if (row.occupationLabel?.value) e.occupations.add(row.occupationLabel.value);
    if (row.genreLabel?.value) e.genres.add(row.genreLabel.value);
    if (row.sitelinks?.value) e.sitelinks = Math.max(e.sitelinks, parseInt(row.sitelinks.value));
  }

  // Discography check for ambiguous candidates
  const needsDisambig: string[] = [];
  const disambigEntityIds = new Set<string>();
  for (const a of artists) {
    const cIds = candidatesPerArtist[a.name] || new Set();
    const musicWithGenres = [...cIds]
      .map((id) => entities[id])
      .filter((e) => e && e.genres.size > 0 && isMusicRelated(e.types, e.occupations));
    if (musicWithGenres.length > 1) {
      needsDisambig.push(a.name);
      for (const c of musicWithGenres) disambigEntityIds.add(c.id);
    }
  }

  const discographies: Record<string, string[]> = {};
  if (disambigEntityIds.size > 0) {
    const BATCH = 15;
    const eidList = [...disambigEntityIds];
    for (let i = 0; i < eidList.length; i += BATCH) {
      const batch = eidList.slice(i, i + BATCH);
      const values = batch.map((id) => 'wd:' + id).join(' ');
      const dSparql = `SELECT ?performer ?workLabel WHERE {
        VALUES ?performer { ${values} }
        ?work wdt:P175 ?performer .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 200`;
      try {
        const data = (await sparqlQuery(dSparql)) as SparqlResponse<DiscographySparqlBinding>;
        for (const row of data.results.bindings) {
          const id = row.performer.value.split('/').pop()!;
          if (!discographies[id]) discographies[id] = [];
          discographies[id].push(row.workLabel?.value || '');
        }
      } catch {
        /* batch error, skip */
      }
    }
  }

  // Pick best entity per artist
  const albumsByArtist: Record<string, string[]> = {};
  for (const a of artists) albumsByArtist[a.name] = a.albums;

  for (const a of artists) {
    const cIds = candidatesPerArtist[a.name] || new Set();
    const isAmbiguous = needsDisambig.includes(a.name);

    const ranked: RankedCandidate[] = [...cIds]
      .map((id) => entities[id])
      .filter((e): e is WikidataEntity => !!e && isMusicRelated(e.types, e.occupations))
      .map((e) => {
        let score = (e.genres.size > 0 ? 5 : 0) + Math.min(e.sitelinks / 20, 10);
        const similarity = nameSimilarity(a.name, e.label);
        let albumMatches = 0;

        if (isAmbiguous && a.albums.length > 0) {
          albumMatches = albumMatchScore(discographies[e.id] || [], a.albums);
          score += albumMatches * 15;
        }
        score += similarity * 5;

        return { ...e, score, albumMatches, similarity };
      })
      .sort((x, y) => y.score - x.score);

    const best = ranked[0];

    if (!best || best.genres.size === 0) {
      needsFallback.push({ ...a, reason: 'not_found' });
    } else if (isAmbiguous && best.albumMatches === 0) {
      needsFallback.push({ ...a, reason: 'ambiguous' });
    } else if (best.similarity < 0.7) {
      needsFallback.push({ ...a, reason: 'name_mismatch' });
    } else if (best.sitelinks < 5 && best.similarity < 1.0) {
      needsFallback.push({ ...a, reason: 'low_notability' });
    } else {
      found[a.name] = [...best.genres];
    }
  }

  return { found, needsFallback };
}

// ─── Tier 2+3: MusicBrainz + Last.fm fallback ────────────

async function musicbrainzFallback(
  artists: Array<{ name: string; albums: string[] }>,
  apiKey: string,
  onResolved?: (name: string, genres: string[]) => void,
  onProgress?: (name: string, reqNum: number) => void,
  onArtistDone?: (name: string) => void,
): Promise<Record<string, string[]>> {
  const found: Record<string, string[]> = {};

  for (const artist of artists) {
    let req = 0;
    onProgress?.(artist.name, req);
    await new Promise((r) => setTimeout(r, 1100));
    try {
      const sUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist.name)}&fmt=json&limit=15`;
      const sRes = await fetch(sUrl, { headers: { 'User-Agent': 'LastWave/4.0' } });
      const sData = (await sRes.json()) as MusicBrainzSearchResponse;
      onProgress?.(artist.name, ++req);

      let bestMatch: {
        name: string;
        genres: string[];
        albumHits: number;
        sim: number;
        fromLastfm?: boolean;
      } | null = null;

      for (const mbArtist of (sData.artists || []).filter((a) => a.score >= 60)) {
        const sim = nameSimilarity(artist.name, mbArtist.name);
        if (sim < 0.5) continue;

        await new Promise((r) => setTimeout(r, 1100));
        const lUrl = `https://musicbrainz.org/ws/2/artist/${mbArtist.id}?inc=genres+release-groups&fmt=json`;
        const lRes = await fetch(lUrl, { headers: { 'User-Agent': 'LastWave/4.0' } });
        const lData = (await lRes.json()) as MusicBrainzArtistResponse;
        onProgress?.(artist.name, ++req);
        const genres = (lData.genres || []).map((g) => g.name);
        const mbAlbums = (lData['release-groups'] || []).map((rg) => rg.title);
        const albumHits = albumMatchScore(mbAlbums, artist.albums);

        if (genres.length > 0) {
          if (albumHits >= 2) {
            bestMatch = { name: mbArtist.name, genres, albumHits, sim };
            break;
          } else if (!bestMatch && sim >= 0.9) {
            bestMatch = { name: mbArtist.name, genres, albumHits, sim };
          }
        } else if (albumHits >= 3 && sim >= 0.9) {
          try {
            const tags = await fetchLastfmTags(artist.name, apiKey);
            onProgress?.(artist.name, ++req);
            if (tags.length > 0) {
              bestMatch = { name: mbArtist.name, genres: tags, albumHits, sim, fromLastfm: true };
              break;
            }
          } catch {
            /* skip */
          }
        }
      }

      if (bestMatch) {
        found[artist.name] = bestMatch.genres;
        onResolved?.(artist.name, bestMatch.genres);
      }
    } catch {
      /* skip artist */
    }

    onArtistDone?.(artist.name);
  }

  return found;
}

// ─── Main entry point ────────────────────────────────────

export interface GenreLookupResult {
  /** Map of artist name → genre list */
  genres: Record<string, string[]>;
  /** Number found from cache */
  cachedCount: number;
  /** Number found from Wikidata */
  wikidataCount: number;
  /** Number found from MusicBrainz */
  musicbrainzCount: number;
  /** Artists with no genres found */
  missing: string[];
}

/**
 * Look up genres for a list of artist names.
 * Uses localStorage cache, then Wikidata batch, then MusicBrainz fallback.
 *
 * @param artistNames - List of artist names to look up
 * @param apiKey - Last.fm API key (for album fetching and tag fallback)
 * @param onArtistResolved - Called each time an artist's genres are found: (name, genres)
 * @param onProgress - Called on progress: (resolvedArtists, totalArtists, requestCount)
 */
export async function lookupGenres(
  artistNames: string[],
  apiKey: string,
  onArtistResolved?: (name: string, genres: string[]) => void,
  onProgress?: (resolved: number, total: number, currentArtist: string) => void,
): Promise<GenreLookupResult> {
  const genres: Record<string, string[]> = {};
  let cachedCount = 0;
  const total = artistNames.length;
  let currentArtist = '';

  const setCurrentArtist = (name: string) => {
    currentArtist = name;
    onProgress?.(resolved, total, currentArtist);
  };

  // Step 1: Check cache
  const uncached: string[] = [];
  for (const name of artistNames) {
    const cached = getCached(name);
    if (cached) {
      genres[name] = cached;
      cachedCount++;
      onArtistResolved?.(name, cached);
    } else {
      uncached.push(name);
    }
  }

  let resolved = cachedCount;
  onProgress?.(resolved, total, '');

  if (uncached.length === 0) {
    return { genres, cachedCount, wikidataCount: 0, musicbrainzCount: 0, missing: [] };
  }

  // Step 2: Fetch Last.fm albums for all uncached artists (needed for disambiguation)
  const albumResults = await Promise.all(
    uncached.map(async (name) => {
      setCurrentArtist(name);
      try {
        const albums = await fetchLastfmAlbums(name, apiKey);
        return { name, albums };
      } catch {
        return { name, albums: [] as string[] };
      }
    }),
  );

  const artistsWithAlbums = albumResults.map((r) => ({ name: r.name, albums: r.albums }));

  // Step 3: Wikidata batch lookup
  const wdResult = await wikidataBatchLookup(artistsWithAlbums);
  let wikidataCount = 0;

  for (const [name, genreList] of Object.entries(wdResult.found)) {
    genres[name] = genreList;
    setCache(name, genreList);
    wikidataCount++;
    resolved++;
    onArtistResolved?.(name, genreList);
  }

  // Step 4: MusicBrainz fallback for remaining artists
  let musicbrainzCount = 0;
  if (wdResult.needsFallback.length > 0) {
    const mbResult = await musicbrainzFallback(
      wdResult.needsFallback,
      apiKey,
      (name, genreList) => {
        onArtistResolved?.(name, genreList);
      },
      (name, reqNum) => {
        currentArtist = reqNum > 0 ? `${name} ${reqNum}` : name;
        onProgress?.(resolved, total, currentArtist);
      },
      (_name) => {
        resolved++;
        onProgress?.(resolved, total, currentArtist);
      },
    );

    for (const [name, genreList] of Object.entries(mbResult)) {
      genres[name] = genreList;
      setCache(name, genreList);
      musicbrainzCount++;
    }
  }

  const missing = artistNames.filter((n) => !genres[n]);

  return { genres, cachedCount, wikidataCount, musicbrainzCount, missing };
}
