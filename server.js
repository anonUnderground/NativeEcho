const express = require('express');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { getSubtitles } = require('youtube-captions-scraper');

const app = express();

// Load secrets from secrets.json
const secrets = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.json'), 'utf-8'));
const API_KEY = secrets.YOUTUBE_API_KEY;

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
    throw new Error(No video found with ID: ${videoId});
  }
  
  const item = response.data.items[0];
  return {
    video_id: videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    caption_status: item.contentDetails.caption, // "true" or "false"
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
    return captions;
  } catch (error) {
    return { error: error.message };
  }
}

// API endpoint to process the YouTube URL
app.post('/process', async (req, res) => {
  const youtubeUrl = req.body.youtube_url;
  const language = req.body.language || 'en';
  try {
    const videoId = getVideoId(youtubeUrl);
    const videoDetails = await getVideoDetails(videoId);
    const captions = await getCaptions(videoId, language);
    res.json({ videoDetails, captions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});

main.js:

let player;
let videoId;
let syncInterval;
let captionsData = []; // will store captions from the backend

// Called by the YouTube Iframe API when it is ready
function onYouTubeIframeAPIReady() {
  if (videoId) {
    createPlayer();
  }
}

function createPlayer() {
  player = new YT.Player('player', {
    height: '360',
    width: '640',
    videoId: videoId,
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  // No auto-play; the user may use the built-in controls (pause, etc.)
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    startSync();
  } else {
    stopSync();
  }
}

function startSync() {
  if (syncInterval) return;
  syncInterval = setInterval(syncCaptions, 250);
}

function stopSync() {
  clearInterval(syncInterval);
  syncInterval = null;
}

function syncCaptions() {
  if (!player || typeof player.getCurrentTime !== 'function') return;
  const currentTime = player.getCurrentTime();
  
  // Determine which caption is active.
  // Here we use each caption’s start time and duration (if provided) to compute its end.
  let activeCaption = null;
  document.querySelectorAll('.caption').forEach(captionEl => {
    const start = parseFloat(captionEl.getAttribute('data-start'));
    let end;
    if (captionEl.hasAttribute('data-duration')) {
      const duration = parseFloat(captionEl.getAttribute('data-duration'));
      end = start + duration;
    } else {
      end = start + 5; // Fallback: assume 5 seconds duration if not provided
    }
    if (currentTime >= start && currentTime <= end) {
      activeCaption = captionEl;
    }
  });
  
  // Remove highlighting from all captions then highlight the active one.
  document.querySelectorAll('.caption').forEach(el => {
    el.classList.remove('active-caption');
  });
  if (activeCaption) {
    activeCaption.classList.add('active-caption');
    activeCaption.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Handle form submission
document.getElementById('youtubeForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = document.getElementById('youtubeForm');
  form.style.display = 'none';
  
  const youtubeUrl = document.getElementById('youtube_url').value;
  const language = document.getElementById('language').value || 'en';
  
  try {
    const response = await fetch('/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url: youtubeUrl, language })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      alert("Error: " + errorData.error);
      form.style.display = 'block';
      return;
    }
    
    const data = await response.json();
    
    document.getElementById('videoTitle').textContent = data.videoDetails.title;
    videoId = data.videoDetails.video_id;
    
    // Load YouTube Iframe API if needed
    if (window.YT && YT.Player) {
      createPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    
    // Render the captions
    const captionsDiv = document.getElementById('captions');
    captionsDiv.innerHTML = '';
    if (data.captions.error) {
      captionsDiv.innerHTML = <p>Error retrieving captions: ${data.captions.error}</p>;
    } else {
      captionsData = data.captions;
      data.captions.forEach(caption => {
        const p = document.createElement('p');
        p.classList.add('caption');
        p.setAttribute('data-start', caption.start);
        // If the caption object contains a duration, save it for sync calculations
        if (caption.duration) {
          p.setAttribute('data-duration', caption.duration);
        }
        p.innerHTML = <strong>${parseFloat(caption.start).toFixed(2)}s:</strong> ${caption.text};
        // Clicking a caption seeks the video to that time.
        p.addEventListener('click', function() {
          if (player && typeof player.seekTo === 'function') {
            player.seekTo(parseFloat(caption.start), true);
          }
        });
        captionsDiv.appendChild(p);
      });
    }
    
    document.getElementById('result').style.display = 'block';
  } catch (error) {
    alert("Error: " + error.message);
    form.style.display = 'block';
  }
});

// Back button: hide results and destroy the player.
document.getElementById('backBtn').addEventListener('click', function() {
  document.getElementById('result').style.display = 'none';
  document.getElementById('youtubeForm').style.display = 'block';
  if (player && typeof player.destroy === 'function') {
    player.destroy();
  }
  stopSync();
});