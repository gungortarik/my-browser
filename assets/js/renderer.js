const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcRenderer, shell } = require('electron');

const tabBar = document.getElementById('tabBar')
const newTabBtn = document.getElementById('newTabBtn')
const backBtn = document.getElementById('backBtn')
const forwardBtn = document.getElementById('forwardBtn')
const refreshBtn = document.getElementById('refreshBtn')
const homeBtn = document.getElementById('homeBtn')
const urlInput = document.getElementById('urlInput')
const readerBtn = document.getElementById('readerBtn')
const browserViewsContainer = document.getElementById('browserViewsContainer')
const statusLabel = document.getElementById('status')

// Context Menus
const tabContextMenu = document.getElementById('tabContextMenu');
const workspaceMenu = document.getElementById('workspaceMenu');
const workspaceBtn = document.getElementById('workspaceBtn');
const lockTabAction = document.getElementById('lockTabAction');
const closeTabAction = document.getElementById('closeTabAction');
const duplicateTabAction = document.getElementById('duplicateTabAction');
const reopenTabAction = document.getElementById('reopenTabAction');
const pinTabAction = document.getElementById('pinTabAction');
const pinTabLabel = document.getElementById('pinTabLabel');
const addWorkspaceBtn = document.getElementById('addWorkspaceBtn');
const workspaceList = document.getElementById('workspaceList');

// Start Page DOM UI
const startPage = document.getElementById('startPage');
const favoritesGrid = document.getElementById('favoritesGrid');
const startWsGrid = document.getElementById('startWsGrid');
const continueWsBtn = document.getElementById('continueWsBtn');
const startSearchInput = document.getElementById('startSearchInput');

// Top Right Toolbar controls
const settingsBtn = document.querySelector('.icon-btn[title="Settings"]');
const bookmarkBtn = document.querySelector('.bookmark-btn');

// Downloads DOM
const downloadsBtn = document.getElementById('downloadsBtn');
const downloadsMenu = document.getElementById('downloadsMenu');
const downloadsList = document.getElementById('downloadsList');
const clearDownloadsBtn = document.getElementById('clearDownloadsBtn');

// Media Hub DOM
const mediaBtn = document.getElementById('mediaBtn');
const mediaPopup = document.getElementById('mediaPopup');
const mediaList = document.getElementById('mediaList');

// Side Panel DOM
const sidePanel = document.getElementById('sidePanel');
const tabHistory = document.getElementById('tabHistory');
const tabBookmarks = document.getElementById('tabBookmarks');
const closeSidePanelBtn = document.getElementById('closeSidePanelBtn');
const panelContent = document.getElementById('panelContent');

// Find in Page DOM
const findBox = document.getElementById('findBox');
const findInput = document.getElementById('findInput');
const findMatchCount = document.getElementById('findMatchCount');
const findPrevBtn = document.getElementById('findPrevBtn');
const findNextBtn = document.getElementById('findNextBtn');
const findCloseBtn = document.getElementById('findCloseBtn');

// Shield DOM
const shieldBtn = document.getElementById('shieldBtn');
const shieldMenu = document.getElementById('shieldMenu');
const shieldBlockCount = document.getElementById('shieldBlockCount');
const shieldBlockList = document.getElementById('shieldBlockList');
let tabShieldData = {}; // webContentsId -> string array of URLs

// Settings DOM
const settingsPage = document.getElementById('settingsPage');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingSearchEngine = document.getElementById('settingSearchEngine');
const settingHomepageMode = document.getElementById('settingHomepageMode');
const settingHomepageUrl = document.getElementById('settingHomepageUrl');
const settingShowFavorites = document.getElementById('settingShowFavorites');
const settingShowWorkspaces = document.getElementById('settingShowWorkspaces');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const clearBookmarksBtn = document.getElementById('clearBookmarksBtn');

// Default Browser DOM
const makeDefaultBtn = document.getElementById('makeDefaultBtn');
const defaultBrowserStatus = document.getElementById('defaultBrowserStatus');
const settingShieldMode = document.getElementById('settingShieldMode');

// Password Manager DOM
const passwordPrompt = document.getElementById('passwordPrompt');
const pwdPromptDomain = document.getElementById('pwdPromptDomain');
const pwdPromptUser = document.getElementById('pwdPromptUser');
const pwdPromptSave = document.getElementById('pwdPromptSave');
const pwdPromptNever = document.getElementById('pwdPromptNever');
const passwordManagerList = document.getElementById('passwordManagerList');
let pendingPasswordData = null;

// Extension Manager DOM
const loadExtensionBtn = document.getElementById('loadExtensionBtn');
const extensionsList = document.getElementById('extensionsList');
const extensionIconsContainer = document.getElementById('extensionIconsContainer');
const extPopupContainer = document.getElementById('extPopupContainer');
const extPopupWebview = document.getElementById('extPopupWebview');
const closeExtPopupBtn = document.getElementById('closeExtPopupBtn');
const extPopupTitle = document.getElementById('extPopupTitle');
const crxIdInput = document.getElementById('crxIdInput');
const installCrxBtn = document.getElementById('installCrxBtn');

// --- SITE INFO & PERMISSIONS DOM ---
const siteInfoBtn = document.getElementById('siteInfoBtn');
const siteInfoMenu = document.getElementById('siteInfoMenu');
const siteInfoDomain = document.getElementById('siteInfoDomain');
const siteInfoSecurity = document.getElementById('siteInfoSecurity');
const sitePermList = document.getElementById('sitePermList');
const resetSitePermsBtn = document.getElementById('resetSitePermsBtn');

// --- CLOUD SYNC DOM ---
const userBtn = document.getElementById('userBtn');
const syncBadge = document.getElementById('syncBadge');
const authModal = document.getElementById('authModal');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authForm = document.getElementById('authForm');
const authProfile = document.getElementById('authProfile');
const profileEmail = document.getElementById('profileEmail');
const syncNowBtn = document.getElementById('syncNowBtn');
const signOutBtn = document.getElementById('signOutBtn');
const authStatusText = document.getElementById('authStatusText');
const lastSyncTime = document.getElementById('lastSyncTime');

let syncUser = JSON.parse(localStorage.getItem('syncUser')) || null;
let lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp') || null;

// --- APP STATE ---
const appDataPath = process.platform === 'win32'
  ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'PremiumBrowser')
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'PremiumBrowser')
    : path.join(os.homedir(), '.config', 'PremiumBrowser');

if (!fs.existsSync(appDataPath)) fs.mkdirSync(appDataPath, { recursive: true });
const sessionFilePath = path.join(appDataPath, 'session.json');

const DEFAULT_WORKSPACES = {
  'ws_personal': { id: 'ws_personal', name: 'Personal', color: '#5e6ad2', tabs: [], activeTabId: null },
  'ws_work': { id: 'ws_work', name: 'Work', color: '#eb5757', tabs: [], activeTabId: null }
};

const DEFAULT_FAVORITES = [
  { id: 'fav1', name: 'Google', url: 'https://google.com', icon: '🔍' },
  { id: 'fav2', name: 'YouTube', url: 'https://youtube.com', icon: '▶️' },
  { id: 'fav3', name: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { id: 'fav4', name: 'Reddit', url: 'https://reddit.com', icon: '👽' }
];

const DEFAULT_SETTINGS = {
  homepageMode: 'start-page',
  homepageUrl: 'https://www.duckduckgo.com',
  searchEngine: 'duckduckgo',
  downloads: { path: '', askEveryTime: false },
  shieldMode: 'standard',
  startPage: {
    backgroundTheme: 'default',
    showWorkspaces: true,
    showFavorites: true,
    layoutMode: 'comfortable',
    showRecent: true
  }
};

const urlParams = new URLSearchParams(window.location.search);
const isIncognito = urlParams.get('incognito') === 'true';

const incognitoBadge = document.getElementById('incognitoBadge');
if (isIncognito) {
  document.body.classList.add('incognito-theme');
  if (incognitoBadge) incognitoBadge.style.display = 'flex';
}

const incognitoBtn = document.getElementById('incognitoBtn');
if (incognitoBtn) {
  incognitoBtn.addEventListener('click', () => {
    ipcRenderer.send('open-incognito-window');
  });
}

let appMode = isIncognito ? 'incognito' : 'start'; // 'start', 'split', 'workspace', 'temporary', 'incognito'
let isSplitting = false;
let workspaces = { ...DEFAULT_WORKSPACES };
let workspaceOrder = ['ws_personal', 'ws_work'];
let currentWorkspaceId = 'ws_personal';
let favorites = JSON.parse(localStorage.getItem('favorites')) || [...DEFAULT_FAVORITES];
let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

// History and Bookmarks state
let globalHistory = [];
let bookmarks = [];
let recentlyClosedTabs = [];

let tabCount = 0;
let wsCount = 2;
let contextMenuTargetTabId = null;

const webviews = {};

const iconUnlock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const iconLock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

// --- PERSISTENCE MODULE (FS JSON) ---
let saveTimeout = null;
function saveSession(force = false) {
  if (isIncognito || appMode === 'temporary') return;
  clearTimeout(saveTimeout);

  const performSave = () => {
    const persistentWorkspaces = { ...workspaces };
    if (persistentWorkspaces['ws_temp']) delete persistentWorkspaces['ws_temp'];

    const safeCurrentWorkspaceId = currentWorkspaceId === 'ws_temp' ? workspaceOrder[0] : currentWorkspaceId;

    const data = {
      workspaces: persistentWorkspaces,
      workspaceOrder,
      currentWorkspaceId: safeCurrentWorkspaceId,
      tabCount,
      wsCount,
      favorites,
      settings,
      globalHistory,
      bookmarks,
      recentlyClosedTabs
    };

    try {
      // Create a backup first for atomic-like safety
      if (fs.existsSync(sessionFilePath)) {
        fs.copyFileSync(sessionFilePath, `${sessionFilePath}.bak`);
      }
      fs.writeFileSync(sessionFilePath, JSON.stringify(data, null, 2), 'utf8');
      ipcRenderer.send('update-download-settings', settings.downloads || { askEveryTime: false, path: '' });
    } catch (err) {
      console.error('Failed to save session to disk:', err);
    }
  };

  if (force) {
    performSave();
  } else {
    saveTimeout = setTimeout(performSave, 300);
  }
}

// Ensure session is saved on app close
window.addEventListener('beforeunload', () => {
  saveSession(true);
});

function loadSession() {
  const tryLoad = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    try {
      const stored = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(stored);
    } catch (e) {
      console.error(`Failed to load session from ${filePath}`, e);
      return null;
    }
  };

  let parsed = tryLoad(sessionFilePath);

  // If primary fails, try backup
  if (!parsed) {
    console.log('Attempting to recover from backup session...');
    parsed = tryLoad(`${sessionFilePath}.bak`);
  }

  if (parsed && parsed.workspaces && Object.keys(parsed.workspaces).length > 0) {
    try {
      workspaces = parsed.workspaces;
      workspaceOrder = parsed.workspaceOrder || Object.keys(parsed.workspaces);
      currentWorkspaceId = parsed.currentWorkspaceId || workspaceOrder[0];
      tabCount = parsed.tabCount || 0;
      wsCount = parsed.wsCount || workspaceOrder.length;
      if (parsed.favorites) favorites = parsed.favorites;
      if (parsed.globalHistory) globalHistory = parsed.globalHistory;
      if (parsed.bookmarks) bookmarks = parsed.bookmarks;
      if (parsed.recentlyClosedTabs) recentlyClosedTabs = parsed.recentlyClosedTabs;
      if (parsed.settings) {
        settings = {
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          startPage: { ...DEFAULT_SETTINGS.startPage, ...(parsed.settings.startPage || {}) }
        };
      }
    } catch (e) {
      console.error('Failed to process loaded session data', e);
    }
  }
}

