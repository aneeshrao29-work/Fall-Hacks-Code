// Renders docs/thumbnail.html -> docs/thumbnail.png (1500x1000, 3:2 for Devpost).
// Run from repo root: npx electron docs/render-thumbnail.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1500, height: 1000, show: false, useContentSize: true, enableLargerThanScreen: true });
  await win.loadFile(path.join(__dirname, 'thumbnail.html'));
  // web fonts load lazily; ask for each face explicitly before capturing
  await win.webContents.executeJavaScript(`Promise.all(['700 40px "Pixelify Sans"', '600 40px "Pixelify Sans"',
    '500 25px "JetBrains Mono"', '700 25px "JetBrains Mono"'].map((f) => document.fonts.load(f)))
    .then(() => new Promise((r) => setTimeout(r, 500)))`);
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1500, height: 1000 });
  fs.writeFileSync(path.join(__dirname, 'thumbnail.png'), img.toPNG());
  app.quit();
});
