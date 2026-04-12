require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const { resolveAllowedImagePath } = require('./path_guard');

/** Trailing slash helps the OpenAI client resolve paths consistently. */
function normalizeOllamaBaseURL(raw) {
  const trimmed = (raw || 'https://ollama.com/v1').trim();
  try {
    const u = new URL(trimmed);
    if (
      (u.hostname === 'ollama.com' || u.hostname.endsWith('.ollama.com')) &&
      (u.pathname === '/' || u.pathname === '')
    ) {
      return `https://${u.hostname}/v1/`;
    }
    const href = u.href.replace(/\/+$/, '');
    return `${href}/`;
  } catch {
    return 'https://ollama.com/v1/';
  }
}

function isOllamaComHost(baseURL) {
  try {
    const u = new URL(baseURL);
    return u.hostname === 'ollama.com' || u.hostname.endsWith('.ollama.com');
  } catch {
    return false;
  }
}

const baseURL = normalizeOllamaBaseURL(process.env.OLLAMA_BASE_URL);
const apiKeyFromEnv =
  process.env.OLLAMA_API_KEY != null && String(process.env.OLLAMA_API_KEY).trim() !== ''
    ? String(process.env.OLLAMA_API_KEY).trim()
    : '';

if (isOllamaComHost(baseURL) && !apiKeyFromEnv) {
  console.error(
    'OLLAMA_API_KEY is required when OLLAMA_BASE_URL points to ollama.com (Ollama Cloud).\n' +
      'Create a key at https://ollama.com/settings/keys and set OLLAMA_API_KEY in .env in this skill directory.'
  );
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKeyFromEnv || 'ollama',
  baseURL,
});

const visionModel = process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b';

async function parseReceipt(imagePath) {
  try {
    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the Item, Price, and Date from this receipt. If the price is not in Indonesian Rupiah (IDR), convert it to IDR using an approximate exchange rate (e.g., 1 USD ≈ 16000 IDR). Return ONLY a JSON object with keys: item (string), price (number, always in IDR), date (YYYY-MM-DD string). If date is missing, use today's date." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    const content = response.choices[0].message.content;
    // Extract JSON from response (handles potential markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log(jsonMatch[0]);
    } else {
      console.error("Could not parse JSON from response:", content);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error parsing receipt:", error);
    process.exit(1);
  }
}

const [,, imagePathArg] = process.argv;

if (!imagePathArg) {
  console.error('Usage: node parse_receipt.js <image_path>');
  process.exit(1);
}

let resolvedImagePath;
try {
  resolvedImagePath = resolveAllowedImagePath(imagePathArg);
} catch (err) {
  console.error('Security error:', err.message);
  process.exit(1);
}

parseReceipt(resolvedImagePath);
