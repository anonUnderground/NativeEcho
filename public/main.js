document.getElementById('youtubeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Hide form during processing
    const form = document.getElementById('youtubeForm');
    form.style.display = 'none';
    
    const youtubeUrl = document.getElementById('youtube_url').value;
    const language = document.getElementById('language').value || 'en';
    
    try {
      const response = await fetch('/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ youtube_url: youtubeUrl, language })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        alert("Error: " + errorData.error);
        form.style.display = 'block';
        return;
      }
      
      const data = await response.json();
      
      // Update the UI with video details and captions
      document.getElementById('videoTitle').textContent = data.videoDetails.title;
      document.getElementById('videoEmbed').innerHTML = data.videoDetails.embed_html;
      
      const captionsDiv = document.getElementById('captions');
      captionsDiv.innerHTML = '';
      if (data.captions.error) {
        captionsDiv.innerHTML = `<p>Error retrieving captions: ${data.captions.error}</p>`;
      } else {
        data.captions.forEach(caption => {
          const p = document.createElement('p');
          p.classList.add('caption');
          p.innerHTML = `<strong>${parseFloat(caption.start).toFixed(2)}s:</strong> ${caption.text}`;
          captionsDiv.appendChild(p);
        });
      }
      
      document.getElementById('result').style.display = 'block';
    } catch (error) {
      alert("Error: " + error.message);
      form.style.display = 'block';
    }
  });
    
  document.getElementById('backBtn').addEventListener('click', function() {
    document.getElementById('result').style.display = 'none';
    document.getElementById('youtubeForm').style.display = 'block';
  });  