# JepiTheGenie — Team Game Plan (Fall Hacks 2026)

**JepiTheGenie** (Jepi for short) = a sassy pixel genie, hovering AI sidekick. It floats over your whole screen, screenshots it on a hotkey,
asks Gemini what's wrong, then **draws a box + arrow on the exact spot** with a caption (CC, no voice).
Personas: Gen Z bestie, brainrot, LinkedIn bro, drama queen, cat, cyber grandma. Aura points. 6-7.

Prize targets: **Best Use of Theme**, **MLH Best Use of Gemini API**, **SURGE** (fixes a daily annoyance:
"what's wrong on my screen?"), **Best Design**. Tick MLH + SURGE on Devpost or we're not eligible.

## Deadlines (today)
| Time | What |
|---|---|
| **1:30–2:00 PM** | Early submission on **Devpost** (name: Jepi, short description, repo link, tracks ticked) |
| 5:30 | Dinner — demo video should already be recorded |
| **6:30 PM** | Final submission on **MLH portal** (demo video link + repo link) |
| 7:00–8:30 | Judging — room posted on Discord |

## Run it (everyone)
```bash
git clone https://github.com/aneeshrao29-work/Fall-Hacks-Code.git
cd Fall-Hacks-Code
npm install
cp .env.example .env      # then paste your key from https://aistudio.google.com/apikey
npm start
```
macOS: first run asks for **Screen Recording** permission → allow it, then quit (⌘⇧Q) and `npm start` again.
**Windows step-by-step (incl. installing npm):** see [`docs/WINDOWS.md`](WINDOWS.md).
**Windows / Linux:** same steps; every ⌘ shortcut is **Ctrl** instead (Ctrl+Shift+Space, Ctrl+Shift+A, …) and Jepi's captions say so automatically.
Linux needs a compositing desktop (GNOME/KDE on X11 works best); on Wayland the system may ask to approve each screen capture.
Emoji need an emoji font on Linux (`sudo apt install fonts-noto-color-emoji`).

| Hotkey | Does |
|---|---|
| ⌘/Ctrl ⇧ Space | Jepi looks at your screen + pinpoints |
| ⌘/Ctrl ⇧ A | Ask Jepi a question |
| ⌘/Ctrl ⇧ H | Hide / show Jepi |
| ⌘/Ctrl ⇧ X | Clear the pins |
| ⌘/Ctrl ⇧ Q | Quit |
| ⌘/Ctrl ⌥ D | **Offline demo run** (no Wi-Fi needed) — open `docs/demo.py` full-screen first |
| Esc | Close everything, Jepi flies home |
Drag Jepi anywhere. Click Jepi to poke it. Type `67` for a surprise.

## Tests
```bash
npm test                       # 41 unit + 30 end-to-end tests (real app, fake Gemini, fails on any JS error)
ONLY="syllabus" npx electron tests/e2e.js   # run one end-to-end test by name
```

## Who does what
| Person | Job | Done when |
|---|---|---|
| **Tejas** (driver) | Codes with Claude, merges, runs the demo laptop | App works end-to-end |
| **Allen** (tester) | Runs it on their own laptop (Windows if possible), builds the **demo screens** (prompt 4), reports bugs as screenshots | 5 demo screens ready, bug list sent |
| **Aneesh** (Devpost) | Devpost page + thumbnail (prompts 1, 2). **Early submit by 1:30** | Devpost live, tracks ticked |
| **Chirty** (story) | Demo video script + recording + 2-min pitch + judge Q&A (prompts 3, 5) | Video uploaded by 6:00, pitch rehearsed 2x |

Bug report format to send Tejas: *what you did → what happened → screenshot*.
 ---
