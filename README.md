# NativeEcho

NativeEcho is a decentralized translation application that allows users to translate YouTube videos into their native language using AI-powered language models. This project integrates Python for web scraping YouTube closed captions, JavaScript for data uploading, and a decentralized storage layer on Nillion. The AI translation is powered by a language model deployed on a GainaNet node running on AWS EC2.

## Features
- **Decentralized Translation**: Ensures data privacy and security by leveraging Nillion's decentralized network.
- **YouTube Caption Extraction**: Uses Python and the YouTube API to retrieve closed captions.
- **AI-Powered Translation**: Captions are translated using a Large Language Model (LLM) deployed on GainaNet.
- **Decentralized Data Storage**: YouTube metadata is stored on Nillion and retrieved for the UI.
- **User-Friendly Interface**: A web-based UI fetches and displays the translated captions.

## Architecture Overview
1. **Scrape YouTube Captions**: Python script retrieves captions from YouTube videos.
2. **Upload Metadata to Nillion**: JSON metadata is uploaded using `upload_data.js`.
3. **Retrieve Data from Nillion**: UI fetches metadata from Nillion.
4. **Translate Captions**: Captions are passed to an LLM deployed on a GainaNet node.
5. **Display Translations**: Translated captions are displayed in the UI.

## Technologies Used
- **Backend**: Python (YouTube API, web scraping)
- **Frontend**: HTML, JavaScript, CSS
- **Decentralized Storage**: Nillion
- **AI Translation**: GainaNet Node running on AWS EC2 (m5.xlarge)
  - **Model Name for Chat**: `Qwen2.5-0.5B-Instruct-Q5_K_M`
  - **Model Name for Text Embedding**: `Nomic-embed-text-v1.5`
- **Deployment**: Render (https://nativeecho.onrender.com)

## Prerequisites
Before running the project locally, ensure you have the following installed:
- **Python 3.8+**
- **Node.js 16+**
- **NPM or Yarn**
- **FFmpeg** (for YouTube captions processing)

### Installing Dependencies
Run the following commands to install required dependencies:

#### Python Dependencies
```sh
pip install -r requirements.txt
```

#### Node.js Dependencies
```sh
npm install
```

## Setting Up Environment Variables
Create a `.env` file in the root directory and populate it with the required API keys and configuration values:

```
YOUTUBE_API_KEY=<your-youtube-api-key>
NILLION_API_KEY=<your-nillion-api-key>
GANIANET_NODE_URL=<your-gainanet-node-url>
```

Ensure that your `.env` file is correctly configured, as missing or incorrect values can lead to failures in API requests.

## Running the Application Locally

### 1. Extract YouTube Captions
Run the following Python script to scrape closed captions from a YouTube video:
```sh
python extract_captions.py --video_id <YouTube Video ID>
```
This generates a JSON file containing the video metadata and captions.

### 2. Upload Metadata to Nillion
Use the Node.js script to upload the extracted JSON file to Nillion:
```sh
node upload_data.js <path-to-json>
```

### 3. Run the Frontend UI Locally
Start the frontend interface to interact with the translated captions:
```sh
npm start
```
The UI will fetch metadata from Nillion and display it.

### 4. Translate Captions via LLM
Captions are sent to the AI model running on GainaNet, and translations are retrieved dynamically.

## Troubleshooting
### Common Issues & Solutions
#### 1. Python Dependencies Not Installing
Ensure you are using the correct Python version (3.8+):
```sh
python --version
```
Try using a virtual environment:
```sh
python -m venv venv
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

#### 2. Node.js Issues
If you encounter errors when running Node.js scripts, ensure you are using the correct version:
```sh
node -v
```
Try deleting and reinstalling `node_modules`:
```sh
rm -rf node_modules package-lock.json
npm install
```

#### 3. `.env` File Not Being Read
Check that your `.env` file exists and is properly formatted. If necessary, install `dotenv` for Node.js:
```sh
npm install dotenv
```

## Future Improvements
- Implement user authentication for personalized translations.
- Support additional video platforms beyond YouTube.
- Enhance UI performance and interactivity.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for more details.