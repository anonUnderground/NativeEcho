import { SecretVaultWrapper } from 'nillion-sv-wrappers';
import { orgConfig } from './nillionOrgConfig.js';
import schema from './schema.json' assert { type: 'json' };

async function main() {
  try {
    const org = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials
    );
    await org.init();

    // Debug: Print the schema being sent
    console.log("🔍 Debug: Schema being sent:");
    console.log(JSON.stringify(schema, null, 2));

    // Create a new collection schema for all nodes in the org
    const collectionName = 'YouTube Captions';
    const newSchema = await org.createSchema(schema, collectionName);
    
    console.log('✅ New Collection Schema created for all nodes:', newSchema);
    console.log('👀 Schema ID:', newSchema[0].result.data);
  } catch (error) {
    console.error('❌ Failed to use SecretVaultWrapper:', error.message);

    // Debug: Log the full error response if it's an HTTP error
    if (error.response) {
      console.error('🔍 Debug: Full error response:', await error.response.text());
    }

    process.exit(1);
  }
}

main();