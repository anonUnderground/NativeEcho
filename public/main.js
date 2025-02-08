document.getElementById('youtubeForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  
  const youtubeUrl = document.getElementById('youtube_url').value;
  const language = document.getElementById('language').value || 'en';
  
  try {
    // Send request to our /process endpoint
    const response = await fetch('/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url: youtubeUrl, language })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error:", errorData.error);
      return;
    }
    
    // Parse the JSON response and print it all to the console (formatted for readability)
    const data = await response.json();
    console.log("YouTube API Response:", JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error("Fetch error:", error);
  }
});