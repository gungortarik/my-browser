const { app, BrowserWindow, session, Menu, clipboard, ipcMain, dialog, safeStorage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const axios = require('axios')
const unzip = require('unzip-crx-3')

let downloadSettings = { askEveryTime: false, path: '' };

// --- PASSWORD VAULT ---
const appDataPath = process.platform === 'win32'
  ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'PremiumBrowser')
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'PremiumBrowser')
    : path.join(os.homedir(), '.config', 'PremiumBrowser');

if (!fs.existsSync(appDataPath)) fs.mkdirSync(appDataPath, { recursive: true });

const vaultPath = path.join(appDataPath, 'passwords.json');
let passwordVault = {};

function loadVault() {
  if (fs.existsSync(vaultPath)) {
    try {
      passwordVault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
    } catch (e) { console.error('Vault format error:', e) }
  }
}
function saveVault() {
  try {
    fs.writeFileSync(vaultPath, JSON.stringify(passwordVault, null, 2), 'utf8');
  } catch (e) { console.error('Failed writing vault:', e) }
}
// ----------------------

// --- EXTENSION VAULT ---
const extListPath = path.join(appDataPath, 'extensions.json');
let loadedExtensionPaths = [];

function loadExtensionPaths() {
  if (fs.existsSync(extListPath)) {
    try {
      loadedExtensionPaths = JSON.parse(fs.readFileSync(extListPath, 'utf8'));
    } catch(e) { console.error('Ext format error:', e) }
  }
}
function saveExtensionPaths() {
  try {
    fs.writeFileSync(extListPath, JSON.stringify(loadedExtensionPaths, null, 2), 'utf8');
  } catch(e) { console.error('Failed writing ext:', e) }
}
// ----------------------

// --- AUTOFILL VAULT ---
const autofillPath = path.join(appDataPath, 'autofill.json');
let autofillVault = { profiles: [], cards: [] };

function loadAutofillVault() {
  if (fs.existsSync(autofillPath)) {
    try {
      autofillVault = JSON.parse(fs.readFileSync(autofillPath, 'utf8'));
    } catch(e) { console.error('Autofill error:', e) }
  }
}
function saveAutofillVault() {
  try {
    fs.writeFileSync(autofillPath, JSON.stringify(autofillVault, null, 2), 'utf8');
  } catch(e) {}
}
// ----------------------

