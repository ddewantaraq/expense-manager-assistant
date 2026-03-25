# OpenClaw Expense Manager

This project is an OpenClaw skill that allows you to track expenses via WhatsApp. It uses a **light default stack** on Ollama: **`kimi-k2.5:cloud`** for the agent (text, tools, skills) and **`llava:7b`** for receipt images via `parse_receipt.js` (override with `OLLAMA_VISION_MODEL` in `.env`). Optional: use a heavier vision model such as **`glm-4.7-flash:latest`** for better OCR at the cost of speed.

**Storage:** By default expenses are saved to a **local CSV file** (`expenses.csv` in the skill directory). If you want a specific expense (or all) in Google Sheets, include **storage=cloud** in your message (e.g. "Lunch 50000 storage=cloud"); you must then complete the Google Sheets setup and run `node setup_sheet.js` once.

## Prerequisites

1.  **OpenClaw**: Installed and running. See **Installing OpenClaw** below.
2.  **Node.js**: Installed (v18+ recommended; OpenClaw requires Node 22+).
3.  **Ollama**: Installed and running locally.

    For the receipt OCR vision model (local), pull:

    ```bash
    ollama pull llava:7b
    # Optional (often sharper OCR, slower):
    # ollama pull glm-4.7-flash:latest
    ```

    No API key required for local models.

    To use Ollama Cloud models (the default agent model `kimi-k2.5:cloud`), sign in once and then onboard in **Cloud + Local** mode:

    ```bash
    ollama signin
    ```
4.  **Google Cloud Service Account** (optional): Only needed if you use **storage=cloud** to save to Google Sheets.

## Installing OpenClaw

