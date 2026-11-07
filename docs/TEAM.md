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

## Who does what
| Person | Job | Done when |
|---|---|---|
| **Tejas** (driver) | Codes with Claude, merges, runs the demo laptop | App works end-to-end |
| **Teammate 2** (tester) | Runs it on their own laptop (Windows if possible), builds the **demo screens** (prompt 4), reports bugs as screenshots | 5 demo screens ready, bug list sent |
| **Teammate 3** (Devpost) | Devpost page + thumbnail (prompts 1, 2). **Early submit by 1:30** | Devpost live, tracks ticked |
| **Teammate 4** (story) | Demo video script + recording + 2-min pitch + judge Q&A (prompts 3, 5) | Video uploaded by 6:00, pitch rehearsed 2x |

Bug report format to send Tejas: *what you did → what happened → screenshot*.

---

## Prompts for other AIs (copy-paste exactly, send the result back to Tejas)

### 1. Devpost write-up (ChatGPT or Gemini)
```
You are writing a Devpost submission for a 12-hour beginner hackathon (CSSS Fall Hacks 2026, SFU,
theme "Digital Sidekick"). Project facts — do not invent features beyond these:
- Name: JepiTheGenie (Jepi for short), a pixel genie summoned from a cherry pie. A tiny 8-bit pixel robot mascot (split teal/blue face, big sparkly eyes, noodle arms, pops out of a cherry pie, dusts off, yeets the pie).
- Desktop app (Electron) that hovers as a transparent always-on-top overlay over the whole screen.
- Hotkey (Cmd/Ctrl+Shift+Space) → screenshots the screen → Gemini API (vision + structured JSON output) →
  Jepi explains what's wrong in a caption bubble AND draws a pulsing box + curved arrow on the exact spot,
  using Gemini's normalized bounding boxes (box_2d).
- Modes: Help (pinpoint what's wrong), Roast (lovingly roasts your screen), Watch (auto check-in every 20s).
- 6 personas with costumes: Gen Z bestie (bow), Brainrot (propeller hat), LinkedIn bro (shades + tie),
  Drama queen (crown), Cat (ears + whiskers), Cyber grandma (glasses + bun).
- Aura points (-67..+67 per look) for how productive your screen is; "6-7" easter egg; captions instead of voice.
- Click-through overlay, draggable mascot, eyes follow your cursor, animated moods (hype, sassy, shook, judging, sad, 6-7).
- Built with Electron, plain HTML/CSS/JS, hand-drawn SVG mascot animated with CSS, Gemini API. No frameworks.
Tracks: MLH Best Use of Gemini API, SURGE (solves a daily minor inconvenience), Best Use of Theme, Best Design.

Write these Devpost sections, casual-but-clear student voice, a little funny, no buzzword soup:
Inspiration / What it does / How we built it / Challenges we ran into / Accomplishments we're proud of /
What we learned / What's next for Jepi.
Also: a one-line tagline (max 60 chars) and a 200-character short description.
Output as Markdown with each section as a ## heading. Nothing else.
```

### 2. Devpost thumbnail (Gemini image / ChatGPT image) — attach the original mascot drawing
```
Using the attached mascot exactly as drawn (redraw it as 8-bit pixel art but keep its asymmetric boxy head, split teal/light-blue
face, navy/pink/red side tabs, big eyes, noodle arms, cherry pie seat), make a 1280x720 hackathon thumbnail.
Scene: the mascot floats in the corner of a laptop screen showing code; a thick red rounded box with a label
"missing bracket" highlights one line, with a dashed red arrow from the mascot's hand to it.
Big chunky title text "jepi" in pixel letters, subtitle "your sassy screen sidekick".
Style: cream background, thick black outlines, flat colors, hard drop shadows, sticker/neo-brutalist, cute.
No other text, no logos.
```

### 3. 90-second demo video script (ChatGPT or Gemini)
```
Write a 90-second screen-recorded demo script for "Jepi", a hovering AI desktop sidekick (facts below).
Format as a table: Time | What's on screen | What we say (voiceover) | Action (keys/clicks).
Beats: hook (0-8s, a relatable "why is my code broken" moment) → press Cmd+Shift+Space, Jepi pinpoints a
missing bracket with a box+arrow → Roast mode on a YouTube tab (negative aura, Jepi judges) → switch persona
to Cyber Grandma then Brainrot on the same screen (contrast for laughs) → type 67 (6-7 explosion) →
closing line with name + "built with Gemini". Keep voiceover lines short and punchy, Gen Z humor, clean.
Facts: [paste the bullet list from prompt 1]
```

### 4. Demo screens to test on (ChatGPT) — tester runs these
```
Give me 5 small, realistic "broken screen" setups to demo an AI that looks at a screenshot and pinpoints
what's wrong. For each: a title, the exact file content to open (max 25 lines each), and the ONE bug the AI
should find (with its line number). Mix: Python with a missing colon, JavaScript with a typo'd variable,
an HTML page with a broken image tag, an essay paragraph with a glaring typo and wrong date, and a
spreadsheet-style CSV where one total is wrong. Bugs must be visible on screen, not runtime-only.
Output as Markdown, each in a fenced code block with the right language tag.
```

