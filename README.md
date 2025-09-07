# Sonix APK Servers API Usage Guide

Base URL: `https://sonix-apk-servers.vercel.app`

This guide describes how to call each API endpoint found in the `api` directory.

---

## 1. `/api/download-proxy`

**Purpose:** Proxy downloads from a provided URL, forwarding headers.

**Method:** GET  
**Parameters:**
- `url` (required): The file URL to proxy and download.

**Example:**
```
GET https://sonix-apk-servers.vercel.app/api/download-proxy?url=https%3A%2F%2Fexample.com%2Ffile.mp4
```

---

## 2. `/api/download`

**Purpose:** Fetches movie download information from TMDb and MovieBox.

**Method:** GET  
**Parameters:**
- `tmdbId` (required): Movie TMDb ID.
- `header` (optional): If set to `'02movie'`, applies friend control.

**Example:**
```
GET https://sonix-apk-servers.vercel.app/api/download?tmdbId=123456
```

---

## 3. `/api/get-movie-links`

**Purpose:** Gets streaming/download links for a movie or TV show.

**Method:** GET  
**Parameters:**
- `tmdbId` (required): TMDb ID for the movie or TV show. For TV, format as `tvId/season/episode`
- `header` (optional): `'02movie'` or default.

**Example (movie):**
```
GET https://sonix-apk-servers.vercel.app/api/get-movie-links?tmdbId=123456
```

**Example (TV show):**
```
GET https://sonix-apk-servers.vercel.app/api/get-movie-links?tmdbId=654321/1/2
```

---

## 4. `/api/music-download-url`

**Purpose:** Fetches video/music metadata and download links from Tubidy.

**Method:** GET  
**Parameters:**
- `url` (required): Direct URL to the Tubidy track/video page.

**Example:**
```
GET https://sonix-apk-servers.vercel.app/api/music-download-url?url=https%3A%2F%2Ftubidy.rocks%2Ftrack%2F123
```

---

## 5. `/api/music-search`

**Purpose:** Searches for music tracks on Tubidy.

**Method:** GET  
**Parameters:**
- `title` (required): Search string for the track.

**Example:**
```
GET https://sonix-apk-servers.vercel.app/api/music-search?title=eminem+lose+yourself
```

---

## 6. `/api/search-movie`

**Purpose:** Searches movies using Clipsave Movies API.

**Method:** POST  
**Body:** JSON
- `query` (required): Movie name or search term.

**Example:**
```
POST https://sonix-apk-servers.vercel.app/api/search-movie
Content-Type: application/json

{
  "query": "Inception"
}
```

---

## 7. `/api/series`

**Purpose:** Fetches download links for a specific series episode.

**Method:** GET  
**Parameters:**
- `id` (required): TMDb series ID.
- `season` (required): Season number.
- `episode` (required): Episode number.
- `header` (optional): `'02movie'` or default.

**Example:**
```
GET https://sonix-apk-servers.vercel.app/api/series?id=53245&season=1&episode=2
```

---

## 8. `/api/tv`

**Purpose:** Fetches TV series episode download info from TMDb and MovieBox.

**Method:** GET  
**Parameters:**
- `tmdbId` (required): TMDb series ID.
- `season` (required): Season number.
- `episode` (required): Episode number.
- `header` (optional): `'02movie'` or default.

**Example:**
```
GET https://sonix-apk-servers.vercel.app/api/tv?tmdbId=53245&season=1&episode=2
```

---

## Notes

- All endpoints return JSON responses.
- For endpoints using `header=02movie`, access may be restricted.
- Some endpoints may require external API keys (see code for details).
- For more info, see the source code or visit [GitHub repo](https://github.com/BLESSEDUJ/sonix-apk-servers).
