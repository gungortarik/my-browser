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
const browserViewsContainer = document.getElementById('browserViewsContainer')
const statusLabel = document.getElementById('status')

// Context Menus
const tabContextMenu = document.getElementById('tabContextMenu');
const workspaceMenu = document.getElementById('workspaceMenu');
const workspaceBtn = document.getElementById('workspaceBtn');
const lockTabAction = document.getElementById('lockTabAction');
const closeTabAction = document.getElementById('closeTabAction');
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

let appMode = 'start'; 
let workspaces = { ...DEFAULT_WORKSPACES };
let workspaceOrder = ['ws_personal', 'ws_work'];
let currentWorkspaceId = 'ws_personal'; 
let favorites = [...DEFAULT_FAVORITES];
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
function saveSession() {
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
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
      fs.writeFileSync(sessionFilePath, JSON.stringify(data, null, 2), 'utf8');
      ipcRenderer.send('update-download-settings', settings.downloads || {askEveryTime: false, path: ''});
    } catch (err) {
      console.error('Failed to save session to disk:', err);
    }
  }, 300); 
}

function loadSession() {
  if (fs.existsSync(sessionFilePath)) {
    try {
      const stored = fs.readFileSync(sessionFilePath, 'utf8');
      const parsed = JSON.parse(stored);
      if (parsed.workspaces && Object.keys(parsed.workspaces).length > 0) {
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
      }
    } catch (e) {
      console.error('Failed to parse session file', e);
    }
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
  if (settings.homepageMode === 'start-page') {
    renderStartPage();
    startPage.classList.add('active');
  } else {
    const wv = getActiveWebview();
    if (wv && wv.loadURL) wv.loadURL(settings.homepageUrl);
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
    } catch(e) {}
    
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
  appMode = 'start';
  
  favoritesGrid.parentElement.style.display = settings.startPage.showFavorites ? 'block' : 'none';
  startWsGrid.parentElement.style.display = settings.startPage.showWorkspaces ? 'block' : 'none';

  favoritesGrid.innerHTML = '';
  favorites.forEach(fav => {
    const el = document.createElement('div');
    el.className = 'fav-item';
    el.innerHTML = `
      <div class="fav-icon-box">${fav.icon}</div>
      <span class="fav-name">${fav.name}</span>
    `;
    el.addEventListener('click', () => startTemporarySession(fav.url));
    favoritesGrid.appendChild(el);
  });

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

// --- TAB CONTEXT MENU & LOCKING ---
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
  const tabData = ws.tabs.find(t => t.id === contextMenuTargetTabId);
  if (tabData && tabData.isLocked) return;
  closeTab(contextMenuTargetTabId);
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

  const activeTab = getActiveTab();
  if (!activeTab) return;

  const wv = getActiveWebview();
  if (wv && wv.getURL) {
    urlInput.value = wv.getURL() || activeTab.url;
  } else {
    urlInput.value = activeTab.url;
  }
  
  updateBookmarkVisuals(urlInput.value);
  if (typeof updateShieldUI === 'function') updateShieldUI();
  if (appMode !== 'temporary') saveSession();
}

function updateTabTitle(tabId, newTitle) {
  const ws = workspaces[currentWorkspaceId];
  if (!ws) return;
  const tab = ws.tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.title = newTitle || 'New Tab';
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"] .tab-title`);
  if (tabEl) tabEl.textContent = tab.title;
  if (appMode !== 'temporary') saveSession();
}

function createWebview(tab) {
  const wv = document.createElement('webview');
  wv.className = 'browser-view';
  wv.dataset.tabId = tab.id;
  wv.src = tab.url;
  
  browserViewsContainer.appendChild(wv);
  webviews[tab.id] = wv;

  wv.addEventListener('did-fail-load', (e) => {
    // e.errorCode -3 is ERR_ABORTED (happens when navigation is stopped or download starts)
    if (e.errorCode !== -3 && e.validatedURL) {
      // Build dynamic path to the error.html
      const errorPage = `file://${path.join(__dirname, '..', 'error.html')}?url=${encodeURIComponent(e.validatedURL)}&error=${encodeURIComponent(e.errorDescription)}`;
      wv.loadURL(errorPage);
      if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
        showStatus('Connection Interrupted');
      }
    }
  });

  wv.addEventListener('found-in-page', (e) => {
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      if (e.result.matches !== undefined) {
        findMatchCount.textContent = `${e.result.activeMatchOrdinal}/${e.result.matches}`;
      }
    }
  });

  wv.addEventListener('did-start-loading', () => {
    const ws = workspaces[currentWorkspaceId];
    if (ws && ws.activeTabId === tab.id) showStatus('Loading...');
  });
  
  wv.addEventListener('did-stop-loading', () => {
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id) {
      showStatus('Ready');
      const url = wv.getURL();
      tab.url = url;
      if (document.activeElement !== urlInput) urlInput.value = url;
      updateBookmarkVisuals(url);
      if (appMode !== 'temporary') saveSession();
    } else {
      tab.url = wv.getURL();
      if (appMode !== 'temporary') saveSession();
    }
  });

  wv.addEventListener('page-title-updated', (event) => updateTabTitle(tab.id, event.title));
  
  wv.addEventListener('did-navigate', (e) => {
    tab.url = wv.getURL();
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id && document.activeElement !== urlInput) {
      urlInput.value = tab.url;
      updateBookmarkVisuals(tab.url);
    }
    registerHistoryEvent(tab.url, wv.getTitle());
    if (appMode !== 'temporary') saveSession();
  });
  
  wv.addEventListener('did-navigate-in-page', (e) => {
    tab.url = wv.getURL();
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id && document.activeElement !== urlInput) {
      urlInput.value = tab.url;
      updateBookmarkVisuals(tab.url);
    }
    registerHistoryEvent(tab.url, wv.getTitle());
    if (appMode !== 'temporary') saveSession();
  });
}