function restoreSessionUI() {
  const wsIds = workspaceOrder;
  if (wsIds.length === 0) return;

  tabBar.innerHTML = '';
  browserViewsContainer.innerHTML = '';

  wsIds.forEach(id => {
    const ws = workspaces[id];
    if (!ws) return;

    // We must temporarily clear the tabs array because createWebview/createTabDOMElement 
    // normally expect to be called during a "live" creation that pushes to the array.
    // However, here we already have the tabs. 
    // To reuse existing logic, we'll store them and re-add them.
    const tabsToRestore = [...ws.tabs];
    ws.tabs = [];

    tabsToRestore.forEach(tab => {
      // Re-initialize tab in the data model for the current workspace
      ws.tabs.push(tab);

      // Only create DOM/Webview if it's the current workspace
      // Actually, we create WebViews for ALL tabs to maintain state, 
      // but only the active tab's webview is visible.
      createTabDOMElement(tab);
      createWebview(tab);
    });

    // Ensure the tab active state is correct for this workspace
    if (ws.activeTabId) {
      // If the active tab was lost for some reason, pick the first one
      if (!ws.tabs.find(t => t.id === ws.activeTabId)) {
        ws.activeTabId = ws.tabs.length > 0 ? ws.tabs[0].id : null;
      }
    }
  });

  // Switch to the last active workspace
  const targetWsId = currentWorkspaceId && workspaces[currentWorkspaceId] ? currentWorkspaceId : wsIds[0];
  switchWorkspace(targetWsId);

  const targetWs = workspaces[targetWsId];
  if (targetWs && targetWs.activeTabId) {
    setActiveTab(targetWs.activeTabId);
  }
}

// --- GLOBAL MENU HANDLERS ---
document.addEventListener('click', (e) => {
  if (!e.target.closest('#tabContextMenu')) tabContextMenu.classList.remove('visible');
  if (!e.target.closest('#workspaceBtn') && !e.target.closest('#workspaceMenu')) {
    if (e.target.tagName !== 'INPUT' && !e.target.closest('.ws-action-btn')) {
      workspaceMenu.classList.remove('visible');
    }
  }
});

// Removed legacy settingsBtn toggle listener

// --- CENTRALIZED KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
  const isMac = process.platform === 'darwin';
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const shift = e.shiftKey;
  const alt = e.altKey;
  const key = e.key.toLowerCase();

  // If focused on an input, DO NOT intercept default text editing behavior (Arrow jumping).
  const isInputFocused = document.activeElement &&
    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

  if (mod && !shift && !alt) {
    switch (key) {
      case 't':
        e.preventDefault();
        createTab();
        break;
      case 'w':
        e.preventDefault();
        if (appMode !== 'start') {
          const active = getActiveTab();
          if (active) closeTab(active.id);
        }
        break;
      case 'l':
        e.preventDefault();
        urlInput.focus();
        urlInput.select();
        break;
      case 'r':
        e.preventDefault();
        const wvR = getActiveWebview();
        if (wvR && wvR.reload) wvR.reload();
        break;
      case 'd':
        e.preventDefault();
        if (bookmarkBtn) bookmarkBtn.click();
        break;
      case 'h':
        e.preventDefault();
        toggleSidePanel(true, 'history');
        break;
      case ',':
        e.preventDefault();
        if (settingsBtn) settingsBtn.click();
        break;
      case 'f':
        e.preventDefault();
        toggleFindBox(true);
        break;
      case 'tab':
        if (appMode !== 'start') {
          e.preventDefault();
          const ws = workspaces[currentWorkspaceId];
          if (ws && ws.tabs.length > 1) {
            const currentIndex = ws.tabs.findIndex(t => t.id === ws.activeTabId);
            const nextIndex = (currentIndex + 1) % ws.tabs.length;
            setActiveTab(ws.tabs[nextIndex].id);
          }
        }
        break;
      default:
        // Cmd/Ctrl + 1-9 (Tab Switch)
        if (key >= '1' && key <= '9' && appMode !== 'start') {
          e.preventDefault();
          const tabIndex = parseInt(key, 10) - 1;
          const wsT = workspaces[currentWorkspaceId];
          if (wsT && wsT.tabs[tabIndex]) {
            setActiveTab(wsT.tabs[tabIndex].id);
          }
        }
        break;
    }
  } else if (mod && shift && !alt) {
    switch (key) {
      case 't':
        e.preventDefault();
        if (recentlyClosedTabs.length > 0 && appMode !== 'start') {
          const restored = recentlyClosedTabs.pop();
          createTab(restored.url);
          saveSession();
        }
        break;
      case 'r':
        e.preventDefault();
        const wvHR = getActiveWebview();
        if (wvHR && wvHR.reloadIgnoringCache) wvHR.reloadIgnoringCache();
        break;
      case 'n':
        e.preventDefault();
        if (addWorkspaceBtn) {
          // Open menu if closed, then trigger
          if (!workspaceMenu.classList.contains('visible')) workspaceBtn.click();
          addWorkspaceBtn.click();
        }
        break;
      case 'tab':
        if (appMode !== 'start') {
          e.preventDefault();
          const wsS = workspaces[currentWorkspaceId];
          if (wsS && wsS.tabs.length > 1) {
            const currentIndex = wsS.tabs.findIndex(t => t.id === wsS.activeTabId);
            const prevIndex = (currentIndex - 1 + wsS.tabs.length) % wsS.tabs.length;
            setActiveTab(wsS.tabs[prevIndex].id);
          }
        }
        break;
      default:
        // Cmd/Ctrl + Shift + 1-9 (Workspace Switch)
        if (key >= '1' && key <= '9') {
          e.preventDefault();
          const wsIndex = parseInt(key, 10) - 1;
          if (workspaceOrder[wsIndex]) {
            switchWorkspace(workspaceOrder[wsIndex]);
          }
        }
        break;
    }
  } else if (!mod && !shift && alt) {
    // Alt + Left | Alt + Right Navigation
    // Do not intercept if user is actively text editing (word-jumping)
    if (isInputFocused) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const wvBack = getActiveWebview();
      if (wvBack && wvBack.canGoBack && wvBack.canGoBack()) wvBack.goBack();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const wvFwd = getActiveWebview();
      if (wvFwd && wvFwd.canGoForward && wvFwd.canGoForward()) wvFwd.goForward();
    }
  }
});


// --- NAVIGATION TOOLBAR ---
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const wv = getActiveWebview();
    if (!wv) return;
    const url = formatInput(urlInput.value);
    wv.loadURL(url);
    urlInput.blur();
  }
});

backBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.canGoBack && wv.canGoBack()) wv.goBack();
});

forwardBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.canGoForward && wv.canGoForward()) wv.goForward();
});

refreshBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.reload) wv.reload();
});

homeBtn.addEventListener('click', () => {
  // If user wants Start Page, just show it
  if (settings.homepageMode === 'start-page' || !settings.homepageUrl) {
    renderStartPage();
  } else {
    // If they want a specific URL, load it in current tab or new tab
    const finalUrl = formatInput(settings.homepageUrl);
    const wv = getActiveWebview();
    if (wv) {
      wv.loadURL(finalUrl);
      if (startPage) startPage.classList.remove('active');
    } else {
      createTab(finalUrl);
    }
  }
});

// --- SIDE PANEL LOGIC ---
let currentSidePanelTab = 'history';

function toggleSidePanel(show, tab = 'history') {
  if (show) {
    sidePanel.classList.add('active');
    switchSidePanelTab(tab);
  } else {
    sidePanel.classList.remove('active');
  }
}

function switchSidePanelTab(tab) {
  currentSidePanelTab = tab;
  if (tab === 'history') {
    tabHistory.classList.add('active');
    tabBookmarks.classList.remove('active');
    renderSidePanelList(globalHistory.slice().reverse(), 'No history yet.');
  } else {
    tabBookmarks.classList.add('active');
    tabHistory.classList.remove('active');
    renderSidePanelList(bookmarks.slice().reverse(), 'No bookmarks yet.');
  }
}

function renderSidePanelList(items, emptyMsg) {
  panelContent.innerHTML = '';
  if (!items || items.length === 0) {
    panelContent.innerHTML = `<div class="panel-empty">${emptyMsg}</div>`;
    return;
  }

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'panel-item';

    let iconStr = '📄';
    try {
      if (item.url && item.url !== 'about:blank') {
        const urlObj = new URL(item.url);
        const host = urlObj.hostname.replace('www.', '');
        iconStr = host.charAt(0).toUpperCase();
      }
    } catch (e) { }

    el.innerHTML = `
      <div class="panel-item-icon">${iconStr}</div>
      <div class="panel-item-info">
        <div class="panel-item-title">${item.title || item.url}</div>
        <div class="panel-item-url">${item.url}</div>
      </div>
    `;

    el.addEventListener('click', () => {
      const wv = getActiveWebview();
      if (wv && wv.loadURL) wv.loadURL(item.url);
      toggleSidePanel(false);
    });

    panelContent.appendChild(el);
  });
}

closeSidePanelBtn.addEventListener('click', () => toggleSidePanel(false));
tabHistory.addEventListener('click', () => switchSidePanelTab('history'));
tabBookmarks.addEventListener('click', () => switchSidePanelTab('bookmarks'));


// --- BOOKMARKS LOGIC ---
if (bookmarkBtn) {
  bookmarkBtn.addEventListener('click', () => {
    const activeTab = getActiveTab();
    if (!activeTab || !activeTab.url) return;

    if (activeTab.url === 'about:blank') return;

    const urlStr = activeTab.url;
    const existingIndex = bookmarks.findIndex(b => b.url === urlStr);

    if (existingIndex > -1) {
      bookmarks.splice(existingIndex, 1);
      bookmarkBtn.classList.remove('active-bookmark');
      showStatus('Bookmark Removed');
    } else {
      bookmarks.push({ url: urlStr, title: activeTab.title, addedAt: Date.now() });
      bookmarkBtn.classList.add('active-bookmark');
      showStatus('Page Bookmarked');
    }
    saveSession();
  });
}

function updateBookmarkVisuals(url) {
  if (bookmarks.some(b => b.url === url)) {
    bookmarkBtn.classList.add('active-bookmark');
  } else {
    bookmarkBtn.classList.remove('active-bookmark');
  }
}

// --- HISTORY LOGIC ---
function registerHistoryEvent(url, title) {
  if (appMode === 'temporary') return;
  if (!url || url === 'about:blank') return;

  globalHistory.push({
    url,
    title: title || url,
    timestamp: Date.now()
  });

  if (globalHistory.length > 2000) globalHistory.shift();
  saveSession();
}

// --- WORKSPACES DYNAMIC LOGIC ---
workspaceBtn.addEventListener('click', () => {
  renderWorkspaceMenu();
  const rect = workspaceBtn.getBoundingClientRect();
  workspaceMenu.style.top = `${rect.bottom + 8}px`;
  workspaceMenu.style.left = `${rect.left}px`;
  workspaceMenu.classList.toggle('visible');
});

function switchWorkspace(wsId) {
  if (wsId === currentWorkspaceId && appMode !== 'start') return;
  if (!workspaces[wsId]) return;

  appMode = 'workspace';
  currentWorkspaceId = wsId;
  const ws = workspaces[currentWorkspaceId];

  document.getElementById('workspaceLabel').textContent = ws.name;
  document.querySelector('#workspaceBtn .workspace-dot').style.background = ws.color;
  workspaceMenu.classList.remove('visible');
  startPage.classList.remove('active');

  renderWorkspaceTabs();
  showStatus(`Switched to ${ws.name}`);
  saveSession();
}

function deleteWorkspace(wsId) {
  if (workspaceOrder.length <= 1) return;
  if (wsId === currentWorkspaceId) {
    const nextWsId = workspaceOrder.find(id => id !== wsId);
    switchWorkspace(nextWsId);
  }

  const ws = workspaces[wsId];
  if (ws && ws.tabs) {
    ws.tabs.forEach(tab => {
      if (webviews[tab.id]) {
        webviews[tab.id].remove();
        delete webviews[tab.id];
      }
    });
  }

  delete workspaces[wsId];
  workspaceOrder = workspaceOrder.filter(id => id !== wsId);

  saveSession();
  renderWorkspaceMenu();
}

