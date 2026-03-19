const { app, BrowserWindow, session } = require('electron')

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
  
  // Basic Ad & Tracker Blocklist
  const blockList = [
    '*://*.doubleclick.net/*',
    '*://*.google-analytics.com/*',
    '*://*.facebook.com/tr*',
    '*://*.criteo.com/*',
    '*://*.adzerk.net/*',
    '*://*.amazon-adsystem.com/*',
    '*://*.scorecardresearch.com/*',
    '*://*.quantserve.com/*',
    '*://*.googlesyndication.com/*'
  ]

  win.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
    // Check if the request matches our dummy blocklist
    const isBlocked = blockList.some(pattern => {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(details.url);
    });

    if (isBlocked) {
      console.log(`[Shield] Blocked tracker: ${details.url}`)
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