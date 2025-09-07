import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const query = req.query.title;
  if (!query) return res.status(400).json({ error: 'Query parameter "title" is required' });

  try {
    const response = await fetch(`https://tubidy.rocks/search/${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to fetch from Tubidy');
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.card').each((_, el) => {
      const a = $(el).find('a');
      const link = a.attr('href');
      const title = a.find('h3').text().trim();
      const img = a.find('img.lozad, img.img-fluid').first();
      const imgUrl = img.attr('data-src') || img.attr('src') || null;
      if (link && title && imgUrl) {
        results.push({
          title,
          link,
          img: imgUrl
        });
      }
    });

    res.status(200).json(results.slice(0, 10));
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong while fetching or parsing Tubidy search results' });
  }
}