import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const LASTFM_API_KEY = 'bb4d1b39396c39e57fe7084b33eea429';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userUrl = req.query.url;
  if (!userUrl) return res.status(400).json({ error: 'Query parameter "url" is required' });

  try {
    const response = await fetch(userUrl);
    if (!response.ok) throw new Error('Failed to fetch the provided URL');

    const html = await response.text();
    const $ = cheerio.load(html);

    const videoData = $('[data-video-data]').attr('data-video-data');
    if (!videoData) {
      return res.status(404).json({ error: 'data-video-data not found in the HTML' });
    }

    // Full raw title from HTML
    let fullTitle = $('title').first().text().trim();

    // Clean it up
    let cleanedTitle = fullTitle
      .replace(/^Download\s*/i, '')
      .replace(/\s*\|\s*Tubidy\s*$/i, '')
      .replace(/\s*\|.*$/i, '')
      .replace(/(\.mp3|\.mp4)$/i, '')
      .trim();

    // Remove noisy tags from track
    let track = cleanedTitle
      .replace(/\(official.*?\)/i, '')
      .replace(/\[official.*?\]/i, '')
      .replace(/lyrics video/i, '')
      .replace(/official video/i, '')
      .replace(/audio/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    let artist = null;

    const parts = cleanedTitle.split(' - ');
    if (parts.length === 2) {
      artist = parts[0].trim();
      track = parts[1].trim();

      // Clean again after splitting
      track = track
        .replace(/\(official.*?\)/i, '')
        .replace(/\[official.*?\]/i, '')
        .replace(/lyrics video/i, '')
        .replace(/official video/i, '')
        .replace(/audio/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const apiResponse = await fetch(`https://tubidy.rocks/get-video-data?data=${encodeURIComponent(videoData)}`);
    if (!apiResponse.ok) throw new Error('Failed to fetch video data from Tubidy');

    const apiResult = await apiResponse.json();

    // Last.fm similar
    let similar = [];

    if (artist && track && LASTFM_API_KEY) {
      const trackRes = await fetch(
        `http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json&limit=5`
      );
      const trackJson = await trackRes.json();

      similar = trackJson?.similartracks?.track?.map(t => `${t.artist.name} - ${t.name}`) || [];

      // Fallback to artist similarity
      if (similar.length === 0) {
        const fallbackRes = await fetch(
          `http://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_API_KEY}&format=json&limit=5`
        );
        const fallbackJson = await fallbackRes.json();
        similar = fallbackJson?.similarartists?.artist?.map(a => a.name) || [];
      }
    }

    return res.status(200).json({
      ...apiResult,
      title: fullTitle,
      artist: artist || null,
      track: track || null,
      similar
    });

  } catch (err) {
    res.status(500).json({ error: 'Something went wrong while fetching or parsing the provided URL' });
  }
}
