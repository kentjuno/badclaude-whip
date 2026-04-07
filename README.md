# 🪶 Claude Whip

> A PC app that turns your mouse cursor into a physics-enabled whip overlay. Whip any window and yell at Claude (or yourself) to work faster. Completely useless. Absolutely necessary.

## Features

- **Global Click-Through Overlay:** A full-screen invisible window floats above all your applications, rendering a beautiful physics-enabled whip attached to your cursor.
- **Ultra-Smooth Verlet Physics:** Powered by a 60-node 2D Verlet physics simulation running with 2x sub-stepping per frame. The whip bends, snaps, and curls majestically based on how you move your mouse.
- **Global Input Hook:** Uses `uiohook-napi` to detect mouse clicks anywhere globally, without stealing window focus.
- **Auto "Work Faster" Typing:** Every time you click your mouse (crack the whip), the app uses a hidden PowerShell process to randomly type out an urging phrase on your screen like *"FASTER! The deadline is approaching!"* and presses Enter.
- **Sound Effects:** Features realistic whip-crack sounds locally injected into the process audio.

## Installation

### Requirements
- [Node.js](https://nodejs.org) v18+ (v20+ recommended)
- Windows OS (Currently optimized for Windows due to the PowerShell text automation feature)

### Setup

```bash
# Clone the repository
git clone 
cd claude-whip

# Install dependencies (Downloads Electron and compiles uiohook-napi native module)
npm install
```

> [!NOTE]
> Ensure you have standard build tools installed to compile `uiohook-napi` (e.g. `windows-build-tools` or Visual Studio C++ desktop workload).

## Running the App

```bash
npm start
```
*Your screen will immediately become a canvas for the whip. The whip handle tracks your mouse cursor.*

## Controls

| Action | How |
|---|---|
| **Whip Movement** | Move your mouse across the screen to feel the rope physics. |
| **Crack the Whip** | Left Click anywhere on your screen. This will play a sound and auto-type a phrase via keyboard emulation. |
| **Quit App** | Press the **Escape (Esc)** key globally, or right-click the Tray icon and click "Quit". |

## Under the Hood

| Layer | Tool |
|---|---|
| App Shell | Electron (transparent, borderless, click-through window) |
| Global Hooks | `uiohook-napi` for catching system-wide mouse clicks |
| Rendering | Hardware-accelerated HTML5 Canvas (`renderer.js`) |
| Keyboard Automation | Ephemeral `child_process` running `wscript.shell` SendKeys |
| Loop | Custom `requestAnimationFrame` with simulated double sub-stepping for ultra-fast wave propagation. |

## Troubleshooting

- **No Sound:** Ensure your local machine's system volume is up, and `crack_the_whip.mp3` exists in the `assets/` folder.
- **Typing isn't working:** The automation relies on a `powershell` background process. Ensure PowerShell is accessible in your environment variables.
- **App falls behind other windows:** The window is set to `alwaysOnTop: true`. If another aggressive app steals the topmost layer, simply re-run Claude Whip.
