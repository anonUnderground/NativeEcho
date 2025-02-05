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

// Middleware to parse JSON and URL-encoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Extracts a YouTube video ID from a URL.
 * Accepts standard links or shortened links.
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

// API endpoint to process the YouTube URL
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});