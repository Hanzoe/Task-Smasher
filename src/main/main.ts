import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'

// Data store path
const appDataPath = app.getPath('userData');
const configPath = join(appDataPath, 'config.json');

// Read config to see if a custom data path is set
let customDataPath = '';
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.dataPath) {
      customDataPath = config.dataPath;
    }
  }
} catch (e) {
  console.error('Failed to read config', e);
}

// Ensure the target data path exists if custom
let activeDataPath = appDataPath;
if (customDataPath) {
  if (!fs.existsSync(customDataPath)) {
    fs.mkdirSync(customDataPath, { recursive: true });
  }
  activeDataPath = customDataPath;
}

const storePath = join(activeDataPath, 'todos.json');
const notesPath = join(activeDataPath, 'daily-notes.json');
const imagesDir = join(activeDataPath, 'images');

// Ensure image directory exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Disable Hardware Acceleration for power savings
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    frame: false, // Frameless window for custom premium titlebar
    transparent: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: false // allow local files to be loaded
    },
  })

  // In development mode, Vite's dev server URL is injected into env
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // mainWindow.webContents.openDevTools()
  } else {
    // In production, Vite outputs the renderer to dist/index.html
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
  mainWindow.center() // Always appear in screen center
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers for Window Management
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-close', () => {
  mainWindow?.close()
})

ipcMain.on('toggle-mini-mode', (_, isMini: boolean) => {
  if (!mainWindow) return
  
  if (isMini) {
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.setMinimumSize(200, 180)
    mainWindow.setSize(300, 480) // smaller default, user can resize freely
    mainWindow.setResizable(true) // ensure resizable
  } else {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setMinimumSize(700, 500)
    mainWindow.setSize(900, 680)
    mainWindow.setResizable(true)
    mainWindow.center()
  }
})

// Store Handlers
ipcMain.handle('get-todos', () => {
  try {
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, 'utf8'))
    }
  } catch (error) {
    console.error('Failed to read todos', error)
  }
  return []
})

ipcMain.on('save-todos', async (_, todos) => {
  try {
    const data = JSON.stringify(todos);
    await fs.promises.writeFile(storePath, data, 'utf8');
  } catch (error) {
    console.error('Failed to save todos', error)
  }
})

// Daily Notes Handlers
ipcMain.handle('get-notes', () => {
  try {
    if (fs.existsSync(notesPath)) {
      return JSON.parse(fs.readFileSync(notesPath, 'utf8'))
    }
  } catch (error) {
    console.error('Failed to read notes', error)
  }
  return {} // returns a map of date -> text
})

ipcMain.on('save-notes', async (_, notes) => {
  try {
    const data = JSON.stringify(notes);
    await fs.promises.writeFile(notesPath, data, 'utf8');
  } catch (error) {
    console.error('Failed to save notes', error)
  }
})

ipcMain.handle('save-image', (_, sourcePath: string) => {
  try {
    const ext = sourcePath.split('.').pop() || 'png'
    const fileName = `${randomUUID()}.${ext}`
    const destPath = join(imagesDir, fileName)
    fs.copyFileSync(sourcePath, destPath)
    // Return relative or local file uri
    return `file://${destPath.replace(/\\/g, '/')}`
  } catch (error) {
    console.error('Failed to save image', error)
    return null
  }
})

ipcMain.handle('save-image-from-buffer', (_, buffer: ArrayBuffer, mimeType: string) => {
  try {
    const ext = mimeType.split('/')[1] || 'png'
    const fileName = `${randomUUID()}.${ext}`
    const destPath = join(imagesDir, fileName)
    fs.writeFileSync(destPath, Buffer.from(buffer))
    return `file://${destPath.replace(/\\/g, '/')}`
  } catch (error) {
    console.error('Failed to save pasted image', error)
    return null
  }
})

// Settings Handlers
ipcMain.handle('get-config', () => {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}
  return { customDataPath: '' };
});

ipcMain.on('save-config', async (_, cfg) => {
  try {
    const data = JSON.stringify(cfg);
    await fs.promises.writeFile(configPath, data, 'utf8');
  } catch (e) {}
});

ipcMain.handle('select-folder', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