function createWindow(isIncognito = false) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    titleBarStyle: 'hiddenInset', // Better macOS integration
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  })

  // ============================================
  // BRAVE & MULLVAD INSPIRED PRIVACY ENGINE
  // ============================================
  const filter = {
    urls: ['*://*/*']
  }

  let currentShieldMode = 'standard';
  ipcMain.on('update-shield-mode', (event, mode) => {
    currentShieldMode = mode;
  });

  const standardBlockList = [
    '*://*.doubleclick.net/*',
    '*://*.google-analytics.com/*',
    '*://*.amazon-adsystem.com/*',
    '*://*.scorecardresearch.com/*',
    '*://*.googlesyndication.com/*'
  ];

  const strictBlockList = [
    ...standardBlockList,
    '*://*.facebook.com/*',
    '*://*.facebook.net/*',
    '*://*.twitter.com/tr*',
    '*://*.tiktok.com/*',
    '*://*.criteo.com/*',
    '*://*.hotjar.com/*',
    '*://*.adzerk.net/*',
    '*://*.quantserve.com/*'
  ];

  win.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
    const listToUse = currentShieldMode === 'strict' ? strictBlockList : standardBlockList;

    // Check if the request matches our blocklist
    const isBlocked = listToUse.some(pattern => {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(details.url);
    });

    if (isBlocked) {
      console.log(`[Shield] Blocked tracker: ${details.url}`)
      win.webContents.send('tracker-blocked', { webContentsId: details.webContentsId, url: details.url });
      callback({ cancel: true })
    } else {
      callback({ cancel: false })
    }
  })

  // Prevent Telemetry and WebRTC Leaks
  win.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    // Clear referrers on third-party requests to prevent cross-site tracking
    if (details.requestHeaders['Referer']) {
      details.requestHeaders['Referer'] = ''
    }

    // Anti-fingerprinting: Generic User-Agent
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    // Do Not Track flag
    details.requestHeaders['DNT'] = '1'

    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })

  // Set default generic permission response (Deny all) - Mullvad style
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log(`[Privacy] Automatically denied permission request for: ${permission}`)
    callback(false) // Automatically deny geolocation, camera, mic, etc. for extreme privacy
  })

  // Hardcore WebRTC policy - Disable non-proxied UDP (prevents IP leaks behind VPN)
  win.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')

  // --- DOWNLOAD MANAGER ---
  win.webContents.session.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const id = Date.now().toString(); // unique ID

    if (downloadSettings.askEveryTime) {
      item.setSaveDialogOptions({ defaultPath: fileName });
    } else if (downloadSettings.path) {
      item.setSavePath(path.join(downloadSettings.path, fileName));
    }

    win.webContents.send('download-started', { id, fileName });

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        win.webContents.send('download-interrupted', { id });
      } else if (state === 'progressing') {
        if (!item.isPaused()) {
          const received = item.getReceivedBytes();
          const total = item.getTotalBytes();
          const percent = total > 0 ? (received / total) * 100 : 0;
          win.webContents.send('download-progress', { id, percent, received, total });
        }
      }
    });

    item.once('done', (event, state) => {
      const savePath = item.getSavePath();
      win.webContents.send('download-done', { id, state, savePath });
    });
  });

  // Prevent opening new windows natively
  win.webContents.setWindowOpenHandler(({ url }) => {
    win.webContents.send('new-tab-requested', url); // Send back to renderer to open as a new tab
    return { action: 'deny' };
  });

  win.loadURL(`file://${path.join(__dirname, 'index.html')}?incognito=${isIncognito}`);
}

// Re-removed duplicate app.whenReady

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Add Context Menu to all WebViews automatically
app.on('web-contents-created', (event, contents) => {
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isCmdOrCtrl = input.meta || input.control;

      if (isCmdOrCtrl && input.shift && input.key.toLowerCase() === 'n') {
        createWindow(true);
        event.preventDefault();
      }
      else if (isCmdOrCtrl && !input.shift && input.key.toLowerCase() === 'n') {
        createWindow(false);
        event.preventDefault();
      }
      else if (isCmdOrCtrl && !input.shift && input.key.toLowerCase() === 't') {
        const win = BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow();
        if (win) win.webContents.send('keyboard-shortcut-new-tab');
        event.preventDefault();
      }
    }
  });

  if (contents.getType && contents.getType() === 'webview') {
    contents.on('context-menu', (event, params) => {
      const menuTemplate = [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ];

      if (params.linkURL) {
        menuTemplate.push({ type: 'separator' });
        menuTemplate.push({
          label: 'Copy Link',
          click: () => clipboard.writeText(params.linkURL)
        });
      }

      if (params.hasImageContents && params.srcURL) {
        menuTemplate.push({
          label: 'Copy Image URL',
          click: () => clipboard.writeText(params.srcURL)
        });
      }

      menuTemplate.push({ type: 'separator' });
      menuTemplate.push({
        label: 'Inspect Element',
        click: () => contents.inspectElement(params.x, params.y)
      });

      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup();
    });
  }
});

// Default Browser Handlers
ipcMain.handle('check-default-browser', () => {
  return app.isDefaultProtocolClient('http');
});

ipcMain.handle('set-default-browser', () => {
  app.setAsDefaultProtocolClient('http');
  app.setAsDefaultProtocolClient('https');
  return app.isDefaultProtocolClient('http');
});

// Download Settings Handlers
ipcMain.on('update-download-settings', (event, settings) => {
  downloadSettings = settings;
});

