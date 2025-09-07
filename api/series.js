import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const TMDB_API_KEY = '1e2d76e7c45818ed61645cb647981e5c';

// Friend control toggle
const isFriendEnabled = false; // Set to false to block 02movie

// Normalize title
function cleanTitle(title) {
  return title.replace(/[\u2018\u2019]/g, "'").replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
}

// Get season patterns
function getSeasonPatterns(season) {
  const n = parseInt(season);
  const padded = n.toString().padStart(2, '0');
  return [`s${n}`, `s${padded}`, `season ${n}`, `season${padded}`, `s${n}e`, `s${padded}e`];
}

// Resolve real download link from downloadwella.com
async function getRealDownloadLink(postUrl) {
  // If the link is NOT from downloadwella.com, return as is
  if (!/^https?:\/\/(www\.)?downloadwella\.com/i.test(postUrl)) {
    console.log('Non-downloadwella link, returning as is.');
    return postUrl;
  }
  try {
    console.log('Resolving real download link:', postUrl);
    const pageRes = await axios.get(postUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': 'https://series.clipsave.ng/',
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const $ = cheerio.load(pageRes.data);
    const form = $('form[method="POST"]');

    const op = form.find('input[name="op"]').val() || 'download1';
    const id = form.find('input[name="id"]').val() || '';
    const rand = form.find('input[name="rand"]').val() || '';
    const referer = form.find('input[name="referer"]').val() || '';
    const method_free = form.find('input[name="method_free"]').val() || '';
    const method_premium = form.find('input[name="method_premium"]').val() || '';

    const formData = new URLSearchParams();
    formData.append('op', op);
    formData.append('id', id);
    formData.append('rand', rand);
    formData.append('referer', referer);
    formData.append('method_free', method_free);
    formData.append('method_premium', method_premium);

    const response = await axios.post(postUrl, formData.toString(), {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://series.clipsave.ng',
        'Referer': 'https://series.clipsave.ng/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      },
      maxRedirects: 0,
      validateStatus: status => status === 302,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    // Log response status and headers
    console.log('POST response status:', response.status);
    console.log('POST response headers:', response.headers);

    const finalUrl = response.headers.location;
    if (!finalUrl) {
      console.error('No redirect location found in POST response.');
      return null;
    }
    console.log('Resolved download link:', finalUrl);
    return finalUrl;
  } catch (error) {
    console.error('Error resolving download link:', error.message, error.response?.data);
    return null;
  }
}

// Main API handler
export default async (req, res) => {
  // Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Friend control logic
  const { header } = req.query;
  const heading = header === '02movie' ? '02MOVIE' : 'SONiX MOVIES LTD';
  if (header === '02movie' && !isFriendEnabled) {
    return res.status(403).json({
      success: false,
      heading,
      message: 'Access denied: 02movie is currently disabled'
    });
  }

  try {
    const { id, season, episode } = req.query;

    if (!id || !season || !episode) {
      return res.status(400).json({ error: 'Missing TMDb id, season, or episode' });
    }

    console.log('Fetching TMDB title...');
    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`, { timeout: 10000 });
    const tmdbTitle = tmdbRes.data?.name || '';
    const normalizedTmdbTitle = cleanTitle(tmdbTitle);
    const seasonPatterns = getSeasonPatterns(season);
    const paddedSeason = parseInt(season).toString().padStart(2, '0');
    const searchTitle = `${tmdbTitle} S${paddedSeason}`;

    console.log('Searching ClipSave...');
    const searchUrl = `https://clipsave-movies-api.onrender.com/v1/series/search?query=${encodeURIComponent(searchTitle)}`;
    const clipsaveRes = await axios.get(searchUrl, { timeout: 10000 });
    const results = clipsaveRes.data?.data?.movies || [];

    const looseMatches = results.filter(movie => {
      const cleaned = cleanTitle(movie.title);
      return cleaned.startsWith(normalizedTmdbTitle);
    });

    const bestMatch = looseMatches.find(movie => {
      const rawTitle = movie.title.toLowerCase();
      return seasonPatterns.some(pattern => rawTitle.includes(pattern));
    });

    if (!bestMatch) {
      return res.status(404).json({
        tmdb_id: id,
        tmdb_title: tmdbTitle,
        search_query: searchTitle,
        error: 'No matching season title found'
      });
    }

    console.log('Fetching episode details...');
    const detailUrl = `https://clipsave-movies-api.onrender.com/v1/series/details?link=${encodeURIComponent(bestMatch.link)}`;
    const detailRes = await axios.get(detailUrl, { timeout: 10000 });
    const episodes = detailRes.data?.data?.downloadDetails || [];

    const episodeLabel = `episode ${parseInt(episode)}`;
    const foundEpisode = episodes.find(ep => ep.name.toLowerCase() === episodeLabel);

    if (!foundEpisode) {
      return res.status(404).json({
        tmdb_id: id,
        tmdb_title: tmdbTitle,
        matched_title: bestMatch.title,
        season,
        episode,
        error: `Episode ${episode} not found`
      });
    }

    console.log('Resolving real download link...');
    const realDownload = await getRealDownloadLink(foundEpisode.link);

    if (!realDownload) {
      return res.status(500).json({ error: 'Failed to resolve final download link' });
    }

    return res.json({
      tmdb_id: id,
      tmdb_title: tmdbTitle,
      matched_title: bestMatch.title,
      season,
      episode: foundEpisode.name,
      size: detailRes.data?.data?.size || 'N/A',
      quality: '480p',
      download: realDownload
    });

  } catch (err) {
    console.error('API Error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error', details: err.message || err });
  }
};
