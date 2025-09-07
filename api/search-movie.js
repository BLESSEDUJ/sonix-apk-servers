// api/search-movie.js

export default async function handler(req, res) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ success: false, message: '"query" parameter is required' });
  }

  try {
    const response = await fetch('https://clipsave-movies-api.onrender.com/v1/movies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Token is optional, but add here if you have one:
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    return res.status(200).json({ success: true, results: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}
