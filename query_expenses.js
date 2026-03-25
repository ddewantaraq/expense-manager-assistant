require('dotenv').config();
const fs = require('fs');
const { resolveAllowedCsvPath } = require('./path_guard');

function parseCsvRow(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function readExpenses(csvPath) {
  if (!fs.existsSync(csvPath)) {
    return [];
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  const header = parseCsvRow(lines[0]);
  const dateIdx = header.findIndex((h) => /^date$/i.test(h.trim()));
  const itemIdx = header.findIndex((h) => /^item$/i.test(h.trim()));
  const priceIdx = header.findIndex((h) => /price/i.test(h.trim()));

  if (dateIdx < 0 || itemIdx < 0 || priceIdx < 0) {
    console.error(
      JSON.stringify({
        error: 'Invalid CSV header: expected Date, Item, Price (IDR)',
        header,
      })
    );
    process.exit(1);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    if (cols.length < 3) continue;
    const dateStr = cols[dateIdx].trim();
    const item = cols[itemIdx].trim();
    const priceRaw = cols[priceIdx].trim().replace(/,/g, '');
    const price = parseFloat(priceRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(price)) {
      continue;
    }
    rows.push({ date: dateStr, item, price });
  }
  return rows;
}

function inRange(dateStr, from, to) {
  return dateStr >= from && dateStr <= to;
}

function main() {
  const args = process.argv.slice(2);
  let csvPath;
  try {
    csvPath = resolveAllowedCsvPath();
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }

  let month = null;
  let from = null;
  let to = null;
  let summary = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      month = args[i + 1];
      i++;
    } else if (args[i] === '--from' && args[i + 1]) {
      from = args[i + 1];
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      to = args[i + 1];
      i++;
    } else if (args[i] === '--summary') {
      summary = true;
    }
  }

  const all = readExpenses(csvPath);

  if (summary) {
    const byMonth = new Map();
    for (const row of all) {
      const m = row.date.slice(0, 7);
      if (!byMonth.has(m)) {
        byMonth.set(m, { total: 0, count: 0 });
      }
      const agg = byMonth.get(m);
      agg.total += row.price;
      agg.count += 1;
    }
    const months = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, { total, count }]) => ({
        month: ym,
        total,
        count,
      }));
    const grandTotal = months.reduce((s, m) => s + m.total, 0);
    const grandCount = months.reduce((s, m) => s + m.count, 0);
    console.log(
      JSON.stringify(
        {
          mode: 'summary',
          csvPath,
          months,
          grandTotal,
          grandCount,
        },
        null,
        0
      )
    );
    return;
  }

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      console.error(JSON.stringify({ error: '--month must be YYYY-MM' }));
      process.exit(1);
    }
    const items = all.filter((r) => r.date.slice(0, 7) === month);
    const total = items.reduce((s, r) => s + r.price, 0);
    console.log(
      JSON.stringify(
        {
          period: month,
          total,
          count: items.length,
          items,
          csvPath,
        },
        null,
        0
      )
    );
    return;
  }

  if (from && to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      console.error(JSON.stringify({ error: '--from and --to must be YYYY-MM-DD' }));
      process.exit(1);
    }
    if (from > to) {
      console.error(JSON.stringify({ error: '--from must be <= --to' }));
      process.exit(1);
    }
    const items = all.filter((r) => inRange(r.date, from, to));
    const total = items.reduce((s, r) => s + r.price, 0);
    console.log(
      JSON.stringify(
        {
          from,
          to,
          total,
          count: items.length,
          items,
          csvPath,
        },
        null,
        0
      )
    );
    return;
  }

  console.error(
    'Usage:\n' +
      '  node query_expenses.js --month YYYY-MM\n' +
      '  node query_expenses.js --from YYYY-MM-DD --to YYYY-MM-DD\n' +
      '  node query_expenses.js --summary'
  );
  process.exit(1);
}

main();