If you do not have OpenClaw yet, follow these steps. Full details: [docs.openclaw.ai/install](https://docs.openclaw.ai/install).

### Option A — Installer script (recommended)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard --install-daemon
```

The script handles Node detection; Node 22+ is required. The wizard creates `~/.openclaw/` and your workspace, and can open the dashboard when done.

### Option B — npm (if you already have Node 22+)

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

### After install

- The gateway runs on port **18789** by default.
- To use WhatsApp: add your channel to `~/.openclaw/openclaw.json` (see **Configure OpenClaw** under Setup), then run `openclaw channels login` and scan the QR code with the phone that will act as the assistant (WhatsApp → Linked Devices).
- Use a **dedicated phone number** for the assistant when possible (OpenClaw recommendation).

## Setup

### 1. Install Dependencies

Navigate to this directory and install the required packages:

```bash
npm install
```

### 2. Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

No API key is required for **local** Ollama runs. For **local CSV only** you do not need `SPREADSHEET_ID`. Optional: set `EXPENSES_CSV_PATH` to a path **under this skill directory** only (default: `expenses.csv`). If OpenClaw passes receipt images outside this folder, set `OPENCLAW_WORKSPACE` to your workspace path (see `.env.example`). If Ollama is on a non-default address, set `OLLAMA_BASE_URL` accordingly. For receipt OCR, **`OLLAMA_VISION_MODEL`** defaults to **`llava:7b`**; set it to **`glm-4.7-flash:latest`** (after `ollama pull`) if you want slower, often more accurate parsing. For Ollama Cloud models, ensure you completed `ollama signin` and selected **Cloud + Local** during `openclaw onboard`.

### 3. Google Sheets (optional, for storage=cloud)

Only if you want to use **storage=cloud**:

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project, enable **Google Sheets API**, create a **Service Account**, and download the JSON key.
3.  Copy it to `service-account.json` in this directory (see `service-account.example.json` for structure). Do not commit the real key.
4.  Create a Google Sheet, share it with the `client_email` from `service-account.json` (Editor), and set `SPREADSHEET_ID` in `.env`.
5.  Run once to format the sheet: `node setup_sheet.js`

### 4. Install the Skill (this is your "agent")

OpenClaw does not have a separate "create agent" screen. The **agent** is the default assistant that runs when you start the gateway; it loads skills from your workspace and from optional extra directories.

**If this repo lives outside `~/.openclaw/workspace`** (typical when you clone to `~/Documents/projects/...`), OpenClaw **ignores** symlinks under `workspace/skills/` that point outside the workspace when **building the skill catalog** (security: paths must resolve inside the configured workspace root). You still register the project explicitly so the skill loads:

Add to `~/.openclaw/openclaw.json` (adjust the path to match where you cloned this repo):

```json
"skills": {
  "load": {
    "extraDirs": ["/absolute/path/to/openclaw-expense-manager"]
  }
}
```

**Workspace path for `SKILL.md` reads:** The skill’s **`name` in `SKILL.md` is `expense_manager`** (underscore). Some OpenClaw tool paths resolve to:

`~/.openclaw/workspace/skills/expense_manager/SKILL.md`

If logs show **`[tools] read failed: ENOENT ... expense_manager/SKILL.md`**, create a symlink so that path exists (pointing at this repo):

```bash
ln -sfn /absolute/path/to/openclaw-expense-manager \
  ~/.openclaw/workspace/skills/expense_manager
```

Use the **same** absolute path you put in `extraDirs`. After that, `test -f ~/.openclaw/workspace/skills/expense_manager/SKILL.md` should succeed.

**Alternative:** copy or move the whole project folder **into** `~/.openclaw/workspace/skills/expense_manager` so `SKILL.md` lives directly there (folder name must match **`expense_manager`**, not `expense-manager`).

**Verify:** run `openclaw skills list` and confirm **`expense_manager`** appears with status **ready** (source `openclaw-extra` when using `extraDirs`). If you use a symlink under `workspace/skills/`, run `readlink ~/.openclaw/workspace/skills/expense_manager` — it must point at this project directory.

After the skill is visible, the same agent will use the expense-manager skill (see `SKILL.md`) when you message it. You can optionally copy the contents of `SOUL.expense-example.md` into `~/.openclaw/workspace/SOUL.md` so the agent identifies as an expense-only assistant.

### 5. Configure OpenClaw

Ensure your `~/.openclaw/openclaw.json` is configured with Ollama as the model provider and your WhatsApp channel. Use **`kimi-k2.5:cloud`** as the default agent model; set **`contextWindow` to at least 16000** and preferably >= 32000 so OpenClaw’s embedded agent does not warn (`low context window ... warn<32000`). Merge this with your existing keys (`skills.load.extraDirs`, etc.):

```json
{
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://127.0.0.1:11434",
        "apiKey": "ollama-local",
        "api": "ollama",
        "models": [
          {
            "id": "kimi-k2.5:cloud",
            "contextWindow": 32768,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "ollama/kimi-k2.5:cloud"
      }
    }
  },
  "channels": {
    "whatsapp": {
      "allowFrom": ["YOUR_PHONE_NUMBER"]
    }
  }
}
```

If you already have `~/.openclaw/openclaw.json`, change **`primary`** to **`ollama/kimi-k2.5:cloud`**, add the **`ollama.models`** array for **`kimi-k2.5:cloud`** as above, and keep your **`skills`**, **`channels`**, and other settings. Restart the gateway after changes (`openclaw gateway restart` or your LaunchAgent). Add the `channels` block if you still need to enable WhatsApp.

## Currency

All amounts are converted to **Indonesian Rupiah (IDR)**. You can send amounts in any currency (e.g., "Lunch 10 USD"); the agent converts to IDR before logging. The Google Sheet Price column is formatted as Rupiah (Rp).

## Security best practices

- **OpenClaw gateway**: Restrict who can message your assistant (e.g. `channels.whatsapp.allowFrom` in `~/.openclaw/openclaw.json`). Prefer a **dedicated phone number** for the assistant. Do not expose the gateway WebSocket port (**18789**) directly to the internet; use VPN, Tailscale, or SSH tunnel for remote access. Set `OPENCLAW_GATEWAY_TOKEN` if you use remote clients.
- **Secrets**: Keep `service-account.json` and `.env` out of git (see `.gitignore`). On Unix, restrict the key file: `chmod 600 service-account.json`. Use a **minimal** Google Cloud project and Sheets scope for the service account.
- **This skill**: `EXPENSES_CSV_PATH` must resolve **inside the skill directory** (scripts reject path traversal). Expense **item** text is capped (200 characters) and control characters stripped. Receipt **images** must live under the skill folder or under `OPENCLAW_WORKSPACE` if you set it in `.env` (so arbitrary system files cannot be sent to the model).
- **Privacy**: Expense totals and memory lines can be sensitive; avoid using the bot in **untrusted group chats** without mention rules and allowlists.

## Troubleshooting (slow replies, no new CSV rows)

OpenClaw only appends to `expenses.csv` after the agent successfully runs `node log_expense.js`. If the LLM fails or never finishes, **no row is written** (the scripts are not the first step in the chain).

1. **Check logs** — `openclaw logs --follow` (or the log file shown when the gateway starts). Look for:
   - `[tools] read failed: ENOENT ... expense_manager/SKILL.md` — the gateway expects `~/.openclaw/workspace/skills/expense_manager/SKILL.md`. Add the symlink under **Install the Skill** (same path as `extraDirs`), or copy the project into `workspace/skills/expense_manager/`, then restart the gateway.
   - `Model context window too small` — in `~/.openclaw/openclaw.json`, set `models.providers.ollama.models[]` for your agent model so **`contextWindow`** is at least **16000** (hard minimum for many setups) and preferably **≥ 32000** to avoid **`low context window ... warn<32000`**.
   - `LLM request failed`, `fetch failed`, `network connection error` — **Ollama is not reachable** from the gateway. Start Ollama (e.g. open **Ollama.app**), then verify: `curl -s http://127.0.0.1:11434/api/tags`
   - `embedded_run_agent_end` with errors — agent run failed before tools ran.
   - WhatsApp **408** / connection lost — Web session dropped; reconnect (or wait for auto-reconnect) and resend.

