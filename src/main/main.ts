import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'

// Data store path
const appDataPath = app.getPath('userData')
const storePath = join(appDataPath, 'todos.json')
const notesPath = join(appDataPath, 'daily-notes.json')
const imagesDir = join(appDataPath, 'images')

// Ensure image directory exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true })
}

// Disable Hardware Acceleration for power savings
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    minWidth: 400,
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
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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
    mainWindow.setSize(300, 400)
    // Optional: move to top right or somewhere
  } else {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSize(600, 800)
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

ipcMain.on('save-todos', (_, todos) => {
  try {
    fs.writeFileSync(storePath, JSON.stringify(todos))
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

ipcMain.on('save-notes', (_, notes) => {
  try {
    fs.writeFileSync(notesPath, JSON.stringify(notes))
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