function renameWorkspace(wsId, newName) {
  if (!newName.trim()) return;
  workspaces[wsId].name = newName;
  saveSession();

  if (wsId === currentWorkspaceId && appMode === 'workspace') {
    document.getElementById('workspaceLabel').textContent = newName;
  }
  renderWorkspaceMenu();
}

addWorkspaceBtn.addEventListener('click', () => {
  wsCount++;
  const newId = `ws_${wsCount}`;
  const colors = ['#2ecf73', '#f2c94c', '#bb6bd9', '#56ccf2'];
  const newColor = colors[wsCount % colors.length];

  workspaces[newId] = {
    id: newId, name: `Workspace ${wsCount}`, color: newColor, tabs: [], activeTabId: null
  };
  workspaceOrder.push(newId);
  saveSession();
  switchWorkspace(newId);
});

function renderWorkspaceMenu() {
  workspaceList.innerHTML = '';
  workspaceOrder.forEach(id => {
    const ws = workspaces[id];
    const item = document.createElement('div');
    item.className = 'menu-item ws-item';
    item.innerHTML = `
      <div class="ws-item-left" style="pointer-events:none;">
        <div class="workspace-dot" style="background: ${ws.color}"></div>
        <span class="ws-name-display">${ws.name}</span>
      </div>
      <div class="ws-item-actions">
        <button class="ws-action-btn edit-ws-btn" title="Rename" data-id="${id}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        ${workspaceOrder.length > 1 ? `
        <button class="ws-action-btn delete-ws-btn" title="Delete" data-id="${id}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>` : ''}
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.ws-item-actions')) return;
      if (item.querySelector('.ws-name-input')) return;
      switchWorkspace(id);
    });
    workspaceList.appendChild(item);

    const editBtn = item.querySelector('.edit-ws-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const leftBox = item.querySelector('.ws-item-left');
        leftBox.innerHTML = `
          <div class="workspace-dot" style="background: ${ws.color}"></div>
          <input type="text" class="ws-name-input" value="${ws.name}" />
        `;
        const input = leftBox.querySelector('input');
        input.focus();
        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') renameWorkspace(id, input.value); });
        input.addEventListener('blur', () => renameWorkspace(id, input.value));
      });
    }

    const delBtn = item.querySelector('.delete-ws-btn');
    if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteWorkspace(id); });
  });
}

// --- GLOBAL START PAGE & APP MODES LOGIC ---
function renderStartPage() {
  try {
    appMode = isIncognito ? 'incognito' : 'start';
    if (startPage) {
      startPage.classList.add('active');
    }

    // Hide all webviews when on start page
    Object.values(webviews).forEach(wv => {
      if (wv && wv.classList) wv.classList.remove('active');
    });

    // Close any other overlays
    if (typeof settingsPage !== 'undefined' && settingsPage) settingsPage.classList.remove('active');

    if (isIncognito) {
      if (startPage) startPage.style.background = '#121212';
      const mainContent = document.querySelector('.start-main-content');
      if (mainContent) {
        mainContent.innerHTML = `
          <div class="fade-in" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#fff;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#bb86fc" stroke-width="1.5" style="width:100px; height:100px; margin-bottom: 24px;">
               <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path>
            </svg>
            <h1 style="font-size:32px; font-weight:300; margin-bottom:12px;">You've gone Incognito</h1>
            <p style="color:#aaa; max-width:500px; text-align:center; line-height:1.6;">Now you can browse privately. Other people who use this device won't see your activity.</p>
            <p style="color:#bb86fc; margin-top:24px;">Premium Browser won't save:</p>
            <ul style="color:#aaa; margin-top:8px; line-height:1.8;">
               <li>Your browsing history</li>
               <li>Cookies and site data</li>
               <li>Information entered in forms</li>
            </ul>
          </div>
        `;
      }
      return;
    }

    // Safely re-render favorites
    if (!favoritesGrid) return;

    favoritesGrid.innerHTML = '';
    favorites.forEach((fav, index) => {
      const el = document.createElement('div');
      el.className = 'fav-item';

      // Ensure icon is usable (emoji or img)
      const iconContent = (fav.icon && fav.icon.length < 5)
        ? fav.icon
        : `<img src="https://www.google.com/s2/favicons?sz=64&domain=${new URL(fav.url).hostname}" onerror="this.src='https://img.icons8.com/fluency/48/globe.png'" />`;

      el.innerHTML = `
      <div class="fav-icon-box">${iconContent}</div>
      <span class="fav-name">${fav.name}</span>
    `;
      el.addEventListener('click', () => startTemporarySession(fav.url));

      // Context menu to delete
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm(`Remove ${fav.name} from favorites?`)) {
          favorites.splice(index, 1);
          localStorage.setItem('favorites', JSON.stringify(favorites));
          renderStartPage();
        }
      });

      favoritesGrid.appendChild(el);
    });

    // Add "+" Button
    const addBtn = document.createElement('div');
    addBtn.className = 'fav-item add-fav-btn';
    addBtn.innerHTML = `
    <div class="fav-icon-box">+</div>
    <span class="fav-name">Add Shortcut</span>
  `;
    addBtn.onclick = openAddFavModal;
    favoritesGrid.appendChild(addBtn);

    // Render Workspaces
    startWsGrid.innerHTML = '';
    workspaceOrder.forEach(id => {
      const ws = workspaces[id];
      const el = document.createElement('div');
      el.className = 'start-ws-card';
      el.innerHTML = `
      <div class="workspace-dot" style="background: ${ws.color}"></div>
      <span style="font-size:14px; color:#fff; font-weight:500;">${ws.name}</span>
    `;
      el.addEventListener('click', () => switchWorkspace(id));
      startWsGrid.appendChild(el);
    });

    const lastWs = workspaces[currentWorkspaceId];
    if (lastWs && lastWs.id !== 'ws_temp') {
      continueWsBtn.textContent = `Continue ${lastWs.name}`;
      continueWsBtn.onclick = () => switchWorkspace(currentWorkspaceId);
    }
  } catch (err) {
    console.error('Error rendering start page:', err);
  }
}

// Add Favorite Modal logic
const addFavModal = document.getElementById('addFavModal');
const closeAddFavBtn = document.getElementById('closeAddFavBtn');
const addFavSubmitBtn = document.getElementById('addFavSubmitBtn');
const addFavNameInput = document.getElementById('addFavName');
const addFavUrlInput = document.getElementById('addFavUrl');

function openAddFavModal() {
  addFavModal.classList.add('visible');
}

function closeAddFavModal() {
  addFavModal.classList.remove('visible');
  addFavNameInput.value = '';
  addFavUrlInput.value = '';
}

if (closeAddFavBtn) closeAddFavBtn.onclick = closeAddFavModal;

if (addFavSubmitBtn) {
  addFavSubmitBtn.onclick = () => {
    const name = addFavNameInput.value.trim();
    const url = formatInput(addFavUrlInput.value.trim());
    if (!name || !url) return;

    favorites.push({
      id: 'fav_' + Date.now(),
      name,
      url,
      icon: '🌍'
    });

    localStorage.setItem('favorites', JSON.stringify(favorites));
    closeAddFavModal();
    renderStartPage();
    syncPush(); // Sync if enabled
  };
}

startSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const url = formatInput(startSearchInput.value);
    startTemporarySession(url);
  }
});

function startTemporarySession(initialUrl) {
  appMode = 'temporary';
  startPage.classList.remove('active');

  workspaces['ws_temp'] = {
    id: 'ws_temp',
    name: 'Temporary Session',
    color: '#909095',
    tabs: [],
    activeTabId: null
  };

  currentWorkspaceId = 'ws_temp';

  document.getElementById('workspaceLabel').textContent = 'Temporary Session';
  document.querySelector('#workspaceBtn .workspace-dot').style.background = '#909095';

  createTab(initialUrl);
  renderWorkspaceTabs();
}

// --- BROWSER CORE LOGIC ---
function renderWorkspaceTabs() {
  tabBar.innerHTML = '';
  Object.values(webviews).forEach(wv => wv.classList.remove('active'));

  const ws = workspaces[currentWorkspaceId];
  if (ws && ws.tabs.length === 0) {
    createTab('https://duckduckgo.com');
  } else if (ws) {
    ws.tabs.forEach(tab => {
      createTabDOMElement(tab);
      if (!webviews[tab.id]) createWebview(tab);
    });
    const targetTabId = ws.activeTabId || ws.tabs[ws.tabs.length - 1].id;
    setActiveTab(targetTabId);
  }
}

// --- TAB CONTEXT MENU, LOCKING & PINNING ---

// Pin Tab toggle
pinTabAction.addEventListener('click', () => {
  if (contextMenuTargetTabId === null) return;
  const ws = workspaces[currentWorkspaceId];
  const tabData = ws.tabs.find(t => t.id === contextMenuTargetTabId);
  if (!tabData) return;

  tabData.isPinned = !tabData.isPinned;

  // Pinned tabs are also implicitly locked (close prevention)
  if (tabData.isPinned) tabData.isLocked = true;

  tabContextMenu.classList.remove('visible');
  // Re-render the full tab bar to reorder and update compact style
  reorderTabsInDOM();
  if (appMode !== 'temporary') saveSession();
});

lockTabAction.addEventListener('click', () => {
  if (contextMenuTargetTabId === null) return;
  const ws = workspaces[currentWorkspaceId];
  const tabData = ws.tabs.find(t => t.id === contextMenuTargetTabId);

  if (!tabData) return;
  tabData.isLocked = !tabData.isLocked;

  const tabEl = document.querySelector(`.tab[data-id="${contextMenuTargetTabId}"]`);
  if (tabData.isLocked) {
    tabEl.classList.add('locked');
    tabEl.querySelector('.close-tab').innerHTML = iconLock;
  } else {
    tabEl.classList.remove('locked');
    tabEl.querySelector('.close-tab').innerHTML = iconUnlock;
  }
  tabContextMenu.classList.remove('visible');
  if (appMode !== 'temporary') saveSession();
});

closeTabAction.addEventListener('click', () => {
  if (contextMenuTargetTabId === null) return;
  const ws = workspaces[currentWorkspaceId];
  const tabData = ws && ws.tabs.find(t => t.id === contextMenuTargetTabId);
  if (tabData && tabData.isLocked) return;
  closeTab(contextMenuTargetTabId);
  tabContextMenu.classList.remove('visible');
});

document.getElementById('duplicateTabAction').addEventListener('click', () => {
  if (contextMenuTargetTabId === null) return;
  const ws = workspaces[currentWorkspaceId];
  const srcTab = ws && ws.tabs.find(t => t.id === contextMenuTargetTabId);
  if (srcTab) {
    createTab(srcTab.url);
    showStatus('Tab duplicated');
  }
  tabContextMenu.classList.remove('visible');
});

document.getElementById('reopenTabAction').addEventListener('click', () => {
  if (recentlyClosedTabs.length > 0 && appMode !== 'start') {
    const restored = recentlyClosedTabs.pop();
    createTab(restored.url);
    saveSession();
    showStatus(`Reopened: ${restored.title || restored.url}`);
  } else {
    showStatus('No recently closed tabs');
  }
  tabContextMenu.classList.remove('visible');
});

function showStatus(text) {
  statusLabel.textContent = text
  statusLabel.classList.add('visible')
  setTimeout(() => statusLabel.classList.remove('visible'), 3000)
}

