require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');

async function setupSheet() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'service-account.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!spreadsheetId) {
      console.error('SPREADSHEET_ID is not set in .env');
      process.exit(1);
    }

    // Optional: ensure header row exists (Date, Item, Price)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:C1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Date', 'Item', 'Price (IDR)']],
      },
    });

    // Get Sheet1's sheetId (default first sheet is usually 0)
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets.find(s => s.properties.title === 'Sheet1') || meta.data.sheets[0];
    const sheetId = sheet.properties.sheetId;

    // Format column C (Price) as Rupiah: "Rp"#,##0
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1000,
                startColumnIndex: 2,
                endColumnIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'CURRENCY',
                    pattern: '"Rp"#,##0',
                  },
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
        ],
      },
    });

    console.log('Sheet configured: header row set, Price column (C) formatted as Rupiah.');
  } catch (error) {
    console.error('Error setting up sheet:', error);
    process.exit(1);
  }
}

setupSheet();
