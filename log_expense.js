require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { resolveAllowedCsvPath, sanitizeItem } = require('./path_guard');

const CSV_HEADER = 'Date,Item,Price (IDR)\n';

function escapeCsvField(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function appendToCsv(csvPath, date, item, priceNum) {
  const dir = path.dirname(csvPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const exists = fs.existsSync(csvPath);
  const line = [date, escapeCsvField(item), priceNum].join(',') + '\n';
  if (!exists) {
    fs.writeFileSync(csvPath, CSV_HEADER + line, 'utf8');
  } else {
    fs.appendFileSync(csvPath, line, 'utf8');
  }
  console.log(`Logged: ${item} - Rp ${priceNum.toLocaleString('id-ID')} on ${date} (local CSV)`);
}

function assertValidDate(date) {
  // Prevent path traversal / timestamp variants; the memory file must be canonical YYYY-MM-DD.md
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date "${date}". Expected YYYY-MM-DD.`);
  }
}

function appendDailyMemory(workspaceRoot, date, itemSafe, priceNum, storageMode) {
  const memoryDir = path.join(workspaceRoot, 'memory');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  const storageLabel = storageMode === 'cloud' ? 'cloud' : 'local';
  const priceForMemory = Number.isFinite(priceNum) ? String(priceNum) : String(priceNum);
  const memoryFilePath = path.join(memoryDir, `${date}.md`);
  const line = `- Expense: ${itemSafe} Rp ${priceForMemory} (${storageLabel})\n`;

  // Append-only: never overwrite or truncate.
  fs.appendFileSync(memoryFilePath, line, 'utf8');
}

async function logToCloud(item, priceNum, date) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not set. Add it to .env for cloud storage.');
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A:C',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[date, item, priceNum]],
    },
  });

  console.log(`Logged: ${item} - Rp ${priceNum.toLocaleString('id-ID')} on ${date} (Google Sheet)`);
}

async function logExpense(item, price, date, storage = 'local') {
  const priceNum = typeof price === 'number' ? price : parseFloat(String(price).replace(/,/g, ''));
  const itemSafe = sanitizeItem(item);

  assertValidDate(date);

  const workspaceRoot =
    process.env.OPENCLAW_WORKSPACE ||
    path.join(os.homedir(), '.openclaw', 'workspace');

  if (storage === 'cloud') {
    await logToCloud(itemSafe, priceNum, date);
  } else {
    const csvPath = resolveAllowedCsvPath();
    appendToCsv(csvPath, date, itemSafe, priceNum);
  }

  appendDailyMemory(workspaceRoot, date, itemSafe, priceNum, storage);
}

// Get arguments from command line: item, price, [date], [storage]
const [,, item, price, date, storage] = process.argv;
const effectiveDate = date || new Date().toISOString().slice(0, 10);
const storageMode = (storage || 'local').toLowerCase();

if (!item || !price) {
  console.error('Usage: node log_expense.js <item> <price> [date] [storage]');
  console.error('  date: YYYY-MM-DD (defaults to today)');
  console.error('  storage: local (default) or cloud');
  process.exit(1);
}

logExpense(item, price, effectiveDate, storageMode).catch((err) => {
  console.error('Error logging expense:', err);
  process.exit(1);
});
