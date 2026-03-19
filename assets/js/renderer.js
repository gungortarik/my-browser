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

// --- APP STATE ---
const STORAGE_KEY = 'browser_session_data_v2'; // Bumped key to avoid conflict with old state

// Default Structure
const DEFAULT_WORKSPACES = {
  'ws_personal': { id: 'ws_personal', name: 'Personal', color: '#5e6ad2', tabs: [], activeTabId: null },
  'ws_work': { id: 'ws_work', name: 'Work', color: '#eb5757', tabs: [], activeTabId: null }
};

let workspaces = { ...DEFAULT_WORKSPACES };
let workspaceOrder = ['ws_personal', 'ws_work'];
let currentWorkspaceId = 'ws_personal';

let tabCount = 0;
let wsCount = 2; // For generating unique WS IDs
let contextMenuTargetTabId = null;

// Registry of <webview> DOM elements mapping tabId -> Element
const webviews = {};

// Lock Icons
const iconUnlock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const iconLock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

// --- PERSISTENCE MODULE ---
function saveSession() {
  const data = {
    workspaces,
    workspaceOrder,
    currentWorkspaceId,
    tabCount,
    wsCount
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSession() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Basic validation
      if (parsed.workspaces && Object.keys(parsed.workspaces).length > 0) {
        workspaces = parsed.workspaces;
        workspaceOrder = parsed.workspaceOrder || Object.keys(parsed.workspaces);
        currentWorkspaceId = parsed.currentWorkspaceId || workspaceOrder[0];
        tabCount = parsed.tabCount || 0;
        wsCount = parsed.wsCount || workspaceOrder.length;
      }
    } catch (e) {
      console.error('Failed to parse session data', e);
      // fallback to defaults already defined
    }
  }
}

// --- GLOBAL MENU HANDLERS ---
document.addEventListener('click', (e) => {
  if (!e.target.closest('#tabContextMenu')) {
    tabContextMenu.classList.remove('visible');
  }
  if (!e.target.closest('#workspaceBtn') && !e.target.closest('#workspaceMenu')) {
    // Only close if we didn't click inside an input or action in the menu
    if (e.target.tagName !== 'INPUT' && !e.target.closest('.ws-action-btn')) {
      workspaceMenu.classList.remove('visible');
    }
  }
});

// --- WORKSPACES DYNAMIC LOGIC ---
workspaceBtn.addEventListener('click', () => {
  renderWorkspaceMenu();
  const rect = workspaceBtn.getBoundingClientRect();
  workspaceMenu.style.top = `${rect.bottom + 8}px`;
  workspaceMenu.style.left = `${rect.left}px`;
  workspaceMenu.classList.toggle('visible');
});

function switchWorkspace(wsId) {
  if (wsId === currentWorkspaceId) return;
  if (!workspaces[wsId]) return;

  // IMPORTANT: Detach all current workspace webviews from DOM? 
  // No, just hiding them via CSS is enough since they are 1:1 tied to tabs globally.
  // Actually, wait, to reduce memory we COULD detach them, but hiding them is faster and preserves scroll state perfectly.
  // CSS `display: none` is already applied when `active` class is removed!

  currentWorkspaceId = wsId;
  const ws = workspaces[currentWorkspaceId];
  
  // Update Badge UI
  document.getElementById('workspaceLabel').textContent = ws.name;
  document.querySelector('#workspaceBtn .workspace-dot').style.background = ws.color;
  workspaceMenu.classList.remove('visible');
  
  renderWorkspaceTabs();
  showStatus(`Switched to ${ws.name}`);
  saveSession();
}

function deleteWorkspace(wsId) {
  if (workspaceOrder.length <= 1) return; // Cannot delete last workspace

  // If we are deleting the active workspace, switch to another first!
  if (wsId === currentWorkspaceId) {
    const nextWsId = workspaceOrder.find(id => id !== wsId);
    switchWorkspace(nextWsId);
  }

  // Remove webviews and tabs associated
  const ws = workspaces[wsId];
  ws.tabs.forEach(tab => {
    if (webviews[tab.id]) {
      webviews[tab.id].remove();
      delete webviews[tab.id];
    }
  });

  delete workspaces[wsId];
  workspaceOrder = workspaceOrder.filter(id => id !== wsId);
  
  saveSession();
  renderWorkspaceMenu(); // refresh dropdown
}