### 5. Pitch + judge Q&A (ChatGPT or Gemini)
```
Write a 2-minute pitch for "Jepi" for hackathon judges (facts below), structured: problem (10s) →
live demo cues (60s) → how it works incl. Gemini bounding boxes + structured JSON (25s) → why it fits theme
"Digital Sidekick" and the SURGE "daily minor inconvenience" track (15s) → what's next (10s).
Then list the 8 most likely judge questions with 1-2 sentence answers (privacy of screenshots, why not
just ChatGPT, accuracy of boxes, cost, how personas work, multi-monitor, what was hardest, what we'd add).
Facts: [paste the bullet list from prompt 1]
```

### 6. More giggles (ChatGPT) — paste result back so Tejas can drop it in the code
```
Jepi is a cute sassy robot sidekick with 6 personas: bestie (Gen Z), brainrot, linkedin (thought-leader bro),
drama (theatre kid), cat, grandma (sweet, gets slang slightly wrong). Write 6 NEW funny "poke" reactions
(said when the user clicks the mascot) and 1 NEW greeting per persona. Max 12 words each, clean, emojis OK.
Output ONLY valid JSON exactly in this shape:
{"bestie":{"hello":"...","pokes":["...","...","...","...","...","..."]},"brainrot":{...},"linkedin":{...},
"drama":{...},"cat":{...},"grandma":{...}}
```

### 7. Full project brief → ask any AI for suggestions (ChatGPT / Gemini / Claude)
```
I'm at a 12-hour beginner hackathon (CSSS Fall Hacks 2026, Simon Fraser University). Theme: "Digital Sidekick".
Hacking ends 6:30 PM, judging 7:00 PM (live demo to industry judges, ~3 min per team). I want sharp, practical
suggestions to make our project win. Here is everything about it.

PROJECT: JepiTheGenie ("Jepi")
- Jepi is the official Fall Hacks mascot: a little robot that's secretly a Raspberry Pi — wide green board-like
  head with a light-blue strip on the right, a mint dot, a tall pill-shaped eye + a square eye, a crooked line
  mouth, a column of colored "ports" on its left (navy block, pink pill, red bar), and 7 connector pins as legs.
- We turned Jepi into a desktop sidekick: a tiny 8-bit pixel-art character that hovers over your WHOLE screen
  (transparent, always-on-top, click-through overlay). Only the mascot is visible; everything else is hidden.

HOW IT WORKS (user flow)
1. On launch Jepi is "summoned": a pixel cherry pie pops up, Jepi climbs out of it, dusts off crumbs, yeets the pie.
2. User presses Cmd/Ctrl+Shift+Space. Jepi revolves in 2.5D (it has a real depth box: front face, back view,
   Raspberry-Pi side panels with ports, GPIO-header lid) while a scan line sweeps the screen.
3. The app screenshots the screen and sends it to the Gemini API (vision + structured JSON output). Gemini returns:
   reply (caption text), mood, aura (-67..+67 productivity score), and targets = bounding boxes (box_2d,
   normalized 0-1000) of the exact things that are wrong.
4. Jepi FLIES across the screen in an arc leaving a pixel trail, parks next to the problem, and points at it with
   its arm. The problem gets a flashing pixel frame + label ("missing bracket"). The answer appears in a pixel comic
   speech bubble (captions only, no voice). After 30s Jepi flies back to its corner.
- Cmd+Shift+A (or the 💬 button) opens a clean "make a wish…" prompt bubble to ask a specific question.
- Click Jepi → a hidden customizer pops up: modes, personas, wardrobe. Double-click = poke (it reacts). Drag to move.
- Modes: Help (pinpoint what's wrong), Roast (lovingly roasts your screen), Watch (auto-checks every 20s).
- Personas (each changes the AI's voice + a signature outfit): Gen Z bestie, Brainrot, LinkedIn thought-leader bro,
  Theatre-kid drama queen, Cat, Cyber grandma. Humor: Gen Z slang, "aura points", the "6-7" meme (typing 67 or
  Gemini saying it triggers a 6-7 explosion of floating numbers).
- Wardrobe: hats (cap, crown, propeller, wizard, cowboy, beanie, halo, cat ears, bow), face (shades, specs,
  mustache, blush), fit (tie, bowtie, scarf, cape), flight trail (sparkles, hearts, stars, coins, rainbow, 67s).
- Moods are animated with choppy steps() frames: hype, sassy, shook, judging, sad, thinking, 6-7.

TECH
- Electron (transparent frameless always-on-top window, setIgnoreMouseEvents for click-through, desktopCapturer for
  the screenshot, globalShortcut for hotkeys). Plain HTML/CSS/JS, no framework. The sprite is generated SVG pixel
  rects animated with CSS; 2.5D uses CSS 3D transforms (preserve-3d). Gemini via REST: gemini-3.5-flash with low
  thinking (~5s), automatic fallback to flash-lite models with a 25s timeout. API key stays in the main process.
- Team: 2-4 students, mostly beginners, one laptop runs the demo (macOS), ~5 hours left.

PRIZE TRACKS WE'RE TARGETING: Best Use of Theme ("Digital Sidekick"), MLH Best Use of Gemini API, SURGE track
("solve a small day-to-day inconvenience"), Best Design/UI/UX. Also Best Overall.

WHAT I WANT FROM YOU (be concrete, no generic advice):
1. Top 5 improvements that would most impress judges, ranked by (wow factor ÷ hours to build). For each: what it is,
   why judges care, and roughly how to build it in our stack in under 1 hour.
2. 3 risks that could break our live demo and how to de-risk each (e.g., slow API, wrong boxes, permissions).
3. A tight 3-minute demo storyline (what to show, in what order, what to say) that hits all 4 tracks.
4. How to clearly show "Best Use of Gemini" (what technical points to say out loud).
5. 3 judge questions we'll likely get + strong 1-sentence answers.
6. Anything about the concept that feels confusing or weak, and how to fix it fast.
Format: numbered sections, bullet points, short.
```

