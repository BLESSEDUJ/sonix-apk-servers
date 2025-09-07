import axios from 'axios';

const isFriendEnabled = true;

function extractSubjectId(html, movieTitle) {
  const regex = new RegExp(`"(\\d{16,})",\\s*"[^"]*",\\s*"${movieTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractDetailPathFromHtml(html, subjectId, movieTitle) {
  const slug = movieTitle
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-';

  const idPattern = new RegExp(`"(${subjectId})"`);
  const idMatch = idPattern.exec(html);
  if (!idMatch) return null;
  const before = html.substring(0, idMatch.index);
  const detailPathRegex = new RegExp(`"((?:${slug})[^"]+)"`, 'gi');
  let match, lastMatch = null;
  while ((match = detailPathRegex.exec(before)) !== null) {
    lastMatch = match[1];
  }
  return lastMatch;
}

export default async (req, res) => {
  const { tmdbId, header } = req.query;
  const TMDB_API_KEY = process.env.TMDB_API_KEY || '1e2d76e7c45818ed61645cb647981e5c';

  const heading = header === '02movie' ? '02MOVIE' : 'SONiX MOVIES LTD';

  // 🔒 Restrict 02movie access if not enabled
  if (header === '02movie' && !isFriendEnabled) {
    return res.status(403).json({
      success: false,
      heading,
      message: 'Access denied: 02movie is currently disabled',
    });
  }

  if (!tmdbId) {
    console.log('❌ Missing tmdbId');
    return res.status(400).json({ success: false, heading, error: 'Missing tmdbId' });
  }

  try {
    console.log('🔎 Fetching TMDb info for:', tmdbId);
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.title;
    const year = tmdbResp.data.release_date?.split('-')[0];
    console.log('🎬 Title:', title, '| Year:', year);

    const searchKeyword = `${title} ${year}`;
    const searchUrl = `https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent(searchKeyword)}`;
    console.log('🌐 Search URL:', searchUrl);

    const searchResp = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = searchResp.data;
    console.log('📄 HTML fetched, length:', html.length);

    const subjectId = extractSubjectId(html, title);
    console.log('🆔 subjectId:', subjectId);
    if (!subjectId) {
      return res.status(404).json({ success: false, heading, error: '❌ subjectId not found in HTML' });
    }

    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? `https://moviebox.ph/movies/${detailPath}?id=${subjectId}` : null;
    console.log('🔗 detailsUrl:', detailsUrl);

    const downloadUrl = `https://moviebox.ph/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;
    console.log('⬇️ Download URL:', downloadUrl);

    const downloadResp = await axios.get(downloadUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
        'referer': detailsUrl
      }
    });

    console.log('✅ Download data fetched.');

    return res.json({
      success: true,
      heading,
      title,
      year,
      downloadData: downloadResp.data
    });

  } catch (err) {
    console.error('❌ Server error:', err.message);
    res.status(500).json({ success: false, heading, error: err.message });
  }
};