function formatInput(value) {
  let input = value.trim()
  const looksLikeUrl =
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('chrome://') ||
    input.startsWith('localhost:') ||
    (input.includes('.') && !input.includes(' ') && !input.includes('?'));

  if (looksLikeUrl) {
    return !input.match(/^[a-zA-Z]+:\/\//) ? 'https://' + input : input;
  }

  if (settings.searchEngine === 'google') {
    return 'https://www.google.com/search?q=' + encodeURIComponent(input);
  } else if (settings.searchEngine === 'bing') {
    return 'https://www.bing.com/search?q=' + encodeURIComponent(input);
  } else {
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(input);
  }
}

function getActiveTab() {
  const ws = workspaces[currentWorkspaceId];
  if (!ws) return null;
  return ws.tabs.find(tab => tab.id === ws.activeTabId);
}
function getActiveWebview() {
  const activeTab = getActiveTab();
  if (!activeTab) return null;
  return webviews[activeTab.id];
}

function setActiveTab(tabId) {
  const ws = workspaces[currentWorkspaceId];
  if (!ws) return;

  ws.activeTabId = tabId;

  document.querySelectorAll('.tab').forEach(tabEl => {
    tabEl.classList.toggle('active', Number(tabEl.dataset.id) === Number(tabId));
  });

  Object.keys(webviews).forEach(wId => {
    if (Number(wId) === Number(tabId)) webviews[wId].classList.add('active');
    else webviews[wId].classList.remove('active');
  });

  // Automatically hide start page when a tab is selected
  if (startPage) startPage.classList.remove('active');

  const activeTab = getActiveTab();
  if (!activeTab) return;

  const wv = getActiveWebview();
  // Use the live URL from the webview process when available; fall back to our cached tab.url
  const liveUrl = (wv && wv.getURL && wv.getURL()) || activeTab.url || '';
  syncUrlBar(liveUrl);
  activeTab.url = liveUrl || activeTab.url; // keep data model fresh

  if (readerBtn) {
    if (activeTab.isReaderMode) {
      readerBtn.classList.add('active');
      readerBtn.style.color = 'var(--accent, #6ab04c)';
    } else {
      readerBtn.classList.remove('active');
      readerBtn.style.color = '';
    }
  }

  // Handle tab-aware permission prompt transitions
  if (typeof showNextPermission === 'function') {
    if (permActive) {
      permQueue.unshift(permActive);
      permActive = null;
    }
    showNextPermission();
  }

  if (siteInfoMenu) siteInfoMenu.classList.remove('visible');

  updateNavButtons();
  updateBookmarkVisuals(urlInput.value);
  if (typeof updateShieldUI === 'function') updateShieldUI();
  if (appMode !== 'temporary') saveSession();
}

/**
 * syncUrlBar — the ONE place that writes to urlInput.
 * Rules:
 *   1. Never overwrite while user is actively editing.
 *   2. Never show about:blank / empty string.
 *   3. Strip internal error page URLs — show the real broken URL instead.
 */
function syncUrlBar(rawUrl) {
  if (document.activeElement === urlInput) return; // User is typing — leave it alone

  let display = rawUrl || '';

  // Hide about:blank and empty (new tabs before page loads)
  if (!display || display === 'about:blank') return;

  // Strip our internal error.html path so the bar shows the failing URL
  if (display.includes('error.html?url=')) {
    try {
      const errUrl = new URL(display);
      const real = errUrl.searchParams.get('url');
      if (real) display = decodeURIComponent(real);
    } catch (_) { }
  }

  if (urlInput.value !== display) {
    urlInput.value = display;
    updateBookmarkVisuals(display);
  }
}

function updateNavButtons() {
  const wv = getActiveWebview();
  if (!wv) {
    backBtn.disabled = true;
    forwardBtn.disabled = true;
    return;
  }

  // Electron webview methods: canGoBack(), canGoForward()
  try {
    if (typeof wv.canGoBack === 'function') backBtn.disabled = !wv.canGoBack();
    if (typeof wv.canGoForward === 'function') forwardBtn.disabled = !wv.canGoForward();
  } catch (e) {
    // Webview might not be ready yet
    backBtn.disabled = true;
    forwardBtn.disabled = true;
  }
}

function updateTabTitle(tabId, newTitle) {
  const ws = workspaces[currentWorkspaceId];
  if (!ws) return;
  // Search across all workspaces in case tab is not in current one
  let tab = ws.tabs.find(t => t.id === tabId);
  if (!tab) {
    for (const wsId of workspaceOrder) {
      tab = workspaces[wsId].tabs.find(t => t.id === tabId);
      if (tab) break;
    }
  }
  if (!tab) return;
  const title = newTitle || 'New Tab';
  if (tab.title === title) return; // No change, skip DOM update
  tab.title = title;
  const titleEl = document.querySelector(`.tab[data-id="${tabId}"] .tab-title`);
  if (titleEl) titleEl.textContent = title;
  if (appMode !== 'temporary') saveSession();
}

function updateTabFavicon(tabId, favicons) {
  // Prefer the highest-res icon available
  const url = (favicons && favicons.length > 0) ? favicons[0] : null;

  // Find the tab data model in any workspace
  let tab = null;
  for (const wsId of workspaceOrder) {
    const found = workspaces[wsId].tabs.find(t => t.id === tabId);
    if (found) { tab = found; break; }
  }
  if (!tab) return;

  tab.favicon = url || null;

  const imgEl = document.querySelector(`.tab[data-id="${tabId}"] .tab-favicon`);
  if (!imgEl) return;

  if (url) {
    imgEl.src = url;
    imgEl.style.display = 'block';
    imgEl.onerror = () => { imgEl.style.display = 'none'; }; // Fallback on broken URL
  } else {
    imgEl.style.display = 'none';
  }
}

function setTabLoading(tabId, isLoading) {
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
  if (!tabEl) return;

  if (isLoading) {
    tabEl.classList.add('loading');
    // Swap favicon for spinner — restore will happen in setTabLoading(false)
    const img = tabEl.querySelector('.tab-favicon');
    if (img) {
      img._realSrc = img.src || '';      // cache real icon
      img.src = '';
      img.style.display = 'block';
      img.style.animation = 'tab-spin 0.7s linear infinite';
    }
  } else {
    tabEl.classList.remove('loading');
    const img = tabEl.querySelector('.tab-favicon');
    if (img) {
      img.style.animation = '';
      if (img._realSrc) {
        img.src = img._realSrc;
      } else {
        img.style.display = 'none';
      }
    }
  }
}

function setTabError(tabId, hasError) {
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
  if (!tabEl) return;
  if (hasError) tabEl.classList.add('load-error');
  else tabEl.classList.remove('load-error');
}

function createWebview(tab) {
  const wv = document.createElement('webview');
  wv.className = 'browser-view';
  wv.dataset.tabId = tab.id;
  wv.src = tab.url;
  wv.preload = `file://${path.join(__dirname, 'preload.js')}`;
  if (isIncognito) wv.partition = 'incognito';

  browserViewsContainer.appendChild(wv);
  webviews[tab.id] = wv;

  wv.addEventListener('did-fail-load', (e) => {
    // -3 = ERR_ABORTED: navigation cancelled or download started — not a real error
    if (e.errorCode === -3) return;

    console.error(`[Webview Error] Tab ${tab.id} failed to load: ${e.errorDescription} (${e.errorCode})`);

    setTabLoading(tab.id, false);
    setTabError(tab.id, true);

    if (e.validatedURL) {
      const errorPage = `file://${path.join(__dirname, '..', 'error.html')}?url=${encodeURIComponent(e.validatedURL)}&error=${encodeURIComponent(e.errorDescription)}&type=network`;
      wv.loadURL(errorPage);
      if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
        showStatus(`Connection Error: ${e.errorDescription}`);
      }
    }
  });

  wv.addEventListener('render-process-gone', (details) => {
    console.error(`[Webview Crash] Tab ${tab.id} renderer process gone: ${details.reason}`);

    setTabLoading(tab.id, false);
    setTabError(tab.id, true);

    const crashUrl = wv.getURL();
    const errorPage = `file://${path.join(__dirname, '..', 'error.html')}?url=${encodeURIComponent(crashUrl)}&error=${encodeURIComponent(details.reason)}&type=crash`;
    wv.loadURL(errorPage);

    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      showStatus('Page Crashed');
    }
  });

  wv.addEventListener('found-in-page', (e) => {
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      if (e.result.matches !== undefined) {
        findMatchCount.textContent = `${e.result.activeMatchOrdinal}/${e.result.matches}`;
      }
    }
  });

  wv.addEventListener('media-started-playing', () => {
    tab.isAudible = true;
    tab.hasMedia = true;
    reorderTabsInDOM();
    if (mediaPopup && mediaPopup.classList.contains('visible')) renderMediaHub();
  });

  wv.addEventListener('media-paused', () => {
    tab.isAudible = false;
    reorderTabsInDOM();
    if (mediaPopup && mediaPopup.classList.contains('visible')) renderMediaHub();
  });

  wv.addEventListener('did-start-loading', () => {
    setTabLoading(tab.id, true);
    setTabError(tab.id, false);
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      showStatus('Loading...');
    }
  });

  wv.addEventListener('did-stop-loading', () => {
    setTabLoading(tab.id, false);
    const url = wv.getURL();
    tab.url = url || tab.url;
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      showStatus('Ready');
      syncUrlBar(tab.url);
      updateNavButtons();
      if (appMode !== 'temporary') saveSession();
    } else {
      if (appMode !== 'temporary') saveSession();
    }
  });

  wv.addEventListener('page-title-updated', (event) => updateTabTitle(tab.id, event.title));
  wv.addEventListener('page-favicon-updated', (event) => updateTabFavicon(tab.id, event.favicons));

  wv.addEventListener('did-navigate', (e) => {
    const url = wv.getURL() || e.url;
    tab.url = url;
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      syncUrlBar(url);
      updateBookmarkVisuals(url);
      updateNavButtons();
    }
    registerHistoryEvent(tab.url, wv.getTitle());
    if (appMode !== 'temporary') saveSession();
  });

  wv.addEventListener('did-navigate-in-page', (e) => {
    // SPA soft navigation: hash change, pushState etc.
    const url = wv.getURL() || e.url;
    tab.url = url;
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      syncUrlBar(url);
      updateBookmarkVisuals(url);
    }
    registerHistoryEvent(tab.url, wv.getTitle());
    if (appMode !== 'temporary') saveSession();
  });

  // --- POPUP / NEW WINDOW HANDLING ---
  wv.addEventListener('new-window', (e) => {
    e.preventDefault();
    const { url, disposition } = e;

    // Auto-allow background tabs or simple navigations if we want,
    // but the user requested explicit control:
    queuePopupRequest(url, disposition);
  });
}

function reorderTabsInDOM() {
  const ws = workspaces[currentWorkspaceId];
  if (!ws) return;

  // Keep pinned tabs at the left
  ws.tabs.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  tabBar.innerHTML = '';
  ws.tabs.forEach(t => createTabDOMElement(t));
  setActiveTab(ws.activeTabId);
}

