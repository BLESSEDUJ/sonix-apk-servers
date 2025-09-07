import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const TMDB_API_KEY = '1e2d76e7c45818ed61645cb647981e5c'; // Move to env var in production

// Normalize title
function cleanTitle(title) {
  return title
    .replace(/[\u2018\u2019]/g, "'")         // Normalize apostrophes
    .replace(/\band\b/gi, '&')              // Normalize "and" to "&"
    .replace(/\bcomple?t[e]?\b/gi, '')      // Remove "complete", "complate", etc.
    .replace(/[\[\]\(\)]/g, '')             // Remove brackets
    .replace(/[^a-zA-Z0-9]/g, '')           // Remove all non-alphanumerics
    .toLowerCase()
    .trim();
}

// Generate season patterns
function getSeasonPatterns(season) {
  const n = parseInt(season);
  const padded = n.toString().padStart(2, '0');
  return [`s${n}`, `s${padded}`, `season ${n}`, `season${padded}`, `s${n}e`, `s${padded}e`];
}

// Check if a title includes a season number
function includesTargetSeason(title, season) {
  const regex = new RegExp(`s0*${season}(\\D|$)`, 'i'); // Matches s1, s01, etc.
  return regex.test(title);
}

// Resolve real download link from downloadwella.com
async function getRealDownloadLink(postUrl) {
  if (!/^https?:\/\/(www\.)?downloadwella\.com/i.test(postUrl)) {
    return postUrl;
  }

  try {
    const pageRes = await axios.get(postUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://series.clipsave.ng/',
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    const $ = cheerio.load(pageRes.data);
    const form = $('form[method="POST"]');

    const formData = new URLSearchParams();
    formData.append('op', form.find('input[name="op"]').val() || 'download1');
    formData.append('id', form.find('input[name="id"]').val() || '');
    formData.append('rand', form.find('input[name="rand"]').val() || '');
    formData.append('referer', form.find('input[name="referer"]').val() || '');
    formData.append('method_free', form.find('input[name="method_free"]').val() || '');
    formData.append('method_premium', form.find('input[name="method_premium"]').val() || '');

    const response = await axios.post(postUrl, formData.toString(), {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://series.clipsave.ng',
        'Referer': 'https://series.clipsave.ng/',
        'User-Agent': 'Mozilla/5.0',
      },
      maxRedirects: 0,
      validateStatus: status => status === 302,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    const finalUrl = response.headers.location;
    return finalUrl || null;
  } catch (error) {
    return null;
  }
}

// Main API handler
export default async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id, season, episode } = req.query;

    if (!id || !season || !episode) {
      return res.status(400).json({ error: 'Missing TMDb id, season, or episode' });
    }

    const tmdbRes = await axios.get(
      `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`,
      { timeout: 10000 }
    );

    const tmdbTitle = tmdbRes.data?.name || '';
    const normalizedTmdbTitle = cleanTitle(tmdbTitle);
    const paddedSeason = parseInt(season).toString().padStart(2, '0');
    const searchTitle = `${tmdbTitle} S${paddedSeason}`;

    const searchUrl = `https://clipsave-movies-api.onrender.com/v1/series/search?query=${encodeURIComponent(searchTitle)}`;
    const clipsaveRes = await axios.get(searchUrl, { timeout: 10000 });
    const results = clipsaveRes.data?.data?.movies || [];

    const looseMatches = results.filter(movie => {
      const cleaned = cleanTitle(movie.title);
      return cleaned.includes(normalizedTmdbTitle);
    });

    const bestMatch = looseMatches.find(movie =>
      includesTargetSeason(movie.title, season)
    );

    if (!bestMatch) {
      return res.status(404).json({
        tmdb_id: id,
        tmdb_title: tmdbTitle,
        search_query: searchTitle,
        error: 'No matching season title found'
      });
    }

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
    return res.status(500).json({ error: 'Internal server error', details: err.message || err });
  }
};
