import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron'
import path from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getDbPath() {
  const userDataDir = app.getPath('userData')
  const dataDir = path.join(userDataDir, 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'db.json')
}

function getImagesDir() {
  const userDataDir = app.getPath('userData')
  const imagesDir = path.join(userDataDir, 'images')
  if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })
  return imagesDir
}

function ensureDB() {
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) {
    const initial = {
      currentUserId: 'user-1',
      users: [{
        id: 'user-1',
        name: 'Me',
        role: 'User',
        avatar: '',
        processes: [],
        steps: []
      }],
      theme: 'light'
    }
    writeFileSync(dbPath, JSON.stringify(initial, null, 2))
  }
}

function readDB() {
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) ensureDB()
  return JSON.parse(readFileSync(dbPath, 'utf-8'))
}

function writeDB(db) {
  const dbPath = getDbPath()
  writeFileSync(dbPath, JSON.stringify(db, null, 2))
}

// Migrate legacy backup shape (single profile) to current multi-user shape
function migrateBackupIfNeeded(d) {
  if (!d) return d
  const isLegacy = d.profile && Array.isArray(d.processes) && Array.isArray(d.steps)
  if (isLegacy) {
    const userId = d.currentUserId || 'user-1'
    return {
      currentUserId: userId,
      users: [{
        id: userId,
        name: d.profile.name || 'Me',
        role: d.profile.role || 'User',
        avatar: d.profile.avatar || '',
        processes: d.processes || [],
        steps: d.steps || []
      }],
      theme: d.theme || 'light'
    }
  }
  // If already in new shape, return as-is
  if (Array.isArray(d.users)) return d
  return d
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121212' : '#ffffff',
    webPreferences: {
      // Preload must be CommonJS; Electron loads it in isolated world
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  const isDev = !app.isPackaged
  if (isDev) {
    const defaultPort = process.env.VITE_PORT || 5174
    const devUrlEnv = process.env.VITE_DEV_SERVER_URL
    const devServer = devUrlEnv || `http://localhost:${defaultPort}/`
    win.loadURL(devServer)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

// IPC handlers
ipcMain.handle('db:get', () => readDB())
ipcMain.handle('db:set', (_e, data) => { writeDB(data); return true })
ipcMain.handle('db:backup', () => {
  const db = readDB()
  return { fileName: 'popo2-backup.json', content: JSON.stringify(db, null, 2) }
})
ipcMain.handle('db:restore', async (_e) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'SQLite Files', extensions: ['db', 'sqlite', 'sqlite3'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  
  if (result.canceled) return null
  
  try {
    const filePath = result.filePaths[0]
    const fileContent = readFileSync(filePath, 'utf-8')
    const raw = JSON.parse(fileContent)
    const data = migrateBackupIfNeeded(raw)
    
    // Validate basic structure (after migration)
    if (!data || !Array.isArray(data.users)) {
      throw new Error('Invalid backup format')
    }
    
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('image:upload', async (_e) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
    ]
  })
  
  if (result.canceled) return null
  
  try {
    const filePath = result.filePaths[0]
    const ext = path.extname(filePath)
    const fileName = `avatar-${Date.now()}${ext}`
    const destPath = path.join(getImagesDir(), fileName)
    
    copyFileSync(filePath, destPath)
    return fileName
  } catch (error) {
    return null
  }
})

ipcMain.handle('image:get', (_e, fileName) => {
  if (!fileName) return null
  try {
    const filePath = path.join(getImagesDir(), fileName)
    if (!existsSync(filePath)) return null
    
    const data = readFileSync(filePath)
    const ext = path.extname(fileName).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
    
    return `data:${mimeType};base64,${data.toString('base64')}`
  } catch (error) {
    return null
  }
})

ipcMain.handle('theme:set', (_e, mode) => {
  nativeTheme.themeSource = mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : 'system'
  const db = readDB(); db.theme = mode; writeDB(db)
  return mode
})

app.whenReady().then(() => {
  ensureDB()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})