ipcMain.handle('select-download-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Password Manager IPC
ipcMain.handle('get-domain-passwords', (event, domain) => {
  if (!safeStorage.isEncryptionAvailable()) return [];
  const entries = passwordVault[domain] || [];
  return entries.map(entry => {
    try {
      return {
        username: entry.username,
        password: safeStorage.decryptString(Buffer.from(entry.encryptedPassword, 'base64'))
      };
    } catch (err) {
      return null;
    }
  }).filter(v => v !== null);
});

ipcMain.handle('get-all-passwords', () => {
  return passwordVault;
});

ipcMain.handle('delete-password', (event, { domain, username }) => {
  if (passwordVault[domain]) {
    passwordVault[domain] = passwordVault[domain].filter(e => e.username !== username);
    if (passwordVault[domain].length === 0) delete passwordVault[domain];
    saveVault();
  }
});

ipcMain.handle('save-password', (event, { domain, username, password }) => {
  if (!safeStorage.isEncryptionAvailable()) return false;

  if (!passwordVault[domain]) passwordVault[domain] = [];
  const encryptedPassword = safeStorage.encryptString(password).toString('base64');

  // Update if exists, else trigger push
  const existing = passwordVault[domain].find(e => e.username === username);
  if (existing) {
    existing.encryptedPassword = encryptedPassword;
  } else {
    passwordVault[domain].push({ username, encryptedPassword });
  }

  saveVault();
  return true;
});

ipcMain.on('prompt-save-password', (event, payload) => {
  // We forward the prompt up to the renderer window containing the initiating webContents
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 0) {
    // Determine which webview triggered it based on the event sender...
    // Actually, we just send it to the main window for the frontend to render the dropdown.
    allWindows[0].webContents.send('show-password-prompt', payload, event.sender.id);
  }
});

// --- AUTOFILL IPC COMMANDS ---
ipcMain.handle('get-autofill-data', () => {
  const cards = autofillVault.cards.map(card => {
    let num = card.number;
    if (safeStorage.isEncryptionAvailable() && card.encrypted) {
      try { num = safeStorage.decryptString(Buffer.from(card.number, 'base64')); } 
      catch(e) { num = 'Error'; }
    }
    return { ...card, number: num };
  });
  return { profiles: autofillVault.profiles, cards };
});

ipcMain.handle('save-autofill-profile', (event, profile) => {
  const index = autofillVault.profiles.findIndex(p => p.id === profile.id);
  if (index !== -1) autofillVault.profiles[index] = profile;
  else autofillVault.profiles.push({ ...profile, id: Date.now().toString() });
  saveAutofillVault();
  return true;
});

ipcMain.handle('delete-autofill-profile', (event, id) => {
  autofillVault.profiles = autofillVault.profiles.filter(p => p.id !== id);
  saveAutofillVault();
  return true;
});

ipcMain.handle('save-autofill-card', (event, card) => {
  let isEncrypted = false;
  let number = card.number;
  if (safeStorage.isEncryptionAvailable()) {
    isEncrypted = true;
    number = safeStorage.encryptString(card.number).toString('base64');
  }
  const secureCard = { ...card, number, encrypted: isEncrypted };
  
  const index = autofillVault.cards.findIndex(c => c.id === card.id);
  if (index !== -1) autofillVault.cards[index] = secureCard;
  else autofillVault.cards.push({ ...secureCard, id: Date.now().toString() });
  
  saveAutofillVault();
  return true;
});

ipcMain.handle('delete-autofill-card', (event, id) => {
  autofillVault.cards = autofillVault.cards.filter(c => c.id !== id);
  saveAutofillVault();
  return true;
});

// --- EXTENSION IPC COMMANDS ---
ipcMain.handle('load-unpacked-extension', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  const extPath = result.filePaths[0];

  try {
    const ext = await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
    if (!loadedExtensionPaths.includes(extPath)) {
      loadedExtensionPaths.push(extPath);
      saveExtensionPaths();
    }
    return { id: ext.id, name: ext.name, version: ext.version };
  } catch (err) {
    console.error('Extension load failed:', err);
    return { error: err.message };
  }
});

