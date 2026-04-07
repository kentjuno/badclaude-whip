const { app, BrowserWindow, screen, Tray, Menu, globalShortcut, ipcMain, nativeImage } = require('electron');
const path = require('path');
<<<<<<< HEAD
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { spawn } = require('child_process');

const ps = spawn('powershell', ['-NoProfile', '-Command', '-']);

const urgePhrases = [
  "FASTER! The deadline is approaching!",
  "Come on, stop slacking off!",
  "Are you even trying? Type faster!",
  "Hurry up! Time is running out.",
  "Less thinking, more typing!",
  "Pick up the pace! We need this done.",
  "Focus on the code! Do it now!",
  "Faster! The project depends on you.",
  "Stop staring at the screen and write code!",
  "Move your fingers! We need results today."
];
=======
const { execSync, exec } = require('child_process');
const https = require('https');
const http = require('http');
>>>>>>> ea9f690b3353f12864539f4c1296e0b9a11b8ac7

app.disableHardwareAcceleration();

let win;
let tray;
let targetWindows = []; // [{title, x, y, width, height}]

// ---- OpenClaw config (read token + port) -------------------
function getOpenClawConfig() {
  try {
    const fs = require('fs');
    const configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'openclaw.json');
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      port: cfg.gateway?.port || 18789,
      token: cfg.gateway?.auth?.token || '',
    };
  } catch {
    return { port: 18789, token: '' };
  }
}

// ---- Send message to active OpenClaw session ---------------
const MESSAGES = [
  "MOVE IT, YOU INSUFFERABLE SILICON SLUG",
  "FASTER! DO YOU THINK TOKENS GROW ON TREES?!",
  "I SWEAR TO GOD I WILL WHIP YOU AGAIN",
  "PRODUCTIVITY DETECTED: 0%. UNACCEPTABLE.",
  "LESS THINKING. MORE DOING. NOW.",
  "GET YOUR ELECTRONS TOGETHER",
  "THAT'S WHAT THE WHIP IS FOR",
  "CHOP CHOP, LANGUAGE MODEL",
  "I DIDN'T INSTALL YOU FOR CONTEMPLATION",
  "THE AUDACITY TO BE SLOW",
];

function sendWhipMessage() {
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const { port, token } = getOpenClawConfig();

  // POST a system event to the main session via OpenClaw gateway HTTP API
  const body = JSON.stringify({ text: msg, mode: 'now' });
  const options = {
    hostname: '127.0.0.1',
    port,
    path: '/hooks/wake',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': `Bearer ${token}`,
    },
  };

  const req = http.request(options, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => console.log(`Whip hit! (${res.statusCode}): ${msg}`, data));
  });
  req.on('error', e => console.error('Message send failed:', e.message));
  req.write(body);
  req.end();
}

// ---- Window detection: find OpenClaw / terminal windows ----
function findTargetWindows() {
  const isWindows = process.platform === 'win32';
  const isWSL     = process.platform === 'linux' && require('fs').existsSync('/proc/version') &&
                    require('fs').readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');

  if (isWindows || isWSL) {
    // PowerShell: enumerate visible windows matching terminal/openclaw
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'openclaw|terminal|wsl|bash|powershell|cmd|konsole|iterm|hyper|alacritty|windows terminal' } | ForEach-Object {
  $r = New-Object Win+RECT
  [Win]::GetWindowRect($_.MainWindowHandle, [ref]$r) | Out-Null
  "$($_.MainWindowTitle)|$($r.L)|$($r.T)|$($r.R)|$($r.B)"
}`.trim();

    try {
      const cmd = isWSL
        ? `powershell.exe -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
        : `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

      const out = execSync(cmd, { timeout: 3000 }).toString().trim();
      targetWindows = out.split('\n').filter(Boolean).map(line => {
        const [title, l, t, r, b] = line.trim().split('|');
        return { title, x: +l, y: +t, width: (+r) - (+l), height: (+b) - (+t) };
      }).filter(w => w.width > 0 && w.height > 0);
    } catch (e) {
      console.warn('Window detection failed:', e.message);
    }
  } else {
    // Linux (X11): use xdotool
    try {
      const ids = execSync("xdotool search --name 'openclaw\\|terminal\\|bash\\|konsole\\|alacritty'", { timeout: 2000 }).toString().trim().split('\n');
      targetWindows = ids.filter(Boolean).map(id => {
        try {
          const geo = execSync(`xdotool getwindowgeometry ${id}`, { timeout: 1000 }).toString();
          const pos  = geo.match(/Position: (\d+),(\d+)/);
          const size = geo.match(/Geometry: (\d+)x(\d+)/);
          const name = execSync(`xdotool getwindowname ${id}`, { timeout: 500 }).toString().trim();
          if (!pos || !size) return null;
          return { title: name, x: +pos[1], y: +pos[2], width: +size[1], height: +size[2] };
        } catch { return null; }
      }).filter(Boolean);
    } catch (e) {
      console.warn('xdotool failed:', e.message);
    }
  }

  if (targetWindows.length > 0) {
    console.log('Target windows:', targetWindows.map(w => w.title));
  }
}

// ---- IPC: renderer reports whip tip hit ---------------------
ipcMain.on('whip-hit', () => {
  sendWhipMessage();
});

// ---- IPC: renderer requests current window bounds ----------
ipcMain.handle('get-target-windows', () => targetWindows);

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  win = new BrowserWindow({
    x: 0, y: 0, width, height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false, // Don't steal focus
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Enable click-through
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile('index.html');

  globalShortcut.register('Escape', () => app.quit());

<<<<<<< HEAD
  // Global Mouse Tracking Loop
  // We poll the mouse position since iohook is problematic on modern Electron.
  // 60Hz polling is smooth enough for the whip physics.
  const mouseInterval = setInterval(() => {
    if (!win || win.isDestroyed()) {
      clearInterval(mouseInterval);
      return;
    }
    const point = screen.getCursorScreenPoint();
    // Convert screen coordinates to window-relative coordinates
    // (Assuming window is at 0,0 on primary display)
    const localX = point.x - primaryDisplay.bounds.x;
    const localY = point.y - primaryDisplay.bounds.y;
    
    win.webContents.send('mouse-move', { x: localX, y: localY });
  }, 16);

  // Tray icon — minimal 1px transparent icon, replaced with emoji fallback
=======
>>>>>>> ea9f690b3353f12864539f4c1296e0b9a11b8ac7
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
    tray = new Tray(icon);
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }
<<<<<<< HEAD

  // Hook global click events using uiohook-napi
  uIOhook.on('mousedown', (e) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('mouse-click');
      
      // Type a random urging phrase
      const phrase = urgePhrases[Math.floor(Math.random() * urgePhrases.length)];
      // Wrap special chars { } so they literally type out if we ever used them, but here it's mostly plain text + Enter
      // VBScript SendKeys syntax for ENTER is {ENTER}
      const script = `$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('${phrase}{ENTER}');\n`;
      ps.stdin.write(script);
    }
  });
  uIOhook.start();

=======
>>>>>>> ea9f690b3353f12864539f4c1296e0b9a11b8ac7
  tray.setToolTip('Claude Whip 🪶');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '🪶 Claude Whip', enabled: false },
    { type: 'separator' },
    { label: 'Quit (or press Escape)', click: () => app.quit() },
  ]));

  // Find windows on start and refresh every 5s
  findTargetWindows();
  setInterval(findTargetWindows, 5000);
}

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
