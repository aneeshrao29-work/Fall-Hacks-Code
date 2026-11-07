# JepiTheGenie on Windows

Jepi floats over your whole screen. Press a hotkey and it finds what's wrong, flies there and points at it.
Works on **Windows 10 (version 2004 or newer) and Windows 11**.

---

## 1. Install Node.js (gives you `npm`) — once

**Option A – installer:** go to **nodejs.org** → click the **LTS** button → run the `.msi` → Next, Next, Next (keep "Add to PATH" ticked).

**Option B – one command** (PowerShell):
```powershell
winget install OpenJS.NodeJS.LTS
```

Then **close every PowerShell / Command Prompt window and open a new one**, and check:
```powershell
node -v
npm -v
```
Both should print a version number.

## 2. Get the code

**With Git:**
```powershell
git clone https://github.com/aneeshrao29-work/Fall-Hacks-Code.git
cd Fall-Hacks-Code
```
**Without Git:** on the GitHub page click **Code → Download ZIP**, unzip it, then in PowerShell `cd` into the unzipped folder
(tip: type `cd ` then drag the folder onto the PowerShell window).

## 3. Install Jepi's parts — once
```powershell
npm install
```
(Downloads Electron, ~100 MB. Takes a minute.)

## 4. Add your Gemini key — once
1. Get a free key at **aistudio.google.com/apikey**.
2. Create your key file and open it:
```powershell
copy .env.example .env
notepad .env
```
3. Replace `paste-your-key-here` with your key, so the line looks like `GEMINI_API_KEY=AQ.xxxxx...` → **save** → close Notepad.

> Never share or commit `.env` — git already ignores it.

## 5. Run it
```powershell
npm start
```
A pie pops up in the bottom-right corner, Jepi climbs out, and says hi. 🥧

---

## Controls (Windows uses **Ctrl** where Mac uses ⌘)

| Do this | What happens |
|---|---|
| **Ctrl + Shift + Space** | Jepi looks at your screen, flies to what's wrong, pins it |
| **🐞 check code** (button under Jepi) | Code review: finds the main bug + a tip to make it simpler/faster |
| **Ctrl + Shift + A** | "Make a wish…" — ask Jepi anything about your screen |
| **Click Jepi** | Menu: modes (help / roast / watch), personas, wardrobe, sleep, sound |
| **Double-click Jepi** | Poke it 😤 |
| **Drag Jepi** | Move it anywhere (it stays there) |
| **Ctrl + Shift + H** | Hide / show Jepi |
| **Ctrl + Shift + X** or **Esc** | Clear the pins, Jepi flies home |
| **Ctrl + Alt + D** | Offline demo (no internet needed) — open `docs/demo.py` full-screen first |
| **Ctrl + Shift + Q** | Quit |

**In an answer bubble:** 🛠 **apply fix** (shows the change, asks ✅/✖, then edits your file — with ↩ undo),
📋 **copy fix**, 🧒 **eli5**, ↩ **ask more**. Click the bubble to dismiss it.

The first time you apply a fix, Jepi may ask you to pick the file — it remembers your project folder after that.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` / `node` "is not recognized" | Close and reopen the terminal. Still broken? Restart the PC. |
| "running scripts is disabled on this system" | Run once in PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` → **Y**. Or use **Command Prompt** (`cmd`) instead. |
| `npm install` fails behind campus Wi-Fi | Retry, or switch to a phone hotspot for the install only. |
| Jepi says *"GEMINI_API_KEY missing"* | `.env` isn't saved, is named `.env.txt`, or is in the wrong folder. In the project folder run `dir /a` — you should see `.env` (no `.txt`). Fix: `ren .env.txt .env` |
| Jepi says *"gemini is taking forever"* / 429 | Free-key rate limit. Wait a minute, or use a teammate's key in `.env`. Jepi auto-falls back to a faster model. |
| Ctrl+Shift+Space does nothing | Another app grabbed that shortcut (some keyboard/language switchers do). Click Jepi → 👀 instead, or close that app. |
| Jepi says it sees a **black screen** | Jepi auto-switches to a fallback capture mode (it may blink for a split second when it looks). If it still says black: update Windows (Settings → Windows Update) and restart Jepi. |
| Jepi feels laggy on an older laptop | It turns on **lite mode** automatically on 4-core / low-RAM machines (fewer idle animations). Closing heavy apps helps too. |
| The pin is in the wrong place | Make sure Display scaling is the same on every monitor, or use Jepi on your main monitor. |
| Emojis look like boxes | Update Windows; it ships the color emoji font. |
| Can't find how to quit | **Ctrl + Shift + Q**, or click Jepi → ✕. |

## Run it again later
```powershell
cd path\to\Fall-Hacks-Code
npm start
```
(Steps 1-4 are one-time only.)