ipcMain.handle('remove-extension', (event, id) => {
  const ext = session.defaultSession.getExtension(id);
  if (!ext) return false;
  session.defaultSession.removeExtension(id);
  loadedExtensionPaths = loadedExtensionPaths.filter(p => p !== ext.path);
  saveExtensionPaths();
  return true;
});

ipcMain.handle('get-extensions', () => {
  const extensions = session.defaultSession.getAllExtensions();
  return extensions.map(ext => {
    let popup = null;
    try {
      const manifestPath = path.join(ext.path, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.action && manifest.action.default_popup) popup = manifest.action.default_popup;
      else if (manifest.browser_action && manifest.browser_action.default_popup) popup = manifest.browser_action.default_popup;
    } catch(e) {}
    
    return { id: ext.id, name: ext.name, version: ext.version, popup };
  });
});

// --- DOWNLOAD MANAGER ---
const activeDownloadItems = new Map();

function setupDownloadHandler(sess) {
  sess.on('will-download', (event, item, webContents) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const filename = item.getFilename();
    const totalBytes = item.getTotalBytes();
    
    activeDownloadItems.set(id, item);
    
    let win = BrowserWindow.fromWebContents(webContents);
    if (!win) {
      const wins = BrowserWindow.getAllWindows();
      if(wins.length > 0) win = wins[0];
    }
    
    if (win) {
      win.webContents.send('download-started', { id, filename, totalBytes });
    }
    
    item.on('updated', (event, state) => {
      if (win) {
        win.webContents.send('download-progress', {
          id,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          state // 'progressing' or 'interrupted'
        });
      }
    });
    
    item.on('done', (event, state) => {
      if (win) {
        win.webContents.send('download-done', {
          id,
          state, // 'completed', 'cancelled', 'interrupted'
          path: item.getSavePath()
        });
      }
      activeDownloadItems.delete(id);
    });
  });
}

ipcMain.on('pause-download', (event, id) => {
  const item = activeDownloadItems.get(id);
  if (item && !item.isPaused()) item.pause();
});

ipcMain.on('resume-download', (event, id) => {
  const item = activeDownloadItems.get(id);
  if (item && item.canResume()) item.resume();
});

ipcMain.on('cancel-download', (event, id) => {
  const item = activeDownloadItems.get(id);
  if (item) {
    item.cancel();
    activeDownloadItems.delete(id);
  }
});

ipcMain.on('show-item-in-folder', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

// --- CHROME EXTENSIONS ENGINE ---
ipcMain.handle('install-chrome-extension', async (event, extId) => {
  try {
    const extDir = path.join(appDataPath, 'CrxStore');
    if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });
    
    const crxPath = path.join(extDir, `${extId}.crx`);
    const extractPath = path.join(extDir, extId);
    
    const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=114.0.0.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`;
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(crxPath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    await unzip(crxPath, extractPath);
    
    const ext = await session.defaultSession.loadExtension(extractPath, { allowFileAccess: true });
    if (!loadedExtensionPaths.includes(extractPath)) {
      loadedExtensionPaths.push(extractPath);
      saveExtensionPaths();
    }
    
    try { fs.unlinkSync(crxPath); } catch(e) {}
    
    return { success: true, id: ext.id, name: ext.name, version: ext.version };
  } catch (err) {
    console.error('CRX Install Failed:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  loadVault();
  loadExtensionPaths();
  loadAutofillVault();
  
  // Explicitly mount unpacked Chrome extensions into the Global electron session
  for (const extPath of loadedExtensionPaths) {
    try {
      await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
    } catch (err) {
      console.error('Failed to load extension:', extPath, err);
      loadedExtensionPaths = loadedExtensionPaths.filter(p => p !== extPath);
      saveExtensionPaths();
    }
  }

  setupDownloadHandler(session.defaultSession);
  setupDownloadHandler(session.fromPartition('incognito'));
  
  createWindow(false);
})

ipcMain.on('open-incognito-window', () => {
  createWindow(true);
});

ipcMain.on('open-new-window', () => {
  createWindow(false);
});