import express from "express";
import { SecretVaultWrapper } from "nillion-sv-wrappers";
import { orgConfig } from "./nillionOrgConfig.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
const SCHEMA_ID = process.env.NILLION_SCHEMA_ID; // Ensure this is set in .env

if (!SCHEMA_ID) {
  console.error("❌ Missing NILLION_SCHEMA_ID in environment variables.");
  process.exit(1);
}

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (like debug.html)
app.use(express.static(path.join(__dirname, "public")));

// Read Data from Nillion
app.get("/read-data", async (req, res) => {
  try {
    console.log("🔍 Fetching data from Nillion...");

    // Initialize SecretVaultWrapper
    const collection = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials,
      SCHEMA_ID
    );
    await collection.init();

    // Read all collection data from Nillion
    const decryptedCollectionData = await collection.readFromNodes({});
    
    console.log("📡 Data fetched:", decryptedCollectionData);

    res.json({ data: decryptedCollectionData });

  } catch (error) {
    console.error("❌ Error reading data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`🚀 Debug server running at http://localhost:${PORT}`);
});