function renameWorkspace(wsId, newName) {
  if (!newName.trim()) return;
  workspaces[wsId].name = newName;
  saveSession();
  
  if (wsId === currentWorkspaceId) {
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
    id: newId,
    name: `Workspace ${wsCount}`,
    color: newColor,
    tabs: [],
    activeTabId: null
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
        <!-- Edit -->
        <button class="ws-action-btn edit-ws-btn" title="Rename" data-id="${id}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <!-- Trash (disabled if layout is 1) -->
        ${workspaceOrder.length > 1 ? `
        <button class="ws-action-btn delete-ws-btn" title="Delete" data-id="${id}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        ` : ''}
      </div>
    `;

    // Click on the overall item to switch
    item.addEventListener('click', (e) => {
      // Don't switch if they clicked an action
      if (e.target.closest('.ws-item-actions')) return;
      // Don't switch if editing
      if (item.querySelector('.ws-name-input')) return;
      switchWorkspace(id);
    });

    workspaceList.appendChild(item);

    // Edit Binding
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
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            renameWorkspace(id, input.value);
          }
        });
        input.addEventListener('blur', () => {
          renameWorkspace(id, input.value);
        });
      });
    }

    // Delete Binding
    const delBtn = item.querySelector('.delete-ws-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteWorkspace(id);
      });
    }
  });
}

// --- RENDER & INIT LOGIC ---
function renderWorkspaceTabs() {
  tabBar.innerHTML = '';
  
  // Hide all webviews initially
  Object.values(webviews).forEach(wv => wv.classList.remove('active'));

  const ws = workspaces[currentWorkspaceId];
  if (ws.tabs.length === 0) {
    createTab('https://duckduckgo.com');
  } else {
    ws.tabs.forEach(tab => {
      createTabDOMElement(tab);
      // If we are restoring from localStorage, the webview might not exist yet!
      if (!webviews[tab.id]) {
        createWebview(tab);
      }
    });
    
    // Set active
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
  saveSession();
});

closeTabAction.addEventListener('click', () => {
  if (contextMenuTargetTabId === null) return;
  const ws = workspaces[currentWorkspaceId];
  const tabData = ws.tabs.find(t => t.id === contextMenuTargetTabId);
  
  // Prevent if locked (the button is disabled in CSS, but check anyway)
  if (tabData && tabData.isLocked) return;

  closeTab(contextMenuTargetTabId);
  tabContextMenu.classList.remove('visible');
});

// --- BROWSER CORE LOGIC ---
function showStatus(text) {
  statusLabel.textContent = text
  statusLabel.classList.add('visible')
  setTimeout(() => {
    statusLabel.classList.remove('visible')
  }, 3000)
}

function formatInput(value) {
  let input = value.trim()
  const looksLikeUrl =
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('www.') ||
    input.startsWith('localhost:') ||
    (
      input.includes('.') &&
      !input.includes(' ') &&
      !input.includes('?') &&
      !input.includes('://')
    )

  if (looksLikeUrl) {
    if (!input.match(/^[a-zA-Z]+:\/\//)) {
      input = 'https://' + input
    }
    return input
  }
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(input)
}

function getActiveTab() {
  const ws = workspaces[currentWorkspaceId];
  return ws.tabs.find(tab => tab.id === ws.activeTabId);
}

function getActiveWebview() {
  const activeTab = getActiveTab();
  if (!activeTab) return null;
  return webviews[activeTab.id];
}

function setActiveTab(tabId) {
  const ws = workspaces[currentWorkspaceId];
  ws.activeTabId = tabId;
  
  // Tab UI State
  document.querySelectorAll('.tab').forEach(tabEl => {
    const isActive = Number(tabEl.dataset.id) === Number(tabId)
    tabEl.classList.toggle('active', isActive)
  });

  // Webview Visibility State
  Object.keys(webviews).forEach(wId => {
    if (Number(wId) === Number(tabId)) {
      webviews[wId].classList.add('active');
    } else {
      webviews[wId].classList.remove('active');
    }
  });

  const activeTab = getActiveTab();
  if (!activeTab) return;

  const wv = getActiveWebview();
  if (wv && wv.getURL) {
    urlInput.value = wv.getURL() || activeTab.url;
  } else {
    urlInput.value = activeTab.url;
  }
  
  saveSession();
}

function updateTabTitle(tabId, newTitle) {
  const ws = workspaces[currentWorkspaceId];
  const tab = ws.tabs.find(t => t.id === tabId)
  if (!tab) return
  
  tab.title = newTitle || 'New Tab'
  const tabEl = document.querySelector(`.tab[data-id="${tabId}"] .tab-title`)
  if (tabEl) {
    tabEl.textContent = tab.title
  }
  saveSession();
}

// Generates the <webview> element
function createWebview(tab) {
  const wv = document.createElement('webview');
  wv.className = 'browser-view';
  wv.dataset.tabId = tab.id;
  wv.src = tab.url;
  
  browserViewsContainer.appendChild(wv);
  webviews[tab.id] = wv;

  // Bind Webview Events
  wv.addEventListener('did-start-loading', () => {
    if (ws && workspaces[currentWorkspaceId].activeTabId === tab.id) showStatus('Loading...');
  });
  
  wv.addEventListener('did-stop-loading', () => {
    if (workspaces[currentWorkspaceId].activeTabId === tab.id) {
      showStatus('Ready');
      const url = wv.getURL();
      tab.url = url;
      if (document.activeElement !== urlInput) urlInput.value = url;
      saveSession();
    } else {
      tab.url = wv.getURL(); // track it silently
      saveSession();
    }
  });

  wv.addEventListener('page-title-updated', (event) => {
    updateTabTitle(tab.id, event.title);
  });

  wv.addEventListener('did-navigate', () => {
    tab.url = wv.getURL();
    if (workspaces[currentWorkspaceId].activeTabId === tab.id && document.activeElement !== urlInput) {
      urlInput.value = tab.url;
    }
    saveSession();
  });
  
  wv.addEventListener('did-navigate-in-page', () => {
    tab.url = wv.getURL();
    if (workspaces[currentWorkspaceId].activeTabId === tab.id && document.activeElement !== urlInput) {
      urlInput.value = tab.url;
    }
    saveSession();
  });
}

function createTabDOMElement(tab) {
  const tabEl = document.createElement('div')
  tabEl.className = 'tab'
  tabEl.dataset.id = tab.id
  
  if (tab.isLocked) tabEl.classList.add('locked');

  const lockIcon = tab.isLocked ? iconLock : iconUnlock;

  tabEl.innerHTML = `
    <span class="tab-title">${tab.title}</span>
    <span class="close-tab">${lockIcon}</span>
  `

  tabEl.addEventListener('click', () => {
    setActiveTab(tab.id)
  })

  // Right click handler for Context Menu
  tabEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenuTargetTabId = tab.id;
    
    // Manage text/disabled states
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

  const tab = {
    id,
    title: `New Tab`,
    url: initialUrl,
    isLocked: false
  }

  const ws = workspaces[currentWorkspaceId];
  ws.tabs.push(tab)

  createTabDOMElement(tab);
  createWebview(tab);
  setActiveTab(id)
  saveSession();
}

function closeTab(tabId) {
  const ws = workspaces[currentWorkspaceId];
  const tabData = ws.tabs.find(t => t.id === tabId);
  
  // PREVENT CLOSING IF LOCKED
  if (tabData && tabData.isLocked) return;

  const closingIndex = ws.tabs.findIndex(tab => tab.id === tabId)
  if (closingIndex === -1) return

  // Remove from state
  ws.tabs = ws.tabs.filter(tab => tab.id !== tabId)

  // Remove elements
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
      createTab(); // Prevent empty state
    }
  }
  saveSession();
}

function goToInput() {
  const finalUrl = formatInput(urlInput.value)
  const activeTab = getActiveTab()
  if (!activeTab) return

  activeTab.url = finalUrl;
  
  const wv = getActiveWebview();
  if (wv) wv.src = finalUrl;
  
  urlInput.value = finalUrl;
  saveSession();
}

// --- TOOLBAR BUTTON HANDLERS ---
newTabBtn.addEventListener('click', () => {
  createTab()
})

backBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.canGoBack && wv.canGoBack()) wv.goBack();
})

forwardBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.canGoForward && wv.canGoForward()) wv.goForward();
})

refreshBtn.addEventListener('click', () => {
  const wv = getActiveWebview();
  if (wv && wv.reload) wv.reload();
})

homeBtn.addEventListener('click', () => {
  const finalUrl = 'https://www.google.ca';
  const activeTab = getActiveTab();
  if (!activeTab) return;

  activeTab.url = finalUrl;
  const wv = getActiveWebview();
  if (wv) wv.src = finalUrl;
  
  urlInput.value = finalUrl;
  saveSession();
});

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    goToInput();
    const wv = getActiveWebview();
    if (wv) wv.focus(); // unfocus search bar layer
  }
})

urlInput.addEventListener('click', () => {
  urlInput.select();
})


// === INITIALIZE APP ===
loadSession();

// Bind initial UI to the loaded current workspace
const initialWs = workspaces[currentWorkspaceId];
if (initialWs) {
  document.getElementById('workspaceLabel').textContent = initialWs.name;
  document.querySelector('#workspaceBtn .workspace-dot').style.background = initialWs.color;
}

// Complete DOM load
renderWorkspaceTabs();