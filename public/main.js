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
      
      // Update the UI with video details
      document.getElementById('videoTitle').textContent = data.videoDetails.title;
      document.getElementById('videoEmbed').innerHTML = data.videoDetails.embed_html;
      
      // Update the captions in both boxes
      const originalDiv = document.getElementById('captions-original');
      const translatedDiv = document.getElementById('captions-translated');
      originalDiv.innerHTML = '';
      translatedDiv.innerHTML = '';
      
      if (data.captions.error) {
        originalDiv.innerHTML = `<p>Error retrieving captions: ${data.captions.error}</p>`;
        translatedDiv.innerHTML = `<p>Error retrieving captions: ${data.captions.error}</p>`;
      } else {
        data.captions.forEach(caption => {
          const captionHTML = `<strong>${parseFloat(caption.start).toFixed(2)}s:</strong> ${caption.text}`;
          
          const pOriginal = document.createElement('p');
          pOriginal.classList.add('caption');
          pOriginal.innerHTML = captionHTML;
          originalDiv.appendChild(pOriginal);
          
          const pTranslated = document.createElement('p');
          pTranslated.classList.add('caption');
          // For now, the translated box shows the same text as the original.
          pTranslated.innerHTML = captionHTML;
          translatedDiv.appendChild(pTranslated);
        });
      }
      
      document.getElementById('result').style.display = 'block';
    } catch (error) {
      alert("Error: " + error.message);
      form.style.display = 'block';
    }
  });
  
  // Handler for the "Back" button
  document.getElementById('backBtn').addEventListener('click', function() {
    document.getElementById('result').style.display = 'none';
    document.getElementById('youtubeForm').style.display = 'block';
  });
  
  // Placeholder event for the "Translate with Gaia" button
  document.getElementById('translateButton').addEventListener('click', function() {
    // This is where you will eventually call your translation API.
    // For now, it does nothing.
    alert("Translate with Gaia clicked. (API integration pending)");
  });  