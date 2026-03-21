const { app, BrowserWindow, session, Menu, clipboard, ipcMain, dialog } = require('electron')
const path = require('path')

let downloadSettings = { askEveryTime: false, path: '' };

function createWindow() {
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

  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

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