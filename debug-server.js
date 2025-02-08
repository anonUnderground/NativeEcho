require('dotenv').config();  // Load variables from .env when available

const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { getSubtitles } = require('youtube-captions-scraper');
const { HttpsProxyAgent } = require('https-proxy-agent');


const app = express();

// Load environment variables
const API_KEY = process.env.YOUTUBE_API_KEY;
const GAIA_AUTH = process.env.GAIA_AUTH;
const RESIDENTIAL_PROXY = process.env.RESIDENTIAL_PROXY; // Proxy URL (e.g., "http://user:pass@proxy.evomi.com:PORT")

if (!API_KEY) {
  console.error("Error: YouTube API key not found in environment variables.");
  process.exit(1);
}

if (!GAIA_AUTH) {
  console.error("Error: Gaia auth key not found in environment variables.");
  process.exit(1);
}

if (!RESIDENTIAL_PROXY) {
  console.error("Error: Residential proxy URL not found in environment variables.");
  process.exit(1);
}

// Configure proxy agent
const proxyAgent = new HttpsProxyAgent(RESIDENTIAL_PROXY);

// Realistic browser headers to mimic normal traffic
const realisticHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.youtube.com/",
  "DNT": "1", // Do Not Track
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0"
};

// Middleware to parse JSON and URL-encoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Extract YouTube video ID from URL
 */
function getVideoId(youtubeUrl) {
  let id;
  if (youtubeUrl.includes("watch?v=")) {
    id = youtubeUrl.split("watch?v=")[1].split("&")[0];
  } else if (youtubeUrl.includes("youtu.be/")) {
    id = youtubeUrl.split("youtu.be/")[1].split("?")[0];
  } else if (youtubeUrl.includes("shorts/")) {
    id = youtubeUrl.split("shorts/")[1].split("?")[0]; // Handle YouTube Shorts
  } else {
    throw new Error("Invalid YouTube URL");
  }
  
  console.log(`Extracted video id: ${id} from URL: ${youtubeUrl}`);
  return id;
}

/**
 * Retrieve captions using youtube-captions-scraper via Proxy
 */
async function getCaptionsWithProxy(videoId, lang = 'en') {
  console.log(`Using proxy to fetch subtitles for video: ${videoId} in language: ${lang}`);

  try {
    const captions = await getSubtitles({
      videoID: videoId,
      lang: lang
    });
    console.log(`Fetched ${captions.length} captions for video ${videoId}`);
    return captions;
  } catch (error) {
    console.error("Error fetching captions via scraper:", error);

    // Alternative: Try fetching captions manually through the proxy
    const captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
    
    try {
      const response = await fetch(captionUrl, {
        method: "GET",
        agent: proxyAgent,
        headers: realisticHeaders
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch captions. Status: ${response.status}`);
      }

      const captionsData = await response.json();
      console.log("Fetched captions via direct API:", captionsData);
      return captionsData;
    } catch (proxyError) {
      console.error("Error fetching captions via proxy:", proxyError);
      return { error: proxyError.message };
    }
  }
}

/**
 * Debug Endpoint: /debug-proxy
 *  - Fetches captions using a residential proxy.
 */
app.post('/debug-proxy', async (req, res) => {
  const videoId = req.body.video_id;
  const lang = req.body.lang || 'en';
  console.log(`Debug-proxy: Fetching subtitles for video: ${videoId} using proxy`);

  try {
    const captions = await getCaptionsWithProxy(videoId, lang);
    res.json({ video_id: videoId, lang, captions });
  } catch (error) {
    console.error("Debug-proxy: Error fetching captions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});