function createTabDOMElement(tab) {
  const tabEl = document.createElement('div')
  tabEl.className = 'tab'
  tabEl.dataset.id = tab.id
  if (tab.isLocked) tabEl.classList.add('locked');
  if (tab.isPinned) tabEl.classList.add('pinned');

  const lockIcon = tab.isLocked ? iconLock : iconUnlock;
  const muteHtml = tab.isMuted ? '<span class="mute-tab-btn" title="Unmute">🔇</span>' :
    (tab.isAudible ? '<span class="mute-tab-btn" title="Mute">🔊</span>' : '');

  const faviconHtml = tab.favicon
    ? `<img class="tab-favicon" src="${tab.favicon}" alt="" />`
    : `<img class="tab-favicon" alt="" style="display:none" />`;

  tabEl.innerHTML = `${faviconHtml}<span class="tab-title">${tab.title}</span>${muteHtml}<span class="close-tab">${lockIcon}</span>`;

  // Wire up the favicon onerror fallback for pre-stored favicons
  const faviconEl = tabEl.querySelector('.tab-favicon');
  if (faviconEl) faviconEl.onerror = () => { faviconEl.style.display = 'none'; };

  const muteBtn = tabEl.querySelector('.mute-tab-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wv = webviews[tab.id];
      if (wv) {
        const isMuted = !wv.isAudioMuted();
        wv.setAudioMuted(isMuted);
        tab.isMuted = isMuted;
        reorderTabsInDOM();
      }
    });
  }

  tabEl.draggable = true;
  tabEl.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', tab.id);
    tabEl.classList.add('dragging');
  });

  tabEl.addEventListener('dragend', () => {
    tabEl.classList.remove('dragging');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
  });

  tabEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    tabEl.classList.add('drag-over');
  });

  tabEl.addEventListener('dragleave', () => {
    tabEl.classList.remove('drag-over');
  });

  tabEl.addEventListener('drop', (e) => {
    e.preventDefault();
    tabEl.classList.remove('drag-over');

    const draggedId = Number(e.dataTransfer.getData('text/plain'));
    if (draggedId === tab.id) return;

    const ws = workspaces[currentWorkspaceId];
    if (!ws) return;

    const fromIndex = ws.tabs.findIndex(t => t.id === draggedId);
    const toIndex = ws.tabs.findIndex(t => t.id === tab.id);

    if (fromIndex !== -1 && toIndex !== -1) {
      const movedTab = ws.tabs.splice(fromIndex, 1)[0];
      ws.tabs.splice(toIndex, 0, movedTab);
      if (appMode !== 'temporary') saveSession();
      reorderTabsInDOM();
    }
  });

  tabEl.addEventListener('click', () => setActiveTab(tab.id));

  tabEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenuTargetTabId = tab.id;

    // Update dynamic labels
    pinTabLabel.textContent = tab.isPinned ? 'Unpin Tab' : 'Pin Tab';
    const lockText = tab.isLocked ? 'Unlock Tab' : 'Lock Tab';
    lockTabAction.querySelector('span').textContent = lockText;

    // Close is disabled for locked OR pinned tabs
    if (tab.isLocked || tab.isPinned) closeTabAction.classList.add('disabled');
    else closeTabAction.classList.remove('disabled');

    tabContextMenu.style.left = `${e.clientX}px`;
    tabContextMenu.style.top = `${e.clientY}px`;
    tabContextMenu.classList.add('visible');
  });

  const closeBtn = tabEl.querySelector('.close-tab')
  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    closeTab(tab.id)
  })

  tabBar.appendChild(tabEl)
}

function createTab(initialUrl = 'https://duckduckgo.com') {
  tabCount++
  const id = tabCount
  const tab = { id, title: `New Tab`, url: initialUrl, isLocked: false, isPinned: false }

  const ws = workspaces[currentWorkspaceId];
  if (!ws) return;
  ws.tabs.push(tab)

  createTabDOMElement(tab);
  createWebview(tab);
  setActiveTab(id)
  if (appMode !== 'temporary') saveSession();
}

function closeTab(tabId) {
  const ws = workspaces[currentWorkspaceId];
  if (!ws) return;

  const tabData = ws.tabs.find(t => t.id === tabId);
  if (!tabData) return;           // Already removed
  if (tabData.isLocked) return;   // Locked tabs cannot be closed
  if (tabData.isPinned) return;   // Pinned tabs cannot be closed

  const closingIndex = ws.tabs.findIndex(t => t.id === tabId);

  // --- Determine fallback BEFORE mutating the array ---
  // Prefer the tab to the right, then left, then create a new one
  const nextFallback =
    ws.tabs[closingIndex + 1] ||
    ws.tabs[closingIndex - 1] ||
    null;
  const isActive = ws.activeTabId === tabId;

  // --- Save to closed-tab stack (max 25) ---
  if (appMode !== 'temporary') {
    recentlyClosedTabs.push({
      url: tabData.url,
      title: tabData.title || tabData.url,
      closedAt: Date.now(),
      workspaceId: currentWorkspaceId
    });
    if (recentlyClosedTabs.length > 25) recentlyClosedTabs.shift();
  }

  // --- Remove from data model ---
  ws.tabs = ws.tabs.filter(t => t.id !== tabId);

  // --- Remove DOM tab element ---
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
  if (tabEl) tabEl.remove();

  // --- Destroy webview (prevent memory leak) ---
  const wv = webviews[tabId];
  if (wv) {
    try { wv.stop(); } catch (_) { }
    // Do NOT set src = 'about:blank' — Electron throws ERR_FAILED (-2) on about:blank loads in webviews
    wv.remove();
    delete webviews[tabId];
  }

  // --- Switch active tab if needed ---
  if (isActive) {
    if (nextFallback) {
      setActiveTab(nextFallback.id);
    } else if (ws.tabs.length > 0) {
      setActiveTab(ws.tabs[0].id);
    } else {
      // Last tab closed → open a fresh new-tab page
      ws.activeTabId = null;
      createTab();
    }
  }

  if (appMode !== 'temporary') saveSession();
}

function goToInput() {
  const finalUrl = formatInput(urlInput.value)
  const activeTab = getActiveTab()
  if (!activeTab) return

  activeTab.url = finalUrl;
  const wv = getActiveWebview();
  if (wv) wv.src = finalUrl;

  urlInput.value = finalUrl;
  if (appMode !== 'temporary') saveSession();
}

tabBar.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    tabBar.scrollLeft += e.deltaY;
  }
});

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    goToInput();
    const wv = getActiveWebview();
    if (wv && wv.focus) wv.focus();
  }
})

urlInput.addEventListener('click', () => urlInput.select())

// --- READER MODE ---
if (readerBtn) {
  readerBtn.addEventListener('click', () => {
    const wv = getActiveWebview();
    const tab = getActiveTab();
    if (!wv || !tab) return;

    if (tab.isReaderMode) {
      tab.isReaderMode = false;
      readerBtn.classList.remove('active');
      readerBtn.style.color = '';
      wv.reload();
    } else {
      tab.isReaderMode = true;
      readerBtn.classList.add('active');
      readerBtn.style.color = 'var(--accent, #6ab04c)';

      wv.executeJavaScript(`
        (() => {
          let bestNode = document.body;
          const cands = document.querySelectorAll('article, main, [role="main"], .post-content, .article-content, .entry-content');
          if (cands.length > 0) {
            bestNode = cands[0];
          } else {
            let maxP = 0;
            document.querySelectorAll('div').forEach(d => {
              const pCount = d.querySelectorAll('p').length;
              if (pCount > maxP) { maxP = pCount; bestNode = d; }
            });
          }
          
          const overlay = document.createElement('div');
          overlay.id = 'mybrowser-reader-overlay';
          overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#fdfcf8; z-index:2147483647; overflow-y:auto; padding:60px 20px; box-sizing:border-box; color:#222; font-family:Georgia, serif;';
          
          const inner = document.createElement('div');
          inner.style.cssText = 'max-width:700px; margin:0 auto; font-size:21px; line-height:1.7; letter-spacing:0.2px;';
          
          const clone = bestNode.cloneNode(true);
          const bad = ['script', 'style', 'iframe', 'nav', 'footer', 'aside', 'form', '.ad', '.sidebar', '.comments', '[role="complementary"]'];
          bad.forEach(sel => { clone.querySelectorAll(sel).forEach(el => el.remove()); });
          
          const title = document.createElement('h1');
          title.textContent = document.title;
          title.style.cssText = 'font-size:2.4em; margin-bottom:30px; font-family:-apple-system, sans-serif; font-weight:800; line-height:1.2; border-bottom:1px solid #eaeaea; padding-bottom:15px;';
          inner.appendChild(title);
          
          clone.querySelectorAll('p').forEach(p => p.style.cssText = 'margin-bottom: 22px; color:#333;');
          clone.querySelectorAll('h1, h2, h3').forEach(h => h.style.cssText = 'margin-top: 30px; margin-bottom: 15px; font-family:-apple-system, sans-serif; color:#111;');
          clone.querySelectorAll('img').forEach(img => { img.style.cssText = 'max-width:100%; height:auto; border-radius:8px; margin:20px 0; display:block;'; });
          clone.querySelectorAll('a').forEach(a => { a.style.color = '#0056b3'; a.style.textDecoration = 'none'; });
          
          inner.appendChild(clone);
          overlay.appendChild(inner);
          
          document.body.appendChild(overlay);
          document.body.style.overflow = 'hidden';
        })();
      `);
    }
  });
}

// --- MEDIA HUB LOGIC ---
function renderMediaHub() {
  if (!mediaList) return;
  mediaList.innerHTML = '';
  let hasMedia = false;

  if (workspaces && workspaces[currentWorkspaceId]) {
    const ws = workspaces[currentWorkspaceId];
    ws.tabs.forEach(tab => {
      if (tab.hasMedia || tab.isAudible) {
        hasMedia = true;
        const wv = webviews[tab.id];
        const isPlaying = tab.isAudible;

        const item = document.createElement('div');
        item.className = 'media-item';

        const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        const pauseIcon = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        const pipIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="12" y="14" width="8" height="5"></rect></svg>`;

        item.innerHTML = `
          <div>
            <div class="media-title">${tab.title}</div>
            <div class="media-url">${tab.url ? new URL(tab.url).hostname : 'Media'}</div>
          </div>
          <div class="media-controls">
            <button class="media-btn" id="mPlay_${tab.id}" title="${isPlaying ? 'Pause' : 'Play'}">
              ${isPlaying ? pauseIcon : playIcon}
            </button>
            <button class="media-btn" id="mPip_${tab.id}" title="Picture in Picture">
              ${pipIcon}
            </button>
          </div>
        `;
        mediaList.appendChild(item);

        item.querySelector(`#mPlay_${tab.id}`).onclick = () => {
          if (wv) {
            wv.executeJavaScript(`
              (() => {
                const v = document.querySelector('video') || document.querySelector('audio');
                if (v) { if (v.paused) v.play(); else v.pause(); }
              })();
            `);
            setTimeout(renderMediaHub, 300);
          }
        };

        item.querySelector(`#mPip_${tab.id}`).onclick = () => {
          if (wv) {
            wv.executeJavaScript(`
              (() => {
                const v = document.querySelector('video');
                if (v) v.requestPictureInPicture();
              })();
            `);
          }
        };
      }
    });
  }

  if (!hasMedia) {
    mediaList.innerHTML = '<div class="media-empty">No active media sessions</div>';
  }
}

if (mediaBtn) {
  mediaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (downloadsMenu) downloadsMenu.classList.remove('visible');
    if (shieldMenu) shieldMenu.classList.remove('visible');
    mediaPopup.classList.toggle('visible');
    if (mediaPopup.classList.contains('visible')) {
      renderMediaHub();
    }
  });

  document.addEventListener('click', (e) => {
    if (mediaPopup.classList.contains('visible') && !e.target.closest('#mediaPopup') && !e.target.closest('#mediaBtn')) {
      mediaPopup.classList.remove('visible');
    }
  });
}

// --- DOWNLOADS LOGIC ---
let activeDownloads = {};

if (downloadsBtn) {
  downloadsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (mediaPopup) mediaPopup.classList.remove('visible');
    if (shieldMenu) shieldMenu.classList.remove('visible');
    downloadsMenu.classList.toggle('visible');
    if (downloadsMenu.classList.contains('visible')) renderDownloads();
  });

  document.addEventListener('click', (e) => {
    if (downloadsMenu.classList.contains('visible') && !e.target.closest('#downloadsMenu') && !e.target.closest('#downloadsBtn')) {
      downloadsMenu.classList.remove('visible');
    }
  });

  if (clearDownloadsBtn) {
    clearDownloadsBtn.addEventListener('click', () => {
      activeDownloads = {};
      renderDownloads();
    });
  }
}

