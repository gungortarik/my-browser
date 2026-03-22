const { ipcRenderer } = require('electron');

let currentDomain = window.location.hostname;

// Mühim: Sayfa yüklendiğinde var olan parolaları otomatik doldur
window.addEventListener('load', async () => {
  try {
    const credentials = await ipcRenderer.invoke('get-domain-passwords', currentDomain);

    if (credentials && credentials.length > 0) {
      const cred = credentials[0]; // Şimdilik ilk kullanıcıyı seç
      const passwordInputs = document.querySelectorAll('input[type="password"]');

      if (passwordInputs.length > 0) {
        // Otomatik şifreyi doldur
        passwordInputs[0].value = cred.password;

        // Kullanıcı adı alanını tahmin et ve doldur
        const textInputs = document.querySelectorAll('input[type="text"], input[type="email"]');
        if (textInputs.length > 0 && cred.username) {
          textInputs[0].value = cred.username;
        }

        // Form alanlarının etrafına küçük bir sarımsı çerçeve koyarak uyarıyı ver
        passwordInputs[0].style.backgroundColor = '#fdf5cd';
      }
    }
  } catch (err) {
    console.error('Autofill Error', err);
  }
});

// Sayfadaki form gönderimlerini (Login) avla ve yakala
document.addEventListener('submit', (e) => {
  const form = e.target;
  const passwordInputs = form.querySelectorAll('input[type="password"]');

  if (passwordInputs.length > 0) {
    const password = passwordInputs[0].value;

    // Klasik girişlerde şifre kutusundan bir önceki veya ilk <input> genellikle kullanıcı adıdır
    let username = '';
    const textInputs = form.querySelectorAll('input[type="text"], input[type="email"]');
    if (textInputs.length > 0) username = textInputs[0].value;

    if (password && username) {
      ipcRenderer.send('prompt-save-password', {
        domain: currentDomain,
        username,
        password
      });
    }
  }
});

// --- ADVANCED AUTOFILL (Profiles & Cards) ---
let autofillDataCache = null;

window.addEventListener('load', async () => {
  try {
    autofillDataCache = await ipcRenderer.invoke('get-autofill-data');
  } catch(e) {}
});

document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el || el.tagName !== 'INPUT') return;
  if (!autofillDataCache) return;
  
  const type = el.type ? el.type.toLowerCase() : '';
  if (type === 'password' || type === 'hidden' || type === 'submit' || type === 'button') return;
  
  const attr = (el.name + ' ' + el.id + ' ' + (el.getAttribute('autocomplete')||'')).toLowerCase();
  
  const isAddress = /[_-]?(address|city|zip|postal)[_-]?/.test(attr);
  const isEmailOrPhone = /[_-]?(email|phone|tel)[_-]?/.test(attr);
  const isCard = /[_-]?(card|cc-?number|cc-?exp|cvv)[_-]?/.test(attr);
  const isName = /[_-]?(name|fname|lname|fullname)[_-]?/.test(attr) && !isCard;

  if (isAddress || isEmailOrPhone || isName) {
    if (autofillDataCache.profiles && autofillDataCache.profiles.length > 0) {
      showAutofillDropdown(el, 'profile');
    }
  } else if (isCard) {
    if (autofillDataCache.cards && autofillDataCache.cards.length > 0) {
      showAutofillDropdown(el, 'card');
    }
  }
});

function showAutofillDropdown(inputEl, type) {
  let d = document.getElementById('pb-autofill-dropdown');
  if (d) d.remove();
  
  d = document.createElement('div');
  d.id = 'pb-autofill-dropdown';
  d.style.cssText = `
    position: absolute; z-index: 2147483647; background: #fff; border: 1px solid #ccc;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 6px; max-height: 200px;
    overflow-y: auto; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #333; min-width: 180px;
  `;
  
  const rect = inputEl.getBoundingClientRect();
  d.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  d.style.left = (rect.left + window.scrollX) + 'px';
  
  const list = type === 'profile' ? autofillDataCache.profiles : autofillDataCache.cards;
  
  list.forEach(itemData => {
    const item = document.createElement('div');
    item.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;';
    
    if (type === 'profile') {
      item.innerHTML = `<strong>${itemData.name || 'Profile'}</strong><br/><span style="color:#666;font-size:11px;">${itemData.address || itemData.email || ''}</span>`;
      item.onmousedown = (e) => { e.preventDefault(); fillProfile(itemData); d.remove(); };
    } else {
      const last4 = itemData.number ? itemData.number.slice(-4) : '****';
      item.innerHTML = `<strong>•••• ${last4}</strong><br/><span style="color:#666;font-size:11px;">${itemData.nameOnCard || ''}</span>`;
      item.onmousedown = (e) => { e.preventDefault(); fillCard(itemData); d.remove(); };
    }
    
    item.onmouseover = () => item.style.background = '#f0f4f8';
    item.onmouseout = () => item.style.background = 'transparent';
    d.appendChild(item);
  });
  
  document.body.appendChild(d);
  
  const onBlur = () => { setTimeout(() => { if (d) d.remove(); }, 150); inputEl.removeEventListener('blur', onBlur); };
  inputEl.addEventListener('blur', onBlur);
}

function fillProfile(p) {
  document.querySelectorAll('input').forEach(el => {
    const attr = (el.name + ' ' + el.id + ' ' + (el.getAttribute('autocomplete')||'')).toLowerCase();
    if (/email/.test(attr) && p.email) setVal(el, p.email);
    else if (/(name|fname|fullname)/.test(attr) && !/card/.test(attr) && p.name) setVal(el, p.name);
    else if (/(phone|tel)/.test(attr) && p.phone) setVal(el, p.phone);
    else if (/(address|line1)/.test(attr) && p.address) setVal(el, p.address);
    else if (/city/.test(attr) && p.city) setVal(el, p.city);
    else if (/(zip|postal)/.test(attr) && p.zip) setVal(el, p.zip);
  });
}

function fillCard(c) {
  document.querySelectorAll('input').forEach(el => {
    const attr = (el.name + ' ' + el.id + ' ' + (el.getAttribute('autocomplete')||'')).toLowerCase();
    if (/(nameoncard|cardname|ccname)/.test(attr) && c.nameOnCard) setVal(el, c.nameOnCard);
    else if (/(number|ccnum|cardnumber)/.test(attr) && c.number) setVal(el, c.number);
    else if (/(expmonth|ccmonth)/.test(attr) && c.expMonth) setVal(el, c.expMonth);
    else if (/(expyear|ccyear)/.test(attr) && c.expYear) setVal(el, c.expYear);
  });
}

function setVal(el, val) {
  el.value = val;
  el.style.backgroundColor = '#fdf5cd';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
