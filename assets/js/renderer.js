const fs = require('fs');
const path = require('path');
const os = require('os');

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
  startPage: {
    backgroundTheme: 'default',
    showWorkspaces: true,
    showFavorites: true,
    layoutMode: 'comfortable',
    showRecent: true
  }
};

let appMode = 'start'; // 'start' | 'workspace' | 'temporary'
let workspaces = { ...DEFAULT_WORKSPACES };
let workspaceOrder = ['ws_personal', 'ws_work'];
let currentWorkspaceId = 'ws_personal'; // last active workspace pointer
let favorites = [...DEFAULT_FAVORITES];
let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

let tabCount = 0;
let wsCount = 2;
let contextMenuTargetTabId = null;

const webviews = {};

const iconUnlock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const iconLock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

// --- PERSISTENCE MODULE (FS JSON) ---
function saveSession() {
  // Filter out the Temporary session to ensure it doesn't pollute the saved workspaces
  const persistentWorkspaces = { ...workspaces };
  if (persistentWorkspaces['ws_temp']) {
    delete persistentWorkspaces['ws_temp'];
  }
  
  // Also ensure currentWorkspaceId points to a real workspace if restarting
  const safeCurrentWorkspaceId = currentWorkspaceId === 'ws_temp' ? workspaceOrder[0] : currentWorkspaceId;

  const data = { 
    workspaces: persistentWorkspaces, 
    workspaceOrder, 
    currentWorkspaceId: safeCurrentWorkspaceId, 
    tabCount, 
    wsCount, 
    favorites, 
    settings 
  };
  
  try {
    fs.writeFileSync(sessionFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save session to disk:', err);
  }
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

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    if (settings.homepageMode === 'start-page') {
      settings.homepageMode = 'custom-url';
      showStatus(`Home Button bound to: ${settings.homepageUrl}`);
    } else {
      settings.homepageMode = 'start-page';
      showStatus('Home Button bound to: Internal Start Page');
    }
    saveSession();
  });
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
  saveSession(); // this safely ignores ws_temp
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

// Create a Non-Persisted Session independently
function startTemporarySession(initialUrl) {
  appMode = 'temporary';
  startPage.classList.remove('active');

  // Inject a virtual temporary workspace into the native 1:1 struct
  workspaces['ws_temp'] = {
    id: 'ws_temp',
    name: 'Temporary Session',
    color: '#909095',
    tabs: [],
    activeTabId: null
  };
  
  currentWorkspaceId = 'ws_temp';
  
  // UI Display logic
  document.getElementById('workspaceLabel').textContent = 'Temporary Session';
  document.querySelector('#workspaceBtn .workspace-dot').style.background = '#909095';

  createTab(initialUrl);
  renderWorkspaceTabs(); 
  // No persistent save call so this never hits disk!
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
  const looksLikeUrl = input.startsWith('http://') || input.startsWith('https://') || input.startsWith('www.') || input.startsWith('localhost:') || (input.includes('.') && !input.includes(' ') && !input.includes('?') && !input.includes('://'))
  if (looksLikeUrl) return !input.match(/^[a-zA-Z]+:\/\//) ? 'https://' + input : input;
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(input)
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
  if (wv && wv.getURL) urlInput.value = wv.getURL() || activeTab.url;
  else urlInput.value = activeTab.url;
  
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
      if (appMode !== 'temporary') saveSession();
    } else {
      tab.url = wv.getURL();
      if (appMode !== 'temporary') saveSession();
    }
  });

  wv.addEventListener('page-title-updated', (event) => updateTabTitle(tab.id, event.title));
  wv.addEventListener('did-navigate', () => {
    tab.url = wv.getURL();
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id && document.activeElement !== urlInput) urlInput.value = tab.url;
    if (appMode !== 'temporary') saveSession();
  });
  wv.addEventListener('did-navigate-in-page', () => {
    tab.url = wv.getURL();
    if (workspaces[currentWorkspaceId] && workspaces[currentWorkspaceId].activeTabId === tab.id && document.activeElement !== urlInput) urlInput.value = tab.url;
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

// --- CONFIGURABLE HOME BUTTON ---
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

// === INITIALIZE APP ===
loadSession();
renderStartPage();