function renderDownloads() {
  const dls = Object.values(activeDownloads).reverse();
  downloadsList.innerHTML = '';

  let hasActive = false;

  if (dls.length === 0) {
    downloadsList.innerHTML = '<div class="downloads-empty">No recent downloads</div>';
    document.body.classList.remove('has-active-download');
    return;
  }

  dls.forEach(dl => {
    const el = document.createElement('div');
    el.className = `dl-item ${dl.state}`;

    if (dl.state === 'progressing') hasActive = true;

    const percent = dl.totalBytes > 0 ? (dl.receivedBytes / dl.totalBytes) * 100 : 0;

    let statusText = '';
    if (dl.state === 'completed') statusText = 'Completed';
    else if (dl.state === 'cancelled') statusText = 'Cancelled';
    else if (dl.state === 'interrupted') statusText = 'Interrupted';
    else if (dl.state === 'progressing') {
      const mbReceived = (dl.receivedBytes / (1024 * 1024)).toFixed(1);
      const mbTotal = (dl.totalBytes / (1024 * 1024)).toFixed(1);
      statusText = `${mbReceived} MB / ${mbTotal} MB (${percent.toFixed(0)}%)`;
    }

    const pauseIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    const playIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const cancelIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const folderIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;

    let actionsHtml = '';
    if (dl.state === 'progressing') {
      actionsHtml = `
        <button class="dl-action-btn pause-resume-btn" title="Pause/Resume">${pauseIcon}</button>
        <button class="dl-action-btn cancel-btn" title="Cancel">${cancelIcon}</button>
      `;
    } else if (dl.state === 'completed') {
      actionsHtml = `<button class="dl-action-btn show-folder-btn" title="Show in Folder">${folderIcon}</button>`;
    }

    el.innerHTML = `
      <div class="dl-item-top">
        <div class="dl-info">
          <div class="dl-name" title="${dl.filename}">${dl.filename}</div>
          <div class="dl-status">${statusText}</div>
        </div>
        <div class="dl-actions">${actionsHtml}</div>
      </div>
      <div class="dl-progress-bg">
        <div class="dl-progress-fill" style="width: ${dl.state === 'completed' ? 100 : percent}%"></div>
      </div>
    `;

    // Event Listeners
    if (dl.state === 'progressing') {
      el.querySelector('.pause-resume-btn').onclick = () => {
        ipcRenderer.send('pause-download', dl.id);
      };
      el.querySelector('.cancel-btn').onclick = () => {
        ipcRenderer.send('cancel-download', dl.id);
      };
    } else if (dl.state === 'completed' && dl.path) {
      el.querySelector('.show-folder-btn').onclick = () => {
        ipcRenderer.send('show-item-in-folder', dl.path);
      };
    }

    downloadsList.appendChild(el);
  });

  if (hasActive) document.body.classList.add('has-active-download');
  else document.body.classList.remove('has-active-download');
}

ipcRenderer.on('download-started', (e, { id, filename, totalBytes }) => {
  activeDownloads[id] = { id, filename, totalBytes, receivedBytes: 0, state: 'progressing' };
  renderDownloads();
  if (downloadsMenu) downloadsMenu.classList.add('visible');
});

ipcRenderer.on('download-progress', (e, { id, receivedBytes, totalBytes, state }) => {
  if (activeDownloads[id]) {
    activeDownloads[id].receivedBytes = receivedBytes;
    activeDownloads[id].totalBytes = totalBytes;
    activeDownloads[id].state = state === 'interrupted' ? 'interrupted' : activeDownloads[id].state;
    renderDownloads();
  }
});

ipcRenderer.on('download-done', (e, { id, state, path }) => {
  if (activeDownloads[id]) {
    activeDownloads[id].state = state; // 'completed', 'cancelled', 'interrupted'
    activeDownloads[id].path = path;
    renderDownloads();
  }
});

// --- FIND IN PAGE LOGIC ---
let findBoxVisible = false;

function toggleFindBox(show) {
  findBoxVisible = show;
  if (show) {
    findBox.classList.add('active');
    findInput.focus();
    findInput.select();
  } else {
    findBox.classList.remove('active');
    const wv = getActiveWebview();
    if (wv && wv.stopFindInPage) wv.stopFindInPage('clearSelection');
  }
}

findCloseBtn.addEventListener('click', () => toggleFindBox(false));

findInput.addEventListener('input', () => {
  const text = findInput.value;
  const wv = getActiveWebview();
  if (!wv) return;
  if (text) {
    wv.findInPage(text);
  } else {
    wv.stopFindInPage('clearSelection');
    findMatchCount.textContent = '0/0';
  }
});

findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const wv = getActiveWebview();
    if (wv && findInput.value) {
      wv.findInPage(findInput.value, { forward: !e.shiftKey, findNext: true });
    }
  } else if (e.key === 'Escape') {
    toggleFindBox(false);
  }
});

findNextBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && findInput.value) wv.findInPage(findInput.value, { forward: true, findNext: true });
});

findPrevBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && findInput.value) wv.findInPage(findInput.value, { forward: false, findNext: true });
});

// --- SHIELD LOGIC ---
if (shieldBtn) {
  shieldBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shieldMenu.classList.toggle('visible');
    updateShieldUI();
  });

  document.addEventListener('click', (e) => {
    if (shieldMenu && shieldMenu.classList.contains('visible') && !e.target.closest('#shieldMenu') && !e.target.closest('#shieldBtn')) {
      shieldMenu.classList.remove('visible');
    }
  });
}

function updateShieldUI() {
  const wv = getActiveWebview();
  if (!wv) return;
  try {
    const wcId = wv.getWebContentsId();
    const data = tabShieldData[wcId] || [];
    shieldBlockCount.textContent = data.length;

    shieldBlockList.innerHTML = '';
    const uniqueHosts = [...new Set(data)].slice(0, 50); // display max 50 unique
    if (uniqueHosts.length === 0) {
      shieldBlockList.innerHTML = '<div style="text-align:center; padding: 20px 0;">No trackers detected on this page.</div>';
    } else {
      uniqueHosts.forEach(host => {
        const el = document.createElement('div');
        el.className = 'shield-list-item';
        el.textContent = host;
        shieldBlockList.appendChild(el);
      });
    }

    if (data.length > 0) {
      shieldBtn.classList.add('shield-active');
      shieldBtn.style.color = 'var(--shield-color)';
    } else {
      shieldBtn.classList.remove('shield-active');
      shieldBtn.style.color = '';
    }
  } catch (e) { }
}

ipcRenderer.on('tracker-blocked', (e, { webContentsId, url }) => {
  if (!tabShieldData[webContentsId]) {
    tabShieldData[webContentsId] = [];
  }
  try {
    const host = new URL(url).hostname;
    tabShieldData[webContentsId].unshift(host);
  } catch (e) {
    tabShieldData[webContentsId].unshift(url);
  }

  const wv = getActiveWebview();
  if (wv && wv.getWebContentsId) {
    try {
      if (wv.getWebContentsId() === webContentsId) {
        updateShieldUI();
      }
    } catch (err) { }
  }
});

// --- SETTINGS LOGIC ---
function loadSettingsToUI() {
  if (settingShieldMode) settingShieldMode.value = settings.shieldMode || 'standard';
  settingSearchEngine.value = settings.searchEngine || 'duckduckgo';
  settingHomepageMode.value = settings.homepageMode || 'start-page';
  settingHomepageUrl.value = settings.homepageUrl || '';
  settingHomepageUrl.style.display = settingHomepageMode.value === 'custom' ? 'block' : 'none';
  settingShowFavorites.checked = settings.startPage.showFavorites !== false;
  settingShowWorkspaces.checked = settings.startPage.showWorkspaces !== false;
}

async function checkDefaultBrowserStatus() {
  if (!defaultBrowserStatus) return;
  const isDefault = await ipcRenderer.invoke('check-default-browser');
  if (isDefault) {
    makeDefaultBtn.style.display = 'none';
    defaultBrowserStatus.textContent = '✅ Premium Browser is your default browser.';
    defaultBrowserStatus.style.color = 'var(--shield-color)';
  } else {
    makeDefaultBtn.style.display = 'block';
    defaultBrowserStatus.textContent = 'Premium Browser is not your default browser.';
    defaultBrowserStatus.style.color = 'var(--text-secondary)';
  }
}

async function renderPasswordManager() {
  if (!passwordManagerList) return;
  passwordManagerList.innerHTML = '<div style="padding:16px; color:var(--text-secondary); font-size:13px; text-align:center;">Loading secure vault...</div>';

  const vault = await ipcRenderer.invoke('get-all-passwords');
  passwordManagerList.innerHTML = '';

  if (Object.keys(vault).length === 0) {
    passwordManagerList.innerHTML = '<div style="padding:16px; color:var(--text-secondary); font-size:13px; text-align:center;">No saved passwords yet.</div>';
    return;
  }

  for (const [domain, entries] of Object.entries(vault)) {
    entries.forEach(entry => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.05); color:#fff; font-size:14px;';

      const info = document.createElement('div');
      info.innerHTML = `<strong>${domain}</strong> <span style="color:var(--text-secondary); font-size:13px; margin-left:8px;">${entry.username}</span>`;

      const delBtn = document.createElement('button');
      delBtn.className = 'danger-btn';
      delBtn.style.padding = '4px 8px';
      delBtn.style.fontSize = '12px';
      delBtn.textContent = 'Delete';
      delBtn.onclick = async () => {
        await ipcRenderer.invoke('delete-password', { domain, username: entry.username });
        renderPasswordManager(); // refresh
      };

      row.appendChild(info);
      row.appendChild(delBtn);
      passwordManagerList.appendChild(row);
    });
  }
}

async function renderExtensionsManager() {
  if (!extensionsList) return;
  extensionsList.innerHTML = '<div style="padding:16px; color:var(--text-secondary); font-size:13px; text-align:center;">Loading extensions...</div>';

  const exts = await ipcRenderer.invoke('get-extensions');
  extensionsList.innerHTML = '';
  if (extensionIconsContainer) extensionIconsContainer.innerHTML = '';

  if (exts.length === 0) {
    extensionsList.innerHTML = '<div style="padding:16px; color:var(--text-secondary); font-size:13px; text-align:center;">No extensions loaded.</div>';
    return;
  }

  exts.forEach(ext => {
    // Settings List Item
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(255,255,255,0.02); border-radius:8px; color:#fff; font-size:14px; margin-bottom:8px;';

    const info = document.createElement('div');
    info.innerHTML = `<strong>${ext.name}</strong> <span style="color:var(--text-secondary); font-size:12px; margin-left:8px;">v${ext.version}</span>`;

    const delBtn = document.createElement('button');
    delBtn.className = 'danger-btn';
    delBtn.style.padding = '4px 8px';
    delBtn.style.fontSize = '12px';
    delBtn.textContent = 'Remove';
    delBtn.onclick = async () => {
      await ipcRenderer.invoke('remove-extension', ext.id);
      renderExtensionsManager();
    };

    row.appendChild(info);
    row.appendChild(delBtn);
    extensionsList.appendChild(row);

    // Top Bar Action Icon
    if (extensionIconsContainer) {
      const extIconBtn = document.createElement('button');
      extIconBtn.className = 'icon-btn';
      extIconBtn.title = ext.name;
      extIconBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
      extIconBtn.style.color = 'var(--text-primary)';
      extIconBtn.style.marginRight = '2px';

      if (ext.popup) {
        extIconBtn.onclick = () => {
          if (extPopupContainer.style.display === 'block' && extPopupTitle.textContent === ext.name) {
            extPopupContainer.style.display = 'none';
          } else {
            extPopupTitle.textContent = ext.name;
            extPopupWebview.src = `chrome-extension://${ext.id}/${ext.popup}`;
            extPopupContainer.style.display = 'block';
          }
        };
      } else {
        extIconBtn.style.opacity = '0.5';
        extIconBtn.title = ext.name + ' (No Popup UI)';
      }
      extensionIconsContainer.appendChild(extIconBtn);
    }
  });
}

// --- AUTOFILL MANAGER ---
let autofillProfiles = [];
let autofillCards = [];

