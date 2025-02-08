require('dotenv').config();  // Load variables from .env

const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const { getSubtitles } = require('youtube-captions-scraper');
const nodeFetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const puppeteer = require('puppeteer');

const app = express();

// Load environment variables
const API_KEY = process.env.YOUTUBE_API_KEY;
const GAIA_AUTH = process.env.GAIA_AUTH;
const RESIDENTIAL_PROXY = process.env.RESIDENTIAL_PROXY; // e.g., "http://username:password@core-residential.evomi.com:1000"

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

// Configure proxy agent for node-fetch
const proxyAgent = new HttpsProxyAgent(RESIDENTIAL_PROXY);

// Realistic browser headers to mimic normal traffic
const realisticHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.youtube.com/",
  "DNT": "1", // Do Not Track
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0"
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Extract YouTube video ID from URL.
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
 * Retrieve video details from YouTube Data API.
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
 * Retrieve captions using youtube-captions-scraper via Proxy.
 * This forces all caption requests to go through the residential proxy.
 */
async function getCaptionsWithProxy(videoId, lang = 'en') {
  console.log(`[PROXY] Fetching captions for video: ${videoId} in language: ${lang}`);
  try {
    // First, attempt a simple fetch to the video page using the proxy to verify it is working.
    const response = await nodeFetch(`https://www.youtube.com/watch?v=${videoId}`, {
      agent: proxyAgent,
      headers: realisticHeaders,
    });
    if (!response.ok) {
      throw new Error(`[PROXY] YouTube blocked the request. HTTP Status: ${response.status}`);
    }
    // Now, use the youtube-captions-scraper library with our proxy settings.
    const captions = await getSubtitles({
      videoID: videoId,
      lang: lang,
      requestOptions: {
        agent: proxyAgent,
        headers: realisticHeaders
      }
    });
    console.log(`[PROXY] Successfully fetched ${captions.length} captions.`);
    return captions;
  } catch (error) {
    console.error("[PROXY] Error fetching captions:", error);
    return [];
  }
}

/**
 * Alternative: Retrieve captions using Puppeteer.
 * This endpoint uses Puppeteer to load the video page and extract transcript segments.
 */
async function getCaptionsWithPuppeteer(videoId, lang = 'en') {
  console.log(`[PUPPETEER] Fetching transcript for video: ${videoId} in language: ${lang}`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        `--proxy-server=${RESIDENTIAL_PROXY}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    const page = await browser.newPage();
    await page.setUserAgent(realisticHeaders["User-Agent"]);
    await page.goto(videoUrl, { waitUntil: 'networkidle2' });
    
    // Click on "More actions" button if available.
    await page.waitForSelector('button.ytp-button[aria-label="More actions"]', { timeout: 5000 });
    await page.click('button.ytp-button[aria-label="More actions"]');
    
    // Wait for menu items and click the one that says "Transcript"
    await page.waitForSelector('ytd-menu-service-item-renderer', { timeout: 5000 });
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer'));
      for (const item of items) {
        if (item.innerText.toLowerCase().includes("transcript")) {
          item.click();
          break;
        }
      }
    });
    
    // Wait for the transcript panel to appear
    await page.waitForSelector('ytd-transcript-renderer', { timeout: 5000 });
    
    // Extract transcript data
    const transcriptData = await page.evaluate(() => {
      const segments = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
      return segments.map(segment => {
        const start = segment.querySelector('.segment-timestamp')?.innerText.trim() || "";
        const text = segment.querySelector('.segment-text')?.innerText.trim() || "";
        return { start, text };
      });
    });
    await browser.close();
    console.log(`[PUPPETEER] Fetched ${transcriptData.length} transcript segments.`);
    return transcriptData;
  } catch (error) {
    if (browser) await browser.close();
    console.error("[PUPPETEER] Error fetching transcript:", error);
    return [];
  }
}

/**
 * Endpoint: /process
 *   - Extracts YouTube video details
 *   - Fetches captions using the proxy (via getCaptionsWithProxy)
 */
app.post('/process', async (req, res) => {
  const youtubeUrl = req.body.youtube_url;
  const language = req.body.language || 'en';
  console.log(`Processing YouTube URL: ${youtubeUrl} with language: ${language}`);
  try {
    const videoId = getVideoId(youtubeUrl);
    const videoDetails = await getVideoDetails(videoId);
    const captions = await getCaptionsWithProxy(videoId, language);
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
    const response = await nodeFetch(gaiaUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        Authorization: GAIA_AUTH,
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

// Optionally, a Puppeteer-based endpoint for alternative testing:
app.post('/debug-puppeteer', async (req, res) => {
  const videoId = req.body.video_id;
  const lang = req.body.lang || 'en';
  console.log(`Debug-puppeteer: Fetching transcript for video: ${videoId} using Puppeteer`);
  try {
    const transcript = await getCaptionsWithPuppeteer(videoId, lang);
    res.json({ video_id: videoId, lang, transcript });
  } catch (error) {
    console.error("Debug-puppeteer: Error fetching transcript:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});