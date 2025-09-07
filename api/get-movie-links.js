import fetch from 'node-fetch';

const TMDB_API_KEY = '1e2d76e7c45818ed61645cb647981e5c';
const isFriendEnabled = true;

function cleanTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  const { tmdbId, header } = req.query;
  const heading = header === '02movie' ? '02MOVIE' : 'SONiX MOVIES LTD';

  if (!tmdbId) {
    return res.status(400).json({ success: false, heading, message: '"tmdbId" parameter is required' });
  }

  if (header === '02movie' && !isFriendEnabled) {
    return res.status(403).json({ success: false, heading, message: 'Access denied: 02movie is currently disabled' });
  }

  // TV Show
  if (tmdbId.includes('/')) {
    const [tvId, season, episode] = tmdbId.split('/');
    try {
      const tvRes = await fetch(`https://sonix-movies-v4.vercel.app/cosmic/${tvId}/${season}/${episode}`);
      const tvData = await tvRes.json();

      return res.status(200).json({
        heading,
        success: true,
        title: tvData.title,
        name: tvData.name,
        streams: tvData.streams || [],
      });
    } catch (err) {
      return res.status(500).json({ success: false, heading, message: 'TV fetch failed', error: err.message });
    }
  }

  // Movie
  try {
    const tmdbResp = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const tmdbData = await tmdbResp.json();
    const imdbId = tmdbData.imdb_id;
    const title = tmdbData.title;

    if (!imdbId || !title) {
      return res.status(404).json({ success: false, heading, message: 'Movie not found on TMDb' });
    }

    // Fire subtitle request early
    const subtitlePromise = fetch(`https://sonix-subtitle.vercel.app/api/subtitle?tmdbId=${tmdbId}`)
      .then((r) => r.json())
      .catch(() => null); // subtitle fetch must not block

    const cleanedTitle = cleanTitle(title);
    const searchRes = await fetch(`https://sonix-apk-servers.vercel.app/api/search?query=${encodeURIComponent(cleanedTitle)}`);
    const searchData = await searchRes.json();
    const matched = searchData?.results?.data?.find((m) => m.id === imdbId);

    if (!matched) throw new Error('No match on Sonix');

    const infoRes = await fetch(`https://clipsave-movies-api.onrender.com/v1/movies/info?link=${encodeURIComponent(matched.link)}&id=${imdbId}`);
    const infoData = await infoRes.json();

    if (!infoData.success || !infoData.data) throw new Error('No info on Clipsave');

    const qualities = infoData.data.qualities || [];
    const cleanQualities = await Promise.all(
      qualities.map(async (q) => {
        const dlRes = await fetch(`https://clipsave-movies-api.onrender.com/v1/movies/download-links?link=${encodeURIComponent(q.link)}`);
        const dlData = await dlRes.json();
        return {
          quality: q.quality,
          name: q.name,
          size: q.size,
          links: {
            first: dlData?.data?.[0]?.downloadLink || null,
            second: dlData?.data?.[1]?.downloadLink || null,
            third: dlData?.data?.[2]?.downloadLink || null,
          },
        };
      })
    );

    const subtitles = await subtitlePromise; // Wait for subtitle fetch before returning

    return res.status(200).json({
      heading,
      success: true,
      qualities: cleanQualities,
      subtitles: subtitles || null,
    });
  } catch (err) {
    try {
      const fallbackRes = await fetch(`https://sonix-movies-v4.vercel.app/cosmic/${tmdbId}`);
      const fallbackData = await fallbackRes.json();

      if (!fallbackData || !fallbackData.streams?.length) {
        throw new Error('Cosmic fallback failed');
      }

      return res.status(200).json({
        heading,
        success: true,
        name: fallbackData.name,
        title: fallbackData.title || 'Untitled',
        size: fallbackData.size || null,
        streams: fallbackData.streams,
      });
    } catch (fallbackErr) {
      return res.status(500).json({
        success: false,
        heading,
        message: 'All sources failed',
        error: fallbackErr.message,
      });
    }
  }
}