async function renderAutofillManager() {
  const data = await ipcRenderer.invoke('get-autofill-data');
  autofillProfiles = data.profiles || [];
  autofillCards = data.cards || [];

  const addressList = document.getElementById('addressList');
  const cardsList = document.getElementById('cardsList');
  if (!addressList || !cardsList) return;

  addressList.innerHTML = '';
  cardsList.innerHTML = '';

  if (autofillProfiles.length === 0) {
    addressList.innerHTML = '<div style="color:var(--text-secondary); padding:12px; text-align:center; background:rgba(255,255,255,0.05); border-radius:8px;">No addresses saved yet.</div>';
  } else {
    autofillProfiles.forEach(p => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div style="flex:1;">
          <div style="font-weight:600; color:#fff;">${p.name || 'Unnamed'}</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${p.address || ''} ${p.city ? '- ' + p.city : ''}</div>
        </div>
        <button class="icon-btn delete-item-btn" title="Remove" data-id="${p.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="#eb5757" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;
      item.querySelector('.delete-item-btn').onclick = async () => {
        await ipcRenderer.invoke('delete-autofill-profile', p.id);
        renderAutofillManager();
      };
      addressList.appendChild(item);
    });
  }

  if (autofillCards.length === 0) {
    cardsList.innerHTML = '<div style="color:var(--text-secondary); padding:12px; text-align:center; background:rgba(255,255,255,0.05); border-radius:8px;">No credit cards saved yet.</div>';
  } else {
    autofillCards.forEach(c => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const last4 = c.number ? c.number.slice(-4) : '****';
      item.innerHTML = `
        <div style="flex:1;">
          <div style="font-weight:600; color:#fff;">•••• •••• •••• ${last4}</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${c.nameOnCard || 'Unknown'} | Exp: ${c.expMonth || '--'}/${c.expYear || '--'}</div>
        </div>
        <button class="icon-btn delete-card-btn" title="Remove" data-id="${c.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="#eb5757" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;
      item.querySelector('.delete-card-btn').onclick = async () => {
        await ipcRenderer.invoke('delete-autofill-card', c.id);
        renderAutofillManager();
      };
      cardsList.appendChild(item);
    });
  }
}

// Modal handling
const autofillModal = document.getElementById('autofillModal');
const autofillModalTitle = document.getElementById('autofillModalTitle');
const autofillModalFields = document.getElementById('autofillModalFields');
const autofillCancelBtn = document.getElementById('autofillCancelBtn');
const autofillSaveBtn = document.getElementById('autofillSaveBtn');
let currentAutofillType = null;

if (autofillCancelBtn) {
  autofillCancelBtn.onclick = () => { autofillModal.style.display = 'none'; };
}

if (document.getElementById('addAddressBtn')) {
  document.getElementById('addAddressBtn').onclick = () => {
    currentAutofillType = 'profile';
    autofillModalTitle.textContent = 'Add Profile/Address';
    autofillModalFields.innerHTML = `
      <input type="text" id="af_name" placeholder="Full Name (e.g. John Doe)" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
      <input type="text" id="af_email" placeholder="Email" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
      <input type="text" id="af_phone" placeholder="Phone Number" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
      <input type="text" id="af_address" placeholder="Address" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
      <input type="text" id="af_city" placeholder="City" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
      <input type="text" id="af_zip" placeholder="ZIP / Postal Code" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
    `;
    autofillModal.style.display = 'flex';
  };
}

if (document.getElementById('addCardBtn')) {
  document.getElementById('addCardBtn').onclick = () => {
    currentAutofillType = 'card';
    autofillModalTitle.textContent = 'Add Credit Card';
    autofillModalFields.innerHTML = `
      <input type="text" id="af_nameOnCard" placeholder="Name on Card" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
      <input type="text" id="af_number" placeholder="Card Number (No spaces needed)" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; width:100%;">
      <div style="display:flex; gap:8px;">
        <input type="text" id="af_expMonth" placeholder="MM" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; flex:1;">
        <input type="text" id="af_expYear" placeholder="YY" style="padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; color:#fff; flex:1;">
      </div>
    `;
    autofillModal.style.display = 'flex';
  };
}

if (autofillSaveBtn) {
  autofillSaveBtn.onclick = async () => {
    if (currentAutofillType === 'profile') {
      const p = {
        name: document.getElementById('af_name').value.trim(),
        email: document.getElementById('af_email').value.trim(),
        phone: document.getElementById('af_phone').value.trim(),
        address: document.getElementById('af_address').value.trim(),
        city: document.getElementById('af_city').value.trim(),
        zip: document.getElementById('af_zip').value.trim()
      };
      await ipcRenderer.invoke('save-autofill-profile', p);
    } else if (currentAutofillType === 'card') {
      const c = {
        nameOnCard: document.getElementById('af_nameOnCard').value.trim(),
        number: document.getElementById('af_number').value.replace(/\s+/g, ''),
        expMonth: document.getElementById('af_expMonth').value.trim(),
        expYear: document.getElementById('af_expYear').value.trim()
      };
      if (!c.number) return;
      await ipcRenderer.invoke('save-autofill-card', c);
    }
    autofillModal.style.display = 'none';
    renderAutofillManager();
  };
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    loadSettingsToUI();
    checkDefaultBrowserStatus();
    renderPasswordManager();
    renderExtensionsManager();
    renderAutofillManager();
    settingsPage.classList.add('active');
  });
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener('click', () => {
    settingsPage.classList.remove('active');
  });
}

const settingsNavBtns = document.querySelectorAll('.settings-nav-btn');
const settingsPanes = document.querySelectorAll('.settings-pane');
const settingsActiveTitle = document.getElementById('settingsActiveTitle');

settingsNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    settingsNavBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settingsActiveTitle.textContent = btn.textContent.trim();
    settingsPanes.forEach(p => p.classList.remove('active'));
    const targetPane = document.getElementById(`sec-${btn.dataset.section}`);
    if (targetPane) targetPane.classList.add('active');
  });
});

if (settingShieldMode) {
  settingShieldMode.addEventListener('change', (e) => {
    settings.shieldMode = e.target.value;
    saveSession();
    ipcRenderer.send('update-shield-mode', settings.shieldMode);
  });
}

settingSearchEngine.addEventListener('change', (e) => {
  settings.searchEngine = e.target.value;
  saveSession();
});

settingHomepageMode.addEventListener('change', (e) => {
  settings.homepageMode = e.target.value;
  settingHomepageUrl.style.display = settings.homepageMode === 'custom' ? 'block' : 'none';
  saveSession();
});

settingHomepageUrl.addEventListener('input', (e) => {
  settings.homepageUrl = e.target.value;
  saveSession();
});

settingShowFavorites.addEventListener('change', (e) => {
  settings.startPage.showFavorites = e.target.checked;
  saveSession();
  if (appMode === 'start') renderStartPage();
});

settingShowWorkspaces.addEventListener('change', (e) => {
  settings.startPage.showWorkspaces = e.target.checked;
  saveSession();
  if (appMode === 'start') renderStartPage();
});

// Danger Zone
clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all history?')) {
    globalHistory = [];
    saveSession();
    if (typeof currentSidePanelTab !== 'undefined' && currentSidePanelTab === 'history') switchSidePanelTab('history');
    showStatus('History Cleared');
  }
});

clearBookmarksBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all bookmarks?')) {
    bookmarks = [];
    updateBookmarkVisuals(urlInput.value);
    saveSession();
    if (typeof currentSidePanelTab !== 'undefined' && currentSidePanelTab === 'bookmarks') switchSidePanelTab('bookmarks');
    showStatus('Bookmarks Cleared');
  }
});

// Default Browser action
if (makeDefaultBtn) {
  makeDefaultBtn.addEventListener('click', async () => {
    await ipcRenderer.invoke('set-default-browser');
    checkDefaultBrowserStatus();
  });
}

// Downloads Location Logic
if (settingAskDownload) {
  settingAskDownload.addEventListener('change', (e) => {
    if (!settings.downloads) settings.downloads = { path: '', askEveryTime: false };
    settings.downloads.askEveryTime = e.target.checked;
    saveSession();
  });
}

if (changeDownloadPathBtn) {
  changeDownloadPathBtn.addEventListener('click', async () => {
    const folderPath = await ipcRenderer.invoke('select-download-folder');
    if (folderPath) {
      if (!settings.downloads) settings.downloads = { path: '', askEveryTime: false };
      settings.downloads.path = folderPath;
      if (settingDownloadPath) settingDownloadPath.value = folderPath;
      saveSession();
    }
  });
}

// --- PASSWORD MANAGER LOGIC ---
ipcRenderer.on('show-password-prompt', (event, payload) => {
  if (isIncognito) return; // Never save passwords in incognito
  if (passwordPrompt) {
    pendingPasswordData = payload;
    pwdPromptDomain.textContent = payload.domain;
    pwdPromptUser.textContent = payload.username;
    passwordPrompt.style.display = 'flex';
  }
});

if (pwdPromptSave) {
  pwdPromptSave.addEventListener('click', async () => {
    if (pendingPasswordData) {
      const success = await ipcRenderer.invoke('save-password', pendingPasswordData);
      if (success) {
        showStatus('Password securely saved.');
      } else {
        showStatus('Error saving password (Encryption failed)');
      }
    }
    passwordPrompt.style.display = 'none';
    pendingPasswordData = null;
  });
}

if (pwdPromptNever) {
  pwdPromptNever.addEventListener('click', () => {
    passwordPrompt.style.display = 'none';
    pendingPasswordData = null;
  });
}

// --- EXTENSIONS LOGIC ---
if (closeExtPopupBtn) {
  closeExtPopupBtn.addEventListener('click', () => {
    if (extPopupContainer) extPopupContainer.style.display = 'none';
    if (extPopupWebview) extPopupWebview.src = 'about:blank';
  });
}

if (installCrxBtn) {
  installCrxBtn.addEventListener('click', async () => {
    let raw = crxIdInput.value.trim();
    if (!raw) return;

    let extId = raw;
    const match = raw.match(/([a-z]{32})/);
    if (match) extId = match[1];

    installCrxBtn.disabled = true;
    const originalText = installCrxBtn.textContent;
    installCrxBtn.textContent = 'Installing...';

    const result = await ipcRenderer.invoke('install-chrome-extension', extId);

    installCrxBtn.disabled = false;
    installCrxBtn.textContent = originalText;

    if (result && result.success) {
      crxIdInput.value = '';
      showStatus(`Installed Extension: ${result.name}`);
      renderExtensionsManager();
    } else {
      showStatus(`Error: ${result ? result.error : 'Network Issue'}`);
    }
  });
}

if (loadExtensionBtn) {
  loadExtensionBtn.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('load-unpacked-extension');
    if (result && !result.error) {
      showStatus(`Loaded Extension: ${result.name}`);
      renderExtensionsManager();
    } else if (result && result.error) {
      showStatus(`Error: ${result.error}`);
    }
  });
}

// --- GLOBAL KEYBOARD SHORTCUTS (Window-Level) ---
// All tab/navigation shortcuts are handled in the main document.addEventListener('keydown')
// block near the top of this file (Ctrl+T, Ctrl+W, Ctrl+Shift+T, Ctrl+L, Ctrl+Tab, Ctrl+Shift+Tab).
// This block only handles IPC-forwarded shortcuts from main process.
ipcRenderer.on('keyboard-shortcut-new-tab', () => createTab());
ipcRenderer.on('keyboard-shortcut-close-tab', () => {
  if (appMode !== 'start') {
    const active = getActiveTab();
    if (active) closeTab(active.id);
  }
});
ipcRenderer.on('keyboard-shortcut-focus-url', () => {
  urlInput.focus();
  urlInput.select();
});
ipcRenderer.on('keyboard-shortcut-reopen-tab', () => {
  if (recentlyClosedTabs.length > 0 && appMode !== 'start') {
    const restored = recentlyClosedTabs.pop();
    createTab(restored.url);
    saveSession();
  }
});
ipcRenderer.on('keyboard-shortcut-next-tab', () => {
  if (appMode !== 'start') {
    const ws = workspaces[currentWorkspaceId];
    if (ws && ws.tabs.length > 1) {
      const idx = ws.tabs.findIndex(t => t.id === ws.activeTabId);
      setActiveTab(ws.tabs[(idx + 1) % ws.tabs.length].id);
    }
  }
});
ipcRenderer.on('keyboard-shortcut-prev-tab', () => {
  if (appMode !== 'start') {
    const ws = workspaces[currentWorkspaceId];
    if (ws && ws.tabs.length > 1) {
      const idx = ws.tabs.findIndex(t => t.id === ws.activeTabId);
      setActiveTab(ws.tabs[(idx - 1 + ws.tabs.length) % ws.tabs.length].id);
    }
  }
});

// --- PERMISSION PROMPT SYSTEM ---
const permissionPrompt = document.getElementById('permissionPrompt');
const permDomain = document.getElementById('permDomain');
const permType = document.getElementById('permType');
const permIcon = document.getElementById('permIcon');
const permAllowBtn = document.getElementById('permAllowBtn');
const permBlockBtn = document.getElementById('permBlockBtn');
const permDismissBtn = document.getElementById('permDismissBtn');
const permRemember = document.getElementById('permRemember');

const PERM_META = {
  geolocation: { icon: '📍', label: 'location' },
  notifications: { icon: '🔔', label: 'notifications' },
  camera: { icon: '📷', label: 'camera' },
  microphone: { icon: '🎙️', label: 'microphone' },
  media: { icon: '🎙️', label: 'microphone & camera' },
  'clipboard-read': { icon: '📋', label: 'clipboard' },
};

let permQueue = [];     // {key, origin, permission, webContentsId}[]
let permActive = null;  // currently displayed prompt data

function showNextPermission() {
  if (permActive || permQueue.length === 0) {
    if (!permActive) permissionPrompt.classList.remove('visible');
    return;
  }

  // Find next permission FOR THE ACTIVE TAB
  const activeTab = getActiveTab();
  const activeWv = activeTab ? webviews[activeTab.id] : null;
  const activeWcId = activeWv ? activeWv.getWebContentsId() : null;

  // Filter the queue to see if any pending items belong to the current tab
  // If not, we keep the prompt hidden but the queue intact.
  const nextIdx = permQueue.findIndex(p => p.webContentsId === activeWcId);

  if (nextIdx === -1) {
    permissionPrompt.classList.remove('visible');
    return;
  }

  // Extract the specific item
  permActive = permQueue.splice(nextIdx, 1)[0];

  const meta = PERM_META[permActive.permission] || { icon: '🔒', label: permActive.permission };
  permDomain.textContent = permActive.origin;
  permType.textContent = meta.label;
  permIcon.textContent = meta.icon;
  permRemember.checked = false;
  permissionPrompt.classList.add('visible');
}

function resolvePermission(decision) {
  if (!permActive) return;
  ipcRenderer.send('permission-decision', {
    key: permActive.key,
    decision,
    remember: permRemember.checked
  });
  permissionPrompt.classList.remove('visible');
  setTimeout(() => {
    permActive = null;
    showNextPermission();
  }, 320);
}

// --- SITE INFO LOGIC ---
async function renderSiteInfo() {
  const tab = getActiveTab();
  if (!tab) return;

  let origin = 'Internal';
  try { origin = new URL(tab.url).hostname || 'Internal'; } catch (e) { }

  siteInfoDomain.textContent = origin;

  const isSecure = tab.url.startsWith('https://');
  siteInfoSecurity.innerHTML = isSecure
    ? `<span style="color:#4cd137">🔒</span> Connection is secure`
    : `<span style="color:#e84118">⚠️</span> Connection is not secure`;

  // Fetch permissions from main
  const perms = await ipcRenderer.invoke('get-site-permissions', origin);
  sitePermList.innerHTML = '';

  const keys = Object.keys(perms);
  if (keys.length === 0) {
    sitePermList.innerHTML = `<div class="empty-state">No special permissions used.</div>`;
  } else {
    keys.forEach(p => {
      const meta = PERM_META[p] || { icon: '⚙️', label: p };
      const item = document.createElement('div');
      item.className = 'site-perm-item';
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${meta.icon}</span>
          <span>${meta.label}</span>
        </div>
        <div class="perm-status ${perms[p]}">${perms[p]}</div>
      `;
      // Click to toggle/revoke could be added here
      sitePermList.appendChild(item);
    });
  }
}

siteInfoBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  siteInfoMenu.classList.toggle('visible');
  if (siteInfoMenu.classList.contains('visible')) renderSiteInfo();
});

resetSitePermsBtn.addEventListener('click', async () => {
  const tab = getActiveTab();
  if (!tab) return;
  let origin = '';
  try { origin = new URL(tab.url).hostname; } catch (e) { }
  if (!origin) return;

  // We'll need a way to reset all for origin. For now, we can loop if we had the list,
  // or add a new IPC. Let's send a generic "reset" for origin.
  const perms = await ipcRenderer.invoke('get-site-permissions', origin);
  Object.keys(perms).forEach(p => {
    ipcRenderer.send('revoke-site-permission', { origin, permission: p });
  });

  renderSiteInfo();
});

// Close popovers on click outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.site-info-popover') && !e.target.closest('.site-info-btn')) {
    siteInfoMenu.classList.remove('visible');
  }
});

permAllowBtn.addEventListener('click', () => resolvePermission('allow'));
permBlockBtn.addEventListener('click', () => resolvePermission('block'));
permDismissBtn.addEventListener('click', () => resolvePermission('block')); // dismiss = block without remember

ipcRenderer.on('show-permission-prompt', (e, data) => {
  permQueue.push(data);
  showNextPermission();
});

ipcRenderer.on('dismiss-permission-prompt', (e, { key }) => {
  // Timed-out from main process — close if it's the active one
  if (permActive && permActive.key === key) {
    permissionPrompt.classList.remove('visible');
    setTimeout(() => { permActive = null; showNextPermission(); }, 320);
  } else {
    permQueue = permQueue.filter(p => p.key !== key);
  }
});

// --- POPUP PROMPT SYSTEM ---
const popupPrompt = document.getElementById('popupPrompt');
const popupOrigin = document.getElementById('popupOrigin');
const popupUrl = document.getElementById('popupUrl');
const popupBlockBtn = document.getElementById('popupBlockBtn');
const popupTabBtn = document.getElementById('popupTabBtn');
const popupWindowBtn = document.getElementById('popupWindowBtn');
const popupDismissBtn = document.getElementById('popupDismissBtn');

let popupQueue = [];
let popupActive = null;

function queuePopupRequest(url, disposition) {
  popupQueue.push({ url, disposition });
  showNextPopup();
}

function showNextPopup() {
  if (popupActive || popupQueue.length === 0) return;
  popupActive = popupQueue.shift();

  try {
    popupOrigin.textContent = new URL(popupActive.url).hostname;
  } catch (e) {
    popupOrigin.textContent = 'Site';
  }
  popupUrl.textContent = popupActive.url;
  popupPrompt.classList.add('visible');
}

function resolvePopup(action) {
  if (!popupActive) return;

  const url = popupActive.url;
  if (action === 'tab') {
    createTab(url);
  } else if (action === 'window') {
    ipcRenderer.send('open-new-window', url);
  }

  popupPrompt.classList.remove('visible');
  setTimeout(() => {
    popupActive = null;
    showNextPopup();
  }, 320);
}

popupBlockBtn.addEventListener('click', () => resolvePopup('block'));
popupTabBtn.addEventListener('click', () => resolvePopup('tab'));
popupWindowBtn.addEventListener('click', () => resolvePopup('window'));
popupDismissBtn.addEventListener('click', () => resolvePopup('block'));

// --- CLOUD SYNC ENGINE ---
async function syncPush() {
  if (!syncUser) return;
  setSyncStatus('syncing');

  const data = {
    workspaces: workspaces,
    currentWorkspaceId: currentWorkspaceId,
    bookmarks: [], // Placeholder for future bookmarks feature
    history: [],   // Placeholder for future history feature
    settings: settings,
    lastModified: Date.now()
  };

  const res = await ipcRenderer.invoke('sync-data-push', { data, email: syncUser.email });
  if (res.success) {
    lastSyncTimestamp = new Date().toLocaleTimeString();
    localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp);
    if (lastSyncTime) lastSyncTime.textContent = lastSyncTimestamp;
    setSyncStatus('online');
  } else {
    setSyncStatus('offline');
  }
}

async function syncPull() {
  if (!syncUser) return;
  setSyncStatus('syncing');

  const res = await ipcRenderer.invoke('sync-data-pull', syncUser.email);
  if (res.success && res.data) {
    // Basic merge: remote wins for simplicity in this MVP
    if (res.data.workspaces) {
      Object.assign(workspaces, res.data.workspaces);
      localStorage.setItem('workspaces', JSON.stringify(workspaces));
      // Re-render workspaces if needed
      renderWorkspaceTabs();
    }
    if (res.data.settings) {
      Object.assign(settings, res.data.settings);
      localStorage.setItem('settings', JSON.stringify(settings));
    }
    setSyncStatus('online');
  } else {
    setSyncStatus('online'); // even if empty, we are logged in
  }
}

function setSyncStatus(status) {
  if (!syncBadge) return;
  syncBadge.className = 'sync-badge ' + status;
}

function updateAuthUI() {
  if (syncUser) {
    authForm.style.display = 'none';
    authProfile.style.display = 'block';
    profileEmail.textContent = syncUser.email;
    authStatusText.textContent = 'Account synchronized';
    if (lastSyncTime) lastSyncTime.textContent = lastSyncTimestamp || 'Never';
    setSyncStatus('online');
  } else {
    authForm.style.display = 'block';
    authProfile.style.display = 'none';
    authStatusText.textContent = 'Sign in to sync your data across devices';
    setSyncStatus('offline');
  }
}

userBtn.addEventListener('click', () => {
  authModal.classList.add('visible');
  updateAuthUI();
});

closeAuthBtn.addEventListener('click', () => authModal.classList.remove('visible'));

authSubmitBtn.addEventListener('click', async () => {
  const email = authEmail.value;
  const password = authPass.value;
  if (!email || !password) return;

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = 'Signing in...';

  const res = await ipcRenderer.invoke('auth-login', { email, password });
  if (res.success) {
    syncUser = { email: res.email, token: res.token };
    localStorage.setItem('syncUser', JSON.stringify(syncUser));
    updateAuthUI();
    await syncPull();
    await syncPush();
  } else {
    alert('Authentication failed');
  }

  authSubmitBtn.disabled = false;
  authSubmitBtn.textContent = 'Sign In & Sync';
});

signOutBtn.addEventListener('click', () => {
  syncUser = null;
  localStorage.removeItem('syncUser');
  updateAuthUI();
});

syncNowBtn.addEventListener('click', () => syncPush());

// Initial Auth Setup
updateAuthUI();

// Auto-Sync Interval (every 5 minutes if logged in)
setInterval(() => {
  if (syncUser) syncPush();
}, 5 * 60 * 1000);

// === INITIALIZE APP ===
const startupUrl = urlParams.get('url');

if (startupUrl) {
  // If we have a startup URL (e.g. from window.open -> New Window), 
  // clear the session-load logic for this window instance and open the target.
  createTab(startupUrl);
} else {
  loadSession();
  restoreSessionUI();
}

ipcRenderer.send('update-shield-mode', settings.shieldMode || 'standard');

// Startup Navigation: If no tabs are restored, load the homepage or start page
setTimeout(() => {
  const ws = workspaces[currentWorkspaceId];
  if (!startupUrl && (!ws || ws.tabs.length === 0)) {
    if (settings.homepageMode === 'homepage' && settings.homepageUrl) {
      createTab(formatInput(settings.homepageUrl));
    } else {
      renderStartPage();
    }
  }
}, 500); // Give session restore a moment to finish
renderExtensionsManager();

// --- NETWORK STATUS MONITOR ---
window.addEventListener('online', () => showStatus('Back Online'));
window.addEventListener('offline', () => showStatus('Connection Lost'));