### 8. UI/UX + design + functionality review (attach 3-4 screenshots: idle Jepi, the click menu, a pinpointed bug, the wish bubble)
```
You are a senior product designer + UX engineer reviewing a hackathon project before a live demo to judges
(CSSS Fall Hacks 2026 at SFU, theme "Digital Sidekick"; ~4 hours of build time left; 2-4 beginner devs).
I attached screenshots. Give brutally specific feedback I can act on in under an hour per item.

WHAT IT IS — JepiTheGenie
A desktop sidekick that floats over the whole screen (macOS/Windows, Electron transparent always-on-top
click-through overlay). Only the mascot is visible: Jepi, the Fall Hacks mascot, a tiny robot that is secretly a
Raspberry Pi (wide green board head, light-blue strip, mint dot, pill eye + square eye, crooked mouth, colored
port tabs on its left, 7 connector-pin legs). Drawn as 8-bit pixel art (~66x71 px on screen), with a 2.5D body:
CSS 3D front face, back view, side panels showing the ports, GPIO-header lid.

CURRENT UX
- Launch: a pixel cherry pie pops up, Jepi climbs out, dusts off crumbs, yeets the pie, says hello in a speech bubble.
- Cmd/Ctrl+Shift+Space = "look": Jepi spins 360° in 2.5D while a mint scan line sweeps the screen (~5-7s),
  screenshot → Gemini (vision + JSON: reply, mood, aura score, up to 3 bounding boxes). Then Jepi flies in a smooth
  arc leaving a trail (pie crumbs, hearts, stars, coins, rainbow, 67s), parks beside the problem and points with
  its arm; a pixel pointing-glove cursor slides out and taps the problem; the problem gets a flashing pixel frame +
  label; the answer appears in a pixel comic speech bubble (captions, no voice) that fades after 30s, then Jepi
  flies back.
- Cmd/Ctrl+Shift+A or 💬 = a small "make a wish…" input bubble beside Jepi.
- Click Jepi = hidden menu: look 👀, wish 💬, modes (🤓 help / 🔥 roast / 🕵️ watch every 20s), persona 💅,
  wardrobe 👕, quit ✕. Double-click = poke (funny reaction). Drag = move (Jepi stays where you drop it).
- Personas change AI voice + outfit: Gen Z bestie, brainrot, LinkedIn bro, drama queen, cat, cyber grandma.
- Wardrobe (emoji grid): 9 hats, 4 face items, 4 outfits, 7 trails. Aura counter badge (-67..+67), "6-7" meme
  easter egg, moods animated in choppy 8-bit steps. Follows you across monitors and hops when you switch macOS
  desktops. Pixel font (Pixelify Sans), notched NES-style borders, cream/teal/blue/pink/red/navy palette.

REVIEW IT ON (numbered, max 5 bullets each, every bullet = problem → concrete fix):
1. First-time user experience: will a judge understand what to do in 10 seconds with only a mascot on screen?
2. Visual design: pixel-art consistency, readability of the speech bubble and labels over busy screens (code
   editors, light AND dark backgrounds), size/contrast of the pointer + frames, palette, typography.
3. Motion design: is the summon/fly/point/spin choreography clear or distracting? timing suggestions.
4. Interaction design: click vs double-click vs drag, the hidden menu, the wish bubble, hotkeys, closing things.
5. Trust + privacy: the app screenshots the screen — how should we signal it and give control?
6. Accessibility quick wins (reduced motion, captions, contrast, keyboard).
7. Functionality: 5 features that would make it genuinely useful daily (e.g., copy-the-fix button, follow-up
   questions, history), ranked by usefulness ÷ build time, each with a 2-line implementation idea.
8. Delight: 5 small touches that would make judges laugh or say "aww" (keep it clean).
9. The single biggest weakness of the whole thing and how to fix it today.
Be blunt. No generic advice like "improve usability" — name the exact element and the exact change.
```
