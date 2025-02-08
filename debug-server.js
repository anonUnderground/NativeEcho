require('dotenv').config();  // Load variables from .env

const express = require('express');
const path = require('path');
const fetch = require('node-fetch');  // We'll use node-fetch for our proxy endpoint
const { google } = require('googleapis');
const { getSubtitles } = require('youtube-captions-scraper');

const app = express();

// Use middleware to parse JSON and URL-encoded bodies.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" folder (for our debug HTML page)
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------
// FUNCTIONS FROM YOUR MAIN SERVER
// ----------------------

function getVideoId(youtubeUrl) {
  let id;
  if (youtubeUrl.includes("watch?v=")) {
    id = youtubeUrl.split("watch?v=")[1].split("&")[0];
    console.log(`Extracted video id: ${id} from URL: ${youtubeUrl}`);
    return id;
  } else if (youtubeUrl.includes("youtu.be/")) {
    id = youtubeUrl.split("youtu.be/")[1].split("?")[0];
    console.log(`Extracted video id: ${id} from URL: ${youtubeUrl}`);
    return id;
  } else {
    throw new Error("Invalid YouTube URL");
  }
}

async function getVideoDetails(videoId) {
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });

  const response = await youtube.videos.list({
    part: 'snippet,contentDetails,player,status',
    id: videoId
  });

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error(`No video found with ID: ${videoId}`);
  }

  const item = response.data.items[0];
  console.log("Retrieved video snippet:", item.snippet);
  return {
    video_id: videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    caption_status: item.contentDetails.caption,
    embed_html: item.player.embedHtml
  };
}

async function getCaptions(videoId, lang = 'en') {
  console.log(`Attempting to fetch subtitles for video: ${videoId} in language: ${lang}`);
  try {
    const captions = await getSubtitles({
      videoID: videoId,
      lang: lang
    });
    console.log(`Fetched ${captions.length} captions for video ${videoId}`);
    return captions;
  } catch (error) {
    console.error("Error fetching captions:", error);
    console.error(`Error details: videoId=${videoId}, language=${lang}, errorMessage=${error.message}, stack=${error.stack}`);
    // Return an empty array for consistent response format
    return [];
  }
}

// ----------------------
// END FUNCTIONS FROM MAIN SERVER
// ----------------------

// (Optional) You may still keep your /process endpoint for normal operation:
app.post('/process', async (req, res) => {
  const youtubeUrl = req.body.youtube_url;
  const language = req.body.language || 'en';
  console.log(`Processing YouTube URL: ${youtubeUrl} with language: ${language}`);
  try {
    const videoId = getVideoId(youtubeUrl);
    const videoDetails = await getVideoDetails(videoId);
    const captions = await getCaptions(videoId, language);
    res.json({ videoDetails, captions });
  } catch (err) {
    console.error("Error processing video:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// NEW PROXY ENDPOINT TO EMULATE LOCAL CONDITIONS
// ----------------------
// This endpoint accepts a query parameter "url" (which should be URL‑encoded)
// and uses node‑fetch (with extra headers) to fetch from YouTube. It then pipes the response back.

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }
  console.log("Proxy endpoint requested URL:", targetUrl);
  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.youtube.com/",
        // If you have a cookie string in your .env, include it:
        "Cookie": process.env.YOUTUBE_COOKIE || ""
      }
    });
    // Forward the status code and headers as needed.
    res.status(response.status);
    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });
    // Pipe the response body back to the client.
    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// END PROXY ENDPOINT
// ----------------------

// ----------------------
// DEBUG ENDPOINT THAT USES THE PROXY
// ----------------------
// This endpoint constructs a YouTube timedtext URL for auto-generated captions and
// then calls the /proxy endpoint to retrieve the data.
app.post('/debug-proxy', async (req, res) => {
  const videoId = req.body.video_id;
  const lang = req.body.lang || 'en';
  // Construct the basic timedtext URL (without dynamic parameters).
  // Note: The official timedtext endpoint requires many extra parameters to work reliably.
  // Here we try a simplified version.
  const ytUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr`;
  // URL-encode the target URL for the proxy.
  const encodedUrl = encodeURIComponent(ytUrl);
  // Construct the full proxy URL.
  const proxyUrl = `${req.protocol}://${req.get('host')}/proxy?url=${encodedUrl}`;
  console.log("Debug-proxy: constructed proxy URL:", proxyUrl);
  
  try {
    // Use node-fetch from the server side to fetch via the proxy.
    const proxyResponse = await fetch(proxyUrl);
    const text = await proxyResponse.text();
    console.log("Debug-proxy: fetched text length:", text.length);
    res.json({ video_id: videoId, lang, proxyUrl, captions: text });
  } catch (error) {
    console.error("Debug-proxy: Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// DEBUG ENDPOINT THAT USES THE SCRAPER LIBRARY (as before)
// ----------------------
app.post('/debug-scraper', async (req, res) => {
  const videoId = req.body.video_id;
  const lang = req.body.lang || 'en';
  console.log(`Debug-scraper: Attempting to fetch subtitles for video: ${videoId} in language: ${lang}`);
  try {
    const captions = await getSubtitles({
      videoID: videoId,
      lang: lang
    });
    console.log(`Debug-scraper: Fetched ${captions.length} captions for video ${videoId}`);
    res.json({ video_id: videoId, lang, captions });
  } catch (error) {
    console.error("Debug-scraper: Error fetching captions:", error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// ROOT ENDPOINT FOR DEBUG
// ----------------------
app.get('/', (req, res) => {
  res.send("Debug server is running. Use /debug-proxy or /debug-scraper to test caption retrieval.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
});