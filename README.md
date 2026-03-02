# Task Smasher 🗡️

> **任务粉碎者** — A powerful Eisenhower Matrix daily planner for Windows built with Electron + Vite + TypeScript.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📅 **Calendar-First Navigation** | Monthly calendar grid as the home screen. Click any day to enter daily view |
| 🔴🟡🔵⚪ **Eisenhower Matrix** | Categorize tasks into 4 urgency/importance quadrants |
| 🖊️ **Typora-like WYSIWYG Editor** | Click any task to get a full instant-rendering Markdown panel (powered by Vditor IR mode) |
| 📌 **Mini / Sticky-Note Mode** | Collapse to a compact, semi-transparent floating window showing today's tasks |
| 🖼️ **Image Support** | Paste images directly with `Ctrl+V` or drag & drop — they're auto-saved and embedded |
| 🔁 **Recurring Tasks** | Daily / Weekly / Monthly tasks with per-day completion tracking |
| 📝 **Daily Thoughts Journal** | A dedicated notes area per day, saved separately from tasks |
| 🤌 **Drag & Drop** | Move tasks between quadrants with native HTML5 drag & drop |

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Development
```bash
npm install
npm run dev
```

### Build a Windows `.exe` installer
```bash
npm run build
```
> The installer will be generated in the `release/` folder as a `Task Smasher Setup x.x.x.exe`.

---

## 🗂️ Project Structure

```
src/
├── main/           # Electron main process (IPC, window, file I/O)
├── preload/        # Secure bridge between main and renderer
└── renderer/       # Frontend UI (HTML/CSS/TypeScript)
    ├── main.ts     # App logic & rendering
    └── style.css   # Global stylesheet (glassmorphism design system)
public/             # Static assets (icons, etc.)
```

---

## 📦 Tech Stack

- **Runtime**: [Electron](https://electronjs.org) v29
- **Bundler**: [Vite](https://vitejs.dev) v5  
- **Language**: TypeScript
- **Markdown Editor**: [Vditor](https://b3log.org/vditor/) (IR mode)
- **Installer**: electron-builder (NSIS)

---

## 🗄️ Data Storage

All user data is stored locally in the app's data directory:
- `todos.json` — all tasks
- `daily-notes.json` — daily journal entries
- `images/` — attached images

No cloud sync, no telemetry. Your data stays on your machine.

---

## 📄 License

MIT
