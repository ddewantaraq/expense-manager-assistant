require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const { resolveAllowedImagePath } = require('./path_guard');

const openai = new OpenAI({
  apiKey: 'ollama',
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
});

const visionModel = process.env.OLLAMA_VISION_MODEL || 'llava:7b';

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
