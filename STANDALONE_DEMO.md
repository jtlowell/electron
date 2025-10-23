# Quick Demo - No Build Required

Since building Electron from source takes hours, here's the fastest way to see the demo:

## Option 1: Use Electron from npm (RECOMMENDED - 2 minutes)

```bash
# On your Mac, in a new directory
mkdir reddit-demo && cd reddit-demo

# Copy these files from the electron repo:
# - default_app/reddit-search.html
# - default_app/reddit-search.js

# Create package.json
cat > package.json << 'PACKAGE'
{
  "name": "reddit-demo",
  "version": "1.0.0",
  "main": "main-simple.js",
  "scripts": {
    "start": "electron ."
  }
}
PACKAGE

# Create main-simple.js (see below)

# Install electron
npm install electron

# Run it
npm start
```

## Option 2: Build Electron (1-2 hours)

If you want to build from source:

```bash
cd ~/Downloads/electron-main

# Install build dependencies
npm install

# Build Electron (this takes 1-2 hours!)
npm run build

# Then run the demo
npm start default_app/reddit-search.html
```

## Option 3: Set ELECTRON_OUT_DIR

If you have a pre-built Electron somewhere:

```bash
export ELECTRON_OUT_DIR=/path/to/electron/out/Release
npm start default_app/reddit-search.html
```

---

# Files for Option 1

Create `main-simple.js`:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false  // Simplified for demo
    }
  });

  win.loadFile('reddit-search.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

Note: This simplified version won't have the full IPC security but will show the UI.
For the full working version with Reddit API, you'll need to build Electron or wait for my standalone package.

