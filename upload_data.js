import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import { SecretVaultWrapper } from 'nillion-sv-wrappers';
import { orgConfig } from './nillionOrgConfig.js';

dotenv.config();

// Load secrets from .env
const NillionSchemaID = process.env.NILLION_SCHEMA_ID;

if (!NillionSchemaID) {
    console.error("Missing NILLION_SCHEMA_ID in .env");
    process.exit(1);
}

// Function to prompt user for input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans.trim());
        })
    );
}

// Function to read JSON from file
function loadJsonFile(filename) {
    try {
        console.log(`Reading JSON file: ${filename}`);
        const rawData = fs.readFileSync(filename, 'utf8');
        const parsedData = JSON.parse(rawData);
        console.log(`Successfully loaded JSON file`);
        return parsedData;
    } catch (error) {
        console.error(`Failed to read or parse JSON file (${filename}):`, error.message);
        process.exit(1);
    }
}

// Function to validate and format data for schema compliance
function validateAndFormatData(jsonData) {
    console.log("Validating JSON data structure...");

    if (typeof jsonData !== "object" || Array.isArray(jsonData)) {
        throw new Error("JSON data must be a single object to match schema.");
    }

    if (!jsonData.video_details || typeof jsonData.video_details !== "object") {
        throw new Error("Missing or invalid 'video_details' field.");
    }

    if (!jsonData.captions || !Array.isArray(jsonData.captions)) {
        throw new Error("Missing or invalid 'captions' array.");
    }

    console.log("✅ JSON structure validation passed");

    // Ensure all required fields exist in video_details
    const videoDetails = {
        video_id: jsonData.video_details.video_id || "",
        title: jsonData.video_details.title || "",
        description: jsonData.video_details.description || "",
        caption_status: jsonData.video_details.caption_status === "true" || jsonData.video_details.caption_status === true, // Ensure boolean
        embed_html: jsonData.video_details.embed_html || ""
    };

    // Validate captions
    const captions = jsonData.captions.map(cap => ({
        text: typeof cap.text === "string" ? cap.text : "",
        start: typeof cap.start === "number" ? cap.start : 0,
        duration: typeof cap.duration === "number" ? cap.duration : 0
    }));

    // **Wrap in an array** for Nillion schema compliance
    const formattedData = [
        {
            video_details: videoDetails,
            captions: captions
        }
    ];

    console.log("Formatted Data for Upload:", JSON.stringify(formattedData, null, 2));
    return formattedData;
}

// Main function to upload JSON data
async function main() {
    try {
        console.log("🚀 Starting upload process...");

        // Ask user for JSON filename
        const jsonFilename = await askQuestion("Enter JSON filename: ");

        // Load and validate JSON data
        let jsonData = loadJsonFile(jsonFilename);
        jsonData = validateAndFormatData(jsonData);

        console.log("🔍 Final JSON payload to upload:", JSON.stringify(jsonData, null, 2));

        // Initialize SecretVaultWrapper
        console.log("🔑 Initializing Nillion SecretVaultWrapper...");
        const collection = new SecretVaultWrapper(
            orgConfig.nodes,
            orgConfig.orgCredentials,
            NillionSchemaID
        );

        await collection.init();
        console.log("Nillion SecretVault initialized");

        // Upload JSON to Nillion
        console.log("⏳ Uploading JSON data to Nillion...");
        const dataWritten = await collection.writeToNodes(jsonData);

        console.log("📡 Nillion Response:", JSON.stringify(dataWritten, null, 2));

        // Extract uploaded record IDs
        const newIds = dataWritten
            .filter((item) => item.result?.data?.created)
            .map((item) => item.result.data.created)
            .flat();

        console.log("Uploaded Record IDs:", newIds.length ? newIds : "No records created.");

        // Debug: Check for errors in response
        dataWritten.forEach((item) => {
            if (item.error) {
                console.error(`Error writing to ${item.node}:`, item.error);
            }
        });

    } catch (error) {
        console.error("Error during upload:", error.message);
        process.exit(1);
    }
}

main();