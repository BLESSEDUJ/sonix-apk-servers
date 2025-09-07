import request from 'request';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).send('Missing url');

  // Use headers similar to the browser request
  const headers = {
    'Referer': 'https://fmoviesunblocked.net/spa/videoPlayPage/movies/the-amateur-uD0mYexJSs3?id=2908887247384723616&type=/movie/detail',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-GB,en;q=0.9,fa-IR;q=0.8,fa;q=0.7,en-US;q=0.6',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    // You can add more headers if needed
  };

  request
    .get({ url: decodeURIComponent(url), headers })
    .on('response', (response) => {
      // Forward Content-Disposition and Content-Type if present
      if (response.headers['content-disposition']) {
        res.setHeader('Content-Disposition', response.headers['content-disposition']);
      } else {
        res.setHeader('Content-Disposition', 'attachment; filename=movie.mp4');
      }
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'video/mp4');
      }
      // Optionally forward content-length
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
    })
    .on('error', () => {
      res.status(500).send('Error downloading file');
    })
    .pipe(res);
}
