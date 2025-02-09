import express from "express";
import { SecretVaultWrapper } from "nillion-sv-wrappers";
import { orgConfig } from "./nillionOrgConfig.js";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const SCHEMA_ID = process.env.NILLION_SCHEMA_ID;
const GAIA_AUTH = process.env.GAIA_AUTH;

if (!SCHEMA_ID || !GAIA_AUTH) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Fetch video list
app.get("/videos", async (req, res) => {
  try {
    console.log("📡 Fetching video list from Nillion...");
    
    const collection = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials,
      SCHEMA_ID
    );
    await collection.init();

    const decryptedCollectionData = await collection.readFromNodes({});
    if (!decryptedCollectionData || !Array.isArray(decryptedCollectionData)) {
      throw new Error("Invalid data format received from Nillion.");
    }

    const videos = decryptedCollectionData.map(item => ({
      id: item._id,
      title: item.video_details?.title || "Untitled Video",
      videoId: item.video_details?.video_id || "unknown",
      embed_html: item.video_details?.embed_html || "No embed available",
      captions: item.captions || []
    }));

    console.log("🎥 Processed Videos:", videos.length);
    res.json({ videos });

  } catch (error) {
    console.error("❌ Error fetching video list:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Fetch captions for a video
app.get("/captions/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log(`📡 Fetching captions for video: ${videoId}`);

    const collection = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials,
      SCHEMA_ID
    );
    await collection.init();

    const decryptedCollectionData = await collection.readFromNodes({});
    if (!decryptedCollectionData || !Array.isArray(decryptedCollectionData)) {
      throw new Error("Invalid data format received from Nillion.");
    }

    const videoEntry = decryptedCollectionData.find(
      item => item.video_details?.video_id === videoId
    );

    if (!videoEntry) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ captions: videoEntry.captions || [] });

  } catch (error) {
    console.error("❌ Error fetching captions:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Translate captions one by one
app.post("/translate", async (req, res) => {
  try {
    const { captions, language } = req.body;
    console.log(`🔠 Translating ${captions.length} captions to ${language}...`);

    if (!captions || !Array.isArray(captions)) {
      console.error("❌ Error: Invalid captions array.");
      return res.status(400).json({ error: "Invalid captions array." });
    }

    const translatedCaptions = [];

    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i];

      // LOG: Show what we are sending to Gaia
      console.log(`📤 Sending caption #${i + 1} to Gaia:`, caption.text);

      const response = await fetch("https://0x8171007ceb1848087523c8875743a6dc91cddfa4.gaia.domains/v1/chat/completions", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: GAIA_AUTH,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `Translate to ${language}` },
            { role: "user", content: caption.text }
          ]
        })
      });

      if (!response.ok) {
        console.error(`❌ Error translating caption ${i + 1}:`, response.status);
        translatedCaptions.push({ ...caption, translatedText: "(translation failed)" });
        continue;
      }

      const data = await response.json();

      // LOG: Print Gaia's full response
      console.log(`📥 Gaia API Response for #${i + 1}:`, JSON.stringify(data, null, 2));

      const translatedText = data?.choices?.[0]?.message?.content?.trim() || "(no translation)";

      translatedCaptions.push({ ...caption, translatedText });

      // Send incremental update
      res.write(JSON.stringify({ index: i, translatedText }) + "\n");
    }

    res.end();

  } catch (error) {
    console.error("❌ Error translating captions:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});