function createTabDOMElement(tab) {
  const tabEl = document.createElement('div')
  tabEl.className = 'tab'
  tabEl.dataset.id = tab.id
  if (tab.isLocked) tabEl.classList.add('locked');

  const lockIcon = tab.isLocked ? iconLock : iconUnlock;
  tabEl.innerHTML = `<span class="tab-title">${tab.title}</span><span class="close-tab">${lockIcon}</span>`

  tabEl.addEventListener('click', () => setActiveTab(tab.id));

  tabEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenuTargetTabId = tab.id;
    const lockText = tab.isLocked ? 'Unlock Tab' : 'Lock Tab';
    lockTabAction.querySelector('span').textContent = lockText;
    if (tab.isLocked) closeTabAction.classList.add('disabled');
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
  const tab = { id, title: `New Tab`, url: initialUrl, isLocked: false }

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
  if (tabData && tabData.isLocked) return;

  const closingIndex = ws.tabs.findIndex(tab => tab.id === tabId)
  if (closingIndex === -1) return

  if (appMode !== 'temporary' && tabData) {
    recentlyClosedTabs.push({ url: tabData.url, title: tabData.title, closedAt: Date.now() });
    if (recentlyClosedTabs.length > 25) recentlyClosedTabs.shift();
  }

  ws.tabs = ws.tabs.filter(tab => tab.id !== tabId)

  const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`)
  if (tabEl) tabEl.remove();
  
  if (webviews[tabId]) {
    webviews[tabId].remove();
    delete webviews[tabId];
  }

  if (ws.activeTabId === tabId) {
    const fallbackTab = ws.tabs[closingIndex] || ws.tabs[closingIndex - 1] || ws.tabs[0]
    if (fallbackTab) {
      setActiveTab(fallbackTab.id)
    } else {
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

// --- TOOLBAR BUTTON HANDLERS ---
newTabBtn.addEventListener('click', () => createTab())
backBtn.addEventListener('click', () => { const wv = getActiveWebview(); if (wv && wv.canGoBack && wv.canGoBack()) wv.goBack(); })
forwardBtn.addEventListener('click', () => { const wv = getActiveWebview(); if (wv && wv.canGoForward && wv.canGoForward()) wv.goForward(); })
refreshBtn.addEventListener('click', () => { const wv = getActiveWebview(); if (wv && wv.reload) wv.reload(); })

homeBtn.addEventListener('click', () => {
  if (settings.homepageMode === 'start-page') {
    startSearchInput.value = '';
    renderStartPage();
    startPage.classList.add('active');
  } else {
    const finalUrl = formatInput(settings.homepageUrl);
    const activeTab = getActiveTab();
    if (!activeTab) return;
    
    activeTab.url = finalUrl;
    const wv = getActiveWebview();
    if (wv) wv.src = finalUrl;
    
    urlInput.value = finalUrl;
    if (appMode !== 'temporary') saveSession();
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

// --- DOWNLOADS LOGIC ---
let activeDownloads = {};

if (downloadsBtn) {
  downloadsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadsMenu.classList.toggle('visible');
  });

  document.addEventListener('click', (e) => {
    if (downloadsMenu.classList.contains('visible') && !e.target.closest('#downloadsMenu') && !e.target.closest('#downloadsBtn')) {
      downloadsMenu.classList.remove('visible');
    }
  });

  clearDownloadsBtn.addEventListener('click', () => {
    activeDownloads = {};
    renderDownloads();
  });
}

function renderDownloads() {
  const dls = Object.values(activeDownloads).reverse();
  downloadsList.innerHTML = '';
  if (dls.length === 0) {
    downloadsList.innerHTML = '<div class="downloads-empty">No recent downloads</div>';
    return;
  }
  
  dls.forEach(dl => {
    const el = document.createElement('div');
    el.className = `dl-item ${dl.state === 'completed' ? 'done' : dl.state === 'interrupted' ? 'interrupted' : ''}`;
    
    let statusText = dl.state === 'completed' ? 'Done' : dl.state === 'interrupted' ? 'Failed' : `${dl.percent.toFixed(0)}%`;
    let actionBtn = dl.state === 'completed' ? `<button class="dl-action-btn" title="Show in Folder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></button>` : '';

    el.innerHTML = `
      <div class="dl-item-top">
        <div class="dl-info">
          <div class="dl-name">${dl.fileName}</div>
          <div class="dl-status">${statusText}</div>
        </div>
        <div class="dl-actions">${actionBtn}</div>
      </div>
      <div class="dl-progress-bar">
        <div class="dl-progress-fill" style="width: ${dl.state === 'completed' ? 100 : dl.percent}%"></div>
      </div>
    `;

    if (dl.state === 'completed' && dl.savePath) {
      const btn = el.querySelector('.dl-action-btn');
      if (btn) btn.addEventListener('click', () => shell.showItemInFolder(dl.savePath));
    }
    
    downloadsList.appendChild(el);
  });
}

