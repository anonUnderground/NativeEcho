require('dotenv').config();  // Load variables from .env when available

const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const { getSubtitles } = require('youtube-captions-scraper');

const app = express();

// Always use node-fetch with extra logging for consistency.
const nodeFetch = require('node-fetch');
global.fetch = async (...args) => {
  // Ensure options and headers exist.
  if (!args[1]) {
    args[1] = {};
  }
  if (!args[1].headers) {
    args[1].headers = {};
  }
  // Add a User-Agent header if not already set.
  if (!args[1].headers["User-Agent"]) {
    args[1].headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
  }
  
  console.log("Custom fetch called with URL:", args[0]);
  console.log("Fetch options:", args[1]);
  
  try {
    const response = await nodeFetch(...args);
    console.log("Custom fetch response:", response.status, response.statusText);
    const contentType = response.headers.get("content-type");
    console.log("Content-Type header:", contentType);
    if (contentType) {
      if (contentType.includes("application/json")) {
        const jsonResponse = await response.clone().json();
        console.log("Custom fetch JSON response:", JSON.stringify(jsonResponse, null, 2));
      } else {
        // Use a timeout so we don't wait indefinitely for a huge HTML response.
        const textResponsePromise = response.clone().text();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(''), 2000));
        const textResponse = await Promise.race([textResponsePromise, timeoutPromise]);
        console.log("Custom fetch response body snippet (first 500 chars):", textResponse.substring(0, 500));
      }
    }
    return response;
  } catch (err) {
    console.error("Custom fetch error:", err);
    throw err;
  }
};

const API_KEY = process.env.YOUTUBE_API_KEY;
const gaiaAuth = process.env.GAIA_AUTH;

if (!API_KEY) {
  console.error("Error: YouTube API key not found in environment variables.");
  process.exit(1);
}

if (!gaiaAuth) {
  console.error("Error: Gaia auth key not found in environment variables.");
  process.exit(1);
}

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

/**
 * Retrieve video details from YouTube Data API
 */
async function getVideoDetails(videoId) {
  const youtube = google.youtube({
    version: 'v3',
    auth: API_KEY
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

/**
 * Retrieve captions using youtube-captions-scraper
 */
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

/**
 * Endpoint: /process
 *   - Extracts YouTube video details
 *   - Fetches captions
 */
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

/**
 * Endpoint: /test-translate
 *   - Builds a system message "Translate to {language}" plus the user prompt.
 */
app.post('/test-translate', async (req, res) => {
  console.log("Received /test-translate request with dynamic messages.");
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: "Missing 'messages' array in request body."
    });
  }

  try {
    const gaiaUrl = "https://0x8171007ceb1848087523c8875743a6dc91cddfa4.gaia.domains/v1/chat/completions";

    const response = await fetch(gaiaUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        Authorization: gaiaAuth,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response from Gaia API (/test-translate):", errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Error in /test-translate:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});