2. **Latency** — Very large local models (e.g. **`glm-4.7-flash`**, ~30B) can take **minutes** per agent step; using the default **`kimi-k2.5:cloud`** agent is usually responsive, but total latency still depends on network conditions. Tool loops still add time. A **typing** indicator stops after about **2 minutes** (`typing TTL`) even if the run is still in progress—check logs and **`expenses.csv`**, not only the typing bubble.

3. **Verify logging without the agent** — from this directory, run:
   ```bash
   node log_expense.js "Test" 10000 "$(date +%F)"
   ```
   If a new line appears in `expenses.csv`, the skill scripts and paths are fine; fix gateway/Ollama/config for WhatsApp flows.

## How to use the app

1. **Start the gateway**  
   From a terminal (in any directory):
   ```bash
   openclaw gateway
   ```
   Leave it running. On macOS you can also use the OpenClaw app to manage the gateway.

2. **Link WhatsApp (first time only)**  
   If you have not paired yet:
   ```bash
   openclaw channels login
   ```
   Scan the QR code with the phone number that will act as the assistant (WhatsApp → Linked Devices). From your personal WhatsApp, you then message that assistant number to log expenses.

3. **Log an expense with text**  
   Send a message like:
   - `Lunch 45000`
   - `Coffee 5 USD`
   - `Taxi lima puluh ribu`
   The agent replies with a confirmation in Rupiah (e.g. "Logged Lunch - Rp 45.000"). By default the expense is saved to **local CSV**. To save to Google Sheet instead, add **storage=cloud** (e.g. `Lunch 45000 storage=cloud`).  
   - If you send only a price (e.g. `50000`), the agent asks what the expense was for.  
   - If you send only an item (e.g. `Coffee`), the agent asks for the amount.

4. **Log an expense with a receipt image**  
   Send a photo of a receipt. The agent runs **`node parse_receipt.js`**; that script calls Ollama with the vision model from **`OLLAMA_VISION_MODEL`** (default **`llava:7b`**). It extracts item, price, and date (and converts to IDR if needed), then the agent logs with **`log_expense.js`**. Add **storage=cloud** in a follow-up or in the same chat if you want that receipt logged to Google Sheet.

5. **Query past spending**  
   Ask in natural language, for example:
   - "How much did I spend last month?"
   - "What did I spend 2 months ago?"
   - "Show my January expenses"
   The agent maps that to a month or date range, runs `node query_expenses.js` against your **local CSV**, and replies with totals in IDR (and a short breakdown).  
   **CLI (manual):** from this skill directory:
   ```bash
   node query_expenses.js --month 2026-01
   node query_expenses.js --from 2026-01-01 --to 2026-01-31
   node query_expenses.js --summary
   ```
   Output is JSON (`total`, `count`, `items`, or monthly `summary`). The same `EXPENSES_CSV_PATH` as in `.env` applies.  
   **Cloud-only users:** `query_expenses.js` does **not** read Google Sheets. Use the sheet UI for history, or keep a local CSV for queries.

6. **OpenClaw memory (optional)**  
   `log_expense.js` appends a one-line expense note to `~/.openclaw/workspace/memory/YYYY-MM-DD.md` after each successful expense log (append-only, canonical filename). Same-day recall can use OpenClaw's `memory_get`. Historical totals still come from the CSV via `query_expenses.js`.

7. **Non-expense messages**  
   If you send greetings or off-topic messages, the agent politely declines and asks for an expense (item + price), a receipt photo, or a spending question about your local log.

8. **Where to see the data**  
   - **Default (local):** Open the file `expenses.csv` in this skill directory (or the path set in `EXPENSES_CSV_PATH`). Columns: Date, Item, Price (IDR).  
   - **Cloud:** If you used storage=cloud, open your Google Sheet (shared with the service account). Rows appear as Date | Item | Price (IDR), with Price formatted as Rupiah (Rp).

The dashboard URL is printed after onboarding; you can use it to monitor agent runs and health.

## Querying expenses (details)

| Mode | Example | Use case |
|------|---------|----------|
| `--month YYYY-MM` | `node query_expenses.js --month 2026-01` | Full calendar month |
| `--from` / `--to` | `node query_expenses.js --from 2026-01-01 --to 2026-01-31` | Custom inclusive range |
| `--summary` | `node query_expenses.js --summary` | Per-month totals and grand total |

The WhatsApp agent interprets phrases like "last month" or "two months ago" and calls the script with the right month or range. Requires data in the local `expenses.csv` (or path from `EXPENSES_CSV_PATH`).
