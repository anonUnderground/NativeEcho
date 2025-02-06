const express = require('express');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { getSubtitles } = require('youtube-captions-scraper');

const app = express();

// Load secrets from secrets.json
const secretsPath = path.join(__dirname, 'secrets.json');
if (!fs.existsSync(secretsPath)) {
  console.error("Error: secrets.json not found. Please add your YouTube API key there.");
  process.exit(1);
}

const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
const API_KEY = secrets.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("Error: YouTube API key not found in secrets.json.");
  process.exit(1);
}

// Retrieve Gaia auth key from secrets.json
const gaiaAuth = secrets.gaia_auth;
if (!gaiaAuth) {
  console.error("Error: Gaia auth key not found in secrets.json.");
  process.exit(1);
}

// If global.fetch is not available (for Node versions < 18), use node-fetch.
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

// Middleware to parse JSON and URL-encoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Extracts a YouTube video ID from a URL.
 */
function getVideoId(youtubeUrl) {
  if (youtubeUrl.includes("watch?v=")) {
    return youtubeUrl.split("watch?v=")[1].split("&")[0];
  } else if (youtubeUrl.includes("youtu.be/")) {
    return youtubeUrl.split("youtu.be/")[1].split("?")[0];
  } else {
    throw new Error("Invalid YouTube URL");
  }
}

/**
 * Retrieves video details from the YouTube Data API.
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
 * Retrieves captions for the video using youtube-captions-scraper.
 */
async function getCaptions(videoId, lang = 'en') {
  try {
    const captions = await getSubtitles({
      videoID: videoId,
      lang: lang
    });
    console.log(`Fetched ${captions.length} captions for video ${videoId}`);
    return captions;
  } catch (error) {
    console.error("Error fetching captions:", error);
    return { error: error.message };
  }
}

// Endpoint to process the YouTube URL
app.post('/process', async (req, res) => {
  const youtubeUrl = req.body.youtube_url;
  const language = req.body.language || 'en';
  try {
    console.log("Processing YouTube URL:", youtubeUrl);
    const videoId = getVideoId(youtubeUrl);
    console.log("Extracted videoId:", videoId);
    
    const videoDetails = await getVideoDetails(videoId);
    console.log("Video details:", videoDetails);
    
    const captions = await getCaptions(videoId, language);
    console.log("Captions response:", captions);
    
    res.json({ videoDetails, captions });
  } catch (err) {
    console.error("Error processing video:", err);
    res.status(500).json({ error: err.message });
  }
});

// Existing /translate endpoint (if needed)
app.post('/translate', async (req, res) => {
  const { captions, language } = req.body;
  console.log("Received /translate request with language:", language);
  if (!captions || !language) {
    console.error("Missing captions or language in request");
    return res.status(400).json({ error: "Missing captions or language" });
  }

  const payload = {
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant tasked with translating JSON. Translate to ${language} and return only the JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({ captions: captions })
      }
    ]
  };

  console.log("Payload for Gaia API (/translate):", JSON.stringify(payload, null, 2));
  try {
    // Replace with your actual Gaia API URL
    const gaiaUrl = 'https://your-gaia-api-domain/v1/chat/completions';
    const response = await fetch(gaiaUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Authorization': gaiaAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log("Gaia API response status (/translate):", response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error response from Gaia API (/translate):", errorData);
      return res.status(response.status).json({ error: errorData });
    }

    const responseData = await response.json();
    console.log("Gaia API response data (/translate):", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Error in /translate:", error);
    res.status(500).json({ error: error.message });
  }
});

// New simplified endpoint for testing: /test-translate
app.post('/test-translate', async (req, res) => {
  console.log("Received /test-translate request for fixed payload.");
  // Build the payload without a model field
  const payload = {
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant."
      },
      {
        role: "user",
        content: "What is the capital of France?"
      }
    ]
  };

  console.log("Payload for Gaia API (/test-translate):", JSON.stringify(payload, null, 2));
  try {
    // Update the URL below to your Gaia API URL (using HTTPS if available)
    const gaiaUrl = "https://0x8171007ceb1848087523c8875743a6dc91cddfa4.gaia.domains/v1/chat/completions";
    const response = await fetch(gaiaUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Authorization': gaiaAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log("Gaia API response status (/test-translate):", response.status);
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error response from Gaia API (/test-translate):", errorData);
      return res.status(response.status).json({ error: errorData });
    }

    const responseData = await response.json();
    console.log("Gaia API response data (/test-translate):", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Error in /test-translate:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});