ipcRenderer.on('download-started', (e, { id, fileName }) => {
  activeDownloads[id] = { id, fileName, percent: 0, state: 'progressing' };
  renderDownloads();
  downloadsMenu.classList.add('visible'); // Auto-show
});

ipcRenderer.on('download-progress', (e, { id, percent }) => {
  if (activeDownloads[id]) {
    activeDownloads[id].percent = percent;
    renderDownloads();
  }
});

ipcRenderer.on('download-done', (e, { id, state, savePath }) => {
  if (activeDownloads[id]) {
    activeDownloads[id].state = state;
    activeDownloads[id].savePath = savePath;
    if (state === 'completed') activeDownloads[id].percent = 100;
    renderDownloads();
  }
});

ipcRenderer.on('download-interrupted', (e, { id }) => {
  if (activeDownloads[id]) {
    activeDownloads[id].state = 'interrupted';
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
  } catch(e) {}
}

ipcRenderer.on('tracker-blocked', (e, { webContentsId, url }) => {
  if (!tabShieldData[webContentsId]) {
    tabShieldData[webContentsId] = [];
  }
  try {
    const host = new URL(url).hostname;
    tabShieldData[webContentsId].unshift(host);
  } catch(e) {
    tabShieldData[webContentsId].unshift(url);
  }
  
  const wv = getActiveWebview();
  if (wv && wv.getWebContentsId) {
    try {
      if (wv.getWebContentsId() === webContentsId) {
        updateShieldUI();
      }
    } catch(err) {}
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

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    loadSettingsToUI();
    checkDefaultBrowserStatus();
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
    if (!settings.downloads) settings.downloads = {path: '', askEveryTime: false};
    settings.downloads.askEveryTime = e.target.checked;
    saveSession();
  });
}

if (changeDownloadPathBtn) {
  changeDownloadPathBtn.addEventListener('click', async () => {
    const folderPath = await ipcRenderer.invoke('select-download-folder');
    if (folderPath) {
      if (!settings.downloads) settings.downloads = {path: '', askEveryTime: false};
      settings.downloads.path = folderPath;
      if (settingDownloadPath) settingDownloadPath.value = folderPath;
      saveSession();
    }
  });
}

// === INITIALIZE APP ===
loadSession();
ipcRenderer.send('update-shield-mode', settings.shieldMode || 'standard');
renderStartPage();