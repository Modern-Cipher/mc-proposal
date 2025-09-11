
/* Admin App – manages clients, configs, share link + QR */
window.Admin = (function () {
  let rootEl;
  // Hold the function to unsubscribe from the current real-time listener
  let currentListenerUnsubscribe = null;

  // === Remix Icon auto-discovery (fetch & cache) ===
  let __RI_CACHE = null;

  async function ensureRemixIconIndex() {
    if (__RI_CACHE) return __RI_CACHE;

    // Try to find the actual <link> used in the app
    let href = '';
    try {
      const link = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .find(l => /remixicon/i.test(l.href));
      href = link?.href || '';
    } catch (_) {}

    // Fallback CDN (works with CORS)
    if (!href) {
      href = 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css';
    }

    const css = await fetch(href, { mode: 'cors' }).then(r => r.text());
    const set = new Set();
    // get all class names like .ri-xxx:before
    css.replace(/\.ri-[a-z0-9-]+:before/gi, m => {
      set.add(m.slice(1, m.indexOf(':'))); // remove the dot and :before
    });
    __RI_CACHE = Array.from(set).sort();
    return __RI_CACHE;
  }

  function renderIconGrid(list, gridEl) {
    gridEl.innerHTML = list.map(v => `
      <button class="icon-item" type="button" data-val="${v}" title="${v}">
        <i class="${v}"></i>
      </button>
    `).join('');
  }

  // -------- helpers (with fallbacks so file is standalone) --------
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const currency = window.currency || (n => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const fmtDate = (v)=>{ if (!v) return ''; try{ if (typeof v === 'number') return new Date(v).toLocaleString(); if (v.toDate) return v.toDate().toLocaleString(); const d = new Date(v); return isNaN(d) ? '-' : d.toLocaleString(); }catch(_){ return '-'; } };
  const bc = new BroadcastChannel('mc-proposals');
  const qrImg = (url,size=180)=>`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  // Curated list for the icon picker (Remix Icons)
  const REMIX_ICONS = [
    { n: "Rocket", v: "ri-rocket-line" }, { n: "Shield Star", v: "ri-shield-star-line" },
    { n: "Sparkling", v: "ri-sparkling-2-line" }, { n: "Trophy", v: "ri-trophy-line" },
    { n: "Award", v: "ri-award-line" }, { n: "Medal", v: "ri-medal-line" },
    { n: "Thumb Up", v: "ri-thumb-up-line" }, { n: "Service", v: "ri-service-line" },
    { n: "User Star", v: "ri-user-star-line" }, { n: "Group", v: "ri-group-line" },
    { n: "Shake Hands", v: "ri-shake-hands-line" }, { n: "Tools", v: "ri-tools-line" },
    { n: "Settings", v: "ri-settings-3-line" }, { n: "Timer", v: "ri-timer-line" },
    { n: "Calendar", v: "ri-calendar-2-line" }, { n: "Flashlight", v: "ri-flashlight-line" },
    { n: "Lightbulb", v: "ri-lightbulb-flash-line" }, { n: "Bar Chart", v: "ri-bar-chart-box-line" },
    { n: "Line Chart", v: "ri-line-chart-line" }, { n: "Pie Chart", v: "ri-pie-chart-line" },
    { n: "Donut Chart", v: "ri-donut-chart-line" }, { n: "Plant", v: "ri-plant-line" },
    { n: "Leaf", v: "ri-leaf-line" }, { n: "Map Pin", v: "ri-map-pin-line" }
  ];

  // Inject minimal styles (includes icon picker behavior + PORTAL)
  function injectToggleStyles() {
    if (document.getElementById("pkg-toggle-styles")) return;
    const s = document.createElement("style");
    s.id = "pkg-toggle-styles";
    s.textContent = `
      .pkg-visibility { display:flex; justify-content:space-between; align-items:center; background:#f0f2f5; padding:6px 10px; border-radius:6px; margin-top:10px; }
      .switch { position:relative; display:inline-block; width:40px; height:22px; }
      .switch input { opacity:0; width:0; height:0; }
      .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.4s; }
      .slider:before { position:absolute; content:""; height:16px; width:16px; left:3px; bottom:3px; background-color:#fff; transition:.4s; }
      input:checked + .slider { background-color:#0d6efd; }
      input:checked + .slider:before { transform:translateX(18px); }
      .slider.round { border-radius:22px; }
      .slider.round:before { border-radius:50%; }

      /* Quill + icon picker styling (non-invasive) */
      .quill-editor, .quill-editor-faq { border:1px solid #e5e7eb; border-radius:6px; }
      .quill-editor .ql-toolbar, .quill-editor-faq .ql-toolbar { background:#f8f9fa; border-top-left-radius:6px; border-top-right-radius:6px; }
      .quill-editor .ql-container, .quill-editor-faq .ql-container { border-bottom-left-radius:6px; border-bottom-right-radius:6px; min-height:100px; }

      /* ICON PICKER — closed by default (when inside its cell) */
      .icon-picker { position:relative; }
      .icon-picker .icon-menu {
        display:none; position:absolute; z-index:50; top:36px; left:0; right:0;
        background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.08);
        padding:8px; grid-template-columns:repeat(8, minmax(0,1fr)); gap:8px; max-height:320px; overflow:auto;
      }
      .icon-picker.open .icon-menu { display:grid; }

      .icon-item { display:flex; align-items:center; justify-content:center; padding:10px; border-radius:10px; cursor:pointer; border:1px solid transparent; font-size:0; }
      .icon-item i { font-size:22px; width:22px; height:22px; }
      .icon-item:hover { background:#f8fafc; border-color:#e5e7eb; }

      .icon-preview { display:inline-flex; width:28px; height:28px; align-items:center; justify-content:center; border-radius:8px; background:#f3f4f6; }
      .icon-display { display:inline-flex; align-items:center; gap:6px; }
      .pick-icon-btn { margin-left:6px; }

      /* === PORTAL (picker lives here when opened to escape clipping) === */
      .mc-icon-portal{
        position:fixed; z-index:2147483647; display:none; left:0; top:0;
      }
      .mc-icon-portal .icon-menu{
        display:block !important; position:static !important;
        max-height:360px; overflow:auto; border-radius:12px;
        box-shadow:0 16px 40px rgba(0,0,0,.12);
        background:#fff; border:1px solid #e5e7eb; padding:0;
      }
      .mc-icon-portal .icon-menu .icon-search{
        position:sticky; top:0; background:#fff; padding:8px; border-bottom:1px solid #e5e7eb; z-index:1;
      }
      .mc-icon-portal .icon-menu .icon-grid{
        display:grid; grid-template-columns:repeat(8,1fr); gap:10px; padding:10px;
      }
      @media (max-width:1200px){ .mc-icon-portal .icon-menu .icon-grid{ grid-template-columns:repeat(6,1fr); } }
      @media (max-width:900px){  .mc-icon-portal .icon-menu .icon-grid{ grid-template-columns:repeat(5,1fr); } }
      @media (max-width:640px){  .mc-icon-portal .icon-menu .icon-grid{ grid-template-columns:repeat(4,1fr); } }
    `;
    document.head.appendChild(s);
  }

  function render(root, page = 'analytics'){ rootEl = root; if(!Store.isAuthed()) return renderLogin(); return renderShell(page); }

  function renderLogin(){
    rootEl.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-hero">
            <div class="brand" style="margin-bottom:10px">
              <div class="logo"><img src="app/assets/img/mc.png" alt=""></div>
              <div class="name">Modern Cipher</div>
            </div>
            <h2>Sign in to Admin</h2>
            <p>Protected dashboard for proposals and clients.</p>
          </div>
          <div class="auth-form">
            <div class="form-row"><label class="small">Email</label><input id="lgEmail" class="input" type="email"></div>
            <div class="form-row"><label class="small">Password</label><input id="lgPass" class="input" type="password"></div>
            <button class="btn" id="loginBtn"><i class="ri-login-box-line"></i> Sign in</button>
          </div>
        </div>
      </div>`;
    $('#loginBtn').onclick = async ()=>{
      try{ await Store.login($('#lgEmail').value.trim(), $('#lgPass').value); renderShell('analytics'); }
      catch(e){ alert(e?.message || 'Sign-in failed.'); }
    };
  }

  function renderShell(page){
    rootEl.innerHTML = `<div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand"><div class="logo"><img src="app/assets/img/mc.png" alt=""></div><strong>Modern Cipher</strong></div>
        <nav class="admin-nav" id="adminNav">
          <a href="#/admin/analytics" data-page="analytics" class="admin-link"><i class="ri-dashboard-line"></i> Analytics</a>
          <a href="#/admin/clients" data-page="clients" class="admin-link"><i class="ri-user-3-line"></i> Clients Proposal</a>
          <a href="#/admin/approved" data-page="approved" class="admin-link"><i class="ri-checkbox-circle-line"></i> Approved</a>
          <a href="#/admin/settings" data-page="settings" class="admin-link"><i class="ri-settings-3-line"></i> Settings</a>

          <div class="small muted" style="padding:16px 12px 6px;">External Tools</div>
          <a href="https://modern-cipher.github.io/mc-timeline-hubs/admin.html" target="_blank" rel="noopener noreferrer" class="admin-link"><i class="ri-time-line"></i> Timeline Hub</a>
          <a href="https://modern-cipher.github.io/mc-invoice/assets/views/admin" target="_blank" rel="noopener noreferrer" class="admin-link"><i class="ri-bill-line"></i> Invoices</a>
          <a href="https://modern-cipher.github.io/mc-licenseguard/#/login" target="_blank" rel="noopener noreferrer" class="admin-link"><i class="ri-key-2-line"></i> License Guard</a>
        </nav>
      </aside>

      <section class="admin-main">
        <header class="admin-topbar">
          <div class="search"><i class="ri-search-line"></i><input id="topSearch" class="input" style="border:none;box-shadow:none;padding:0" placeholder="Search..."></div>
          <div style="display:flex;gap:8px;align:items-center">
            <button class="icon-btn" id="logoutBtn" title="Logout"><i class="ri-logout-box-r-line"></i></button>
          </div>
        </header>
        <main class="admin-content" id="adminContent"></main>
        <footer class="admin-footer">© ${new Date().getFullYear()} Modern Cipher. All rights reserved.</footer>
      </section>

      <nav class="admin-mobile-bar" id="adminMobile">
        <a href="#/admin/analytics" class="navbtn" data-page="analytics"><i class="ri-dashboard-line"></i><span class="small">Analytics</span></a>
        <a href="#/admin/clients" class="navbtn" data-page="clients"><i class="ri-user-3-line"></i><span class="small">Clients</span></a>
        <a href="#/admin/approved" class="navbtn" data-page="approved"><i class="ri-checkbox-circle-line"></i><span class="small">Approved</span></a>
        <a href="#/admin/settings" class="navbtn" data-page="settings"><i class="ri-settings-3-line"></i><span class="small">Settings</span></a>
        <button type="button" class="navbtn" id="mobileToolsBtn" title="External Links"><i class="ri-apps-2-line"></i><span class="small">Links</span></button>
      </nav>
    </div>`;
    $('#logoutBtn').onclick = async ()=>{ if (currentListenerUnsubscribe) currentListenerUnsubscribe(); try{ await Store.logout(); }catch(_){ } renderLogin(); };
    injectToggleStyles();

    // ---- Mobile bottom drawer (external links) ----
    if (!document.getElementById('mcMobileDrawer')) {
      const d = document.createElement('div');
      d.id = 'mcMobileDrawer';
      d.className = 'drawer-overlay';
      d.innerHTML = `
        <div class="drawer-panel" role="dialog" aria-label="External Links">
          <div class="drawer-handle"></div>
          <div class="drawer-header">
            <strong>External Links</strong>
            <button class="icon-btn drawer-close" title="Close"><i class="ri-close-line"></i></button>
          </div>
          <div class="drawer-links">
            <a class="drawer-link" target="_blank" rel="noopener" href="https://modern-cipher.github.io/mc-timeline-hubs/admin.html"><i class="ri-time-line"></i><span>Timeline Hub</span></a>
            <a class="drawer-link" target="_blank" rel="noopener" href="https://modern-cipher.github.io/mc-invoice/assets/views/admin"><i class="ri-bill-line"></i><span>Invoices</span></a>
            <a class="drawer-link" target="_blank" rel="noopener" href="https://modern-cipher.github.io/mc-licenseguard/#/login"><i class="ri-key-2-line"></i><span>License Guard</span></a>
          </div>
        </div>`;
      document.body.appendChild(d);

      const overlay = d;
      const panel   = d.querySelector('.drawer-panel');
      const open   = () => { overlay.classList.add('show'); panel.classList.add('open'); };
      const close  = () => { panel.classList.remove('open'); setTimeout(()=>overlay.classList.remove('show'), 160); };

      $('#mobileToolsBtn')?.addEventListener('click', open);
      d.addEventListener('click', (e)=>{ if (e.target === overlay || e.target.closest('.drawer-close')) close(); });
      // Esc key
      document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && overlay.classList.contains('show')) close(); });
    }

    // Dynamic search
    const topSearch = $('#topSearch');
    if (topSearch) {
      topSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const activePage = $('.admin-link.active')?.dataset.page || $('.navbtn.active')?.dataset.page;
        if (activePage === 'clients') {
          const rows = $$('#clientsRows tr');
          rows.forEach(row => { row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? '' : 'none'; });
        } else if (activePage === 'approved') {
          const cards = $$('.approved-row');
          cards.forEach(card => { card.style.display = card.textContent.toLowerCase().includes(searchTerm) ? '' : 'none'; });
        }
      });
    }

    const navClick = e => {
      const a = e.target.closest('[data-page]');
      if (!a) return;
      e.preventDefault();
      const newHash = a.getAttribute('href');
      if (location.hash !== newHash) location.hash = newHash;
    };
    $('#adminNav').addEventListener('click', navClick);
    $('#adminMobile').addEventListener('click', navClick);

    renderPage(page);
    setActive(page);
  }

  function setActive(page){ $$('.admin-link, .navbtn').forEach(a=>a.classList.toggle('active', a.dataset.page===page)); }

  async function renderPage(page){
    // Unsubscribe from any previous real-time listener before rendering a new page
    if (currentListenerUnsubscribe) { currentListenerUnsubscribe(); currentListenerUnsubscribe = null; }

    let el = $('#adminContent');
    const newEl = el.cloneNode(false);
    el.parentNode.replaceChild(newEl, el);
    el = newEl;

    el.innerHTML = `<div class="kpi" style="text-align:center;">Loading...</div>`;
    if(page==='analytics') return renderAnalytics(el);
    if(page==='clients') return renderClients(el);
    if(page==='approved') return renderApproved(el);
    if(page==='settings') return renderSettings(el);
  }

  async function renderAnalytics(el){
    currentListenerUnsubscribe = Store.onClientsUpdate(list => {
      const totalProposals = list.length;
      let approvedPackagesCount = 0;
      let totalRevenue = 0;

      list.forEach(c => {
        if (c.selections && typeof c.selections === 'object') {
          const selections = Object.values(c.selections);
          approvedPackagesCount += selections.length;
          selections.forEach(sel => { totalRevenue += sel.amount || 0; });
        }
      });

      const pendingProposals = list.filter(c => !c.selections || Object.keys(c.selections).length === 0).length;

      el.innerHTML = `<h2 style="margin:0 0 8px">Analytics</h2><div class="kpis">
        <div class="kpi"><div class="k">Total Proposals</div><div class="v">${totalProposals}</div></div>
        <div class="kpi"><div class="k">Approved Packages</div><div class="v">${approvedPackagesCount}</div></div>
        <div class="kpi"><div class="k">Pending Proposals</div><div class="v">${pendingProposals}</div></div>
        <div class="kpi"><div class="k">Total Revenue</div><div class="v">${currency(totalRevenue)}</div></div>
      </div>`;
    });
  }

  async function renderClients(el){
    const newEl = el.cloneNode(false);
    el.parentNode.replaceChild(newEl, el);
    el = newEl;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <h2 style="margin:0">Clients Proposals</h2>
        <button class="btn" id="addBtn"><i class="ri-add-line"></i> Add Client</button>
      </div>
      <div class="table-responsive" style="margin-top:12px"><div class="kpi">Loading clients...</div></div>`;

    currentListenerUnsubscribe = Store.onClientsUpdate(list => {
      const rows = list.map(c=>{
        const selections = c.selections ? Object.keys(c.selections) : [];
        const statusHtml = selections.length > 0
          ? selections.map(name => `<span class="chip success small">${name}</span>`).join(' ')
          : '<span class="chip small">Pending</span>';

        return `<tr data-id="${c.id}">
          <td><strong>${c.name || "-"}</strong><div class="small muted">${c.company || ""}</div></td>
          <td>${c.email || ""}</td>
          <td>${fmtDate(c.updatedAt) || '-'}</td>
          <td>${statusHtml}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" data-act="view" title="View"><i class="ri-external-link-line"></i></button>
              <button class="icon-btn" data-act="copy" title="Copy Link"><i class="ri-clipboard-line"></i></button>
              <button class="icon-btn" data-act="dup" title="Duplicate"><i class="ri-file-copy-line"></i></button>
              <button class="icon-btn" data-act="edit" title="Edit"><i class="ri-edit-2-line"></i></button>
              <button class="icon-btn" data-act="del" title="Delete" style="color:#b91c1c"><i class="ri-delete-bin-6-line"></i></button>
            </div>
          </td>
        </tr>`;
      }).join('');

      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <h2 style="margin:0">Clients Proposals</h2>
          <button class="btn" id="addBtn"><i class="ri-add-line"></i> Add Client</button>
        </div>
        <div class="table-responsive" style="margin-top:12px">
          <table class="table">
            <thead><tr><th>Client</th><th>Email</th><th>Updated</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="clientsRows">${rows || `<tr><td colspan="5" style="text-align:center;padding:24px;">No clients yet.</td></tr>`}</tbody>
          </table>
        </div>`;
    });

    el.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('#addBtn');
      if (addBtn) return openClientForm();

      const actionBtn = e.target.closest('#clientsRows [data-act]');
      if (!actionBtn) return;

      const row = actionBtn.closest('tr');
      if (!row || !row.dataset.id) return;

      const id = row.dataset.id;
      const act = actionBtn.dataset.act;
      const c = await Store.getClient(id);
      if (!c) return;

      const getLink = async () => {
        if(c.configId) return Store.linkFor(c.configId);
        const newId = await Store.saveConfig(c.config || Store.defaults());
        await Store.updateClient(id, {configId: newId});
        return Store.linkFor(newId);
      };

      if(act==='view') window.open(await getLink(), '_blank');
      if(act==='copy') navigator.clipboard?.writeText(await getLink()).then(()=>Swal.fire({toast:true,position:'top-end',text:'Link copied!',timer:1500,showConfirmButton:false}));
      if(act==='edit') openClientForm(c);

      if(act==='del'){
        const res = await Swal.fire({title:'Delete Client?',text:`This will permanently delete ${c.name} AND their proposal. This cannot be undone.`,icon:'warning',showCancelButton:true,confirmButtonColor:'#d33',confirmButtonText:'Yes, delete it!'});
        if(res.isConfirmed){ await Store.deleteClient(c.id, c.configId); }
      }

      if(act === 'dup') {
        const res = await Swal.fire({ title: 'Duplicate Proposal?', text: `This will create a new copy for "${c.name}".`, icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, duplicate it!' });
        if (res.isConfirmed) {
          const newData = JSON.parse(JSON.stringify(c));
          newData.name = `${c.name} (Copy)`;
          delete newData.id;
          delete newData.selections;
          const newConfigId = await Store.saveConfig(newData.config);
          newData.configId = newConfigId;
          await Store.addClient(newData);
          await Swal.fire('Duplicated!', 'New proposal created.', 'success');
        }
      }
    });
  }

  async function renderApproved(el){
    const newEl = el.cloneNode(false);
    el.parentNode.replaceChild(newEl, el);
    el = newEl;
    el.innerHTML = `<h2 style="margin:0 0 8px">Approved Packages</h2><div class="kpi">Loading...</div>`;

    currentListenerUnsubscribe = Store.onClientsUpdate(allClients => {
      const approvedItems = [];
      allClients.forEach(client => {
        if (client.selections && typeof client.selections === 'object' && Object.keys(client.selections).length > 0) {
          Object.entries(client.selections).forEach(([pkgName, details]) => {
            approvedItems.push({
              ...client,
              selectedPackage: pkgName,
              amount: details.amount,
              updatedAt: details.selectedAt || client.updatedAt,
              approvedId: `${client.id}-${pkgName.replace(/\s+/g, '')}`
            });
          });
        }
      });

      const rows = approvedItems.map(c=>{
        const link = c.configId ? Store.linkFor(c.configId) : '#';
        return `
          <div class="kpi approved-row" data-id="${c.id}" data-pkg-name="${c.selectedPackage}" id="approved-${c.approvedId}">
            <div>
              <div class="k"><i class="ri-award-line"></i> ${c.company || c.name}</div>
              <div class="v" style="font-size:1.05rem">${c.name}</div>
              <div class="small muted">${fmtDate(c.updatedAt) || '-'}</div>
              <div class="small"><strong>${c.selectedPackage}</strong> — ${currency(c.amount)}</div>
            </div>
            <div class="approved-actions">
              ${c.configId ? `<img src="${qrImg(link, 90)}" alt="QR" width="90" height="90">` : ""}
              <div class="approved-buttons">
                <button class="icon-btn" data-act="view" title="View Proposal"><i class="ri-external-link-line"></i></button>
                <button class="icon-btn" data-act="copy" title="Copy URL"><i class="ri-clipboard-line"></i></button>
                <button class="icon-btn" data-act="print" title="Print / Export"><i class="ri-printer-line"></i></button>
                <button class="icon-btn" data-act="roi" title="ROI Calculator"><i class="ri-line-chart-line"></i></button>
                <button class="icon-btn" data-act="cancel" title="Cancel Approval"><i class="ri-close-circle-line"></i></button>
              </div>
            </div>
          </div>`;
      }).join('') || '<div class="small">No approved packages yet.</div>';

      el.innerHTML = `<h2 style="margin:0 0 8px">Approved Packages</h2><div style="display:grid; gap:10px">${rows}</div>`;

      const params = new URLSearchParams(location.hash.split('?')[1]);
      const highlightId = params.get('highlight');
      if (highlightId) {
        setTimeout(() => {
          const targetEl = $(`#approved-${highlightId}`, el);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.add('highlight');
            setTimeout(() => targetEl.classList.remove('highlight'), 2500);
          }
        }, 200);
      }
    });

    el.addEventListener('click', async (e)=>{
      const btn = e.target.closest('[data-act]'); if(!btn) return;
      const row = btn.closest('.approved-row'); if(!row) return;
      const id = row.dataset.id;
      const pkgName = row.dataset.pkgName;
      const act = btn.dataset.act;

      const c = await Store.getClient(id); if(!c) return;

      if (act === 'view' && c.configId) window.open(Store.linkFor(c.configId), '_blank');
      if (act === 'copy' && c.configId) navigator.clipboard?.writeText(Store.linkFor(c.configId)).then(()=>Swal.fire({toast:true,position:'top-end',text:'Link copied!',timer:1200,showConfirmButton:false}));

      if (act === 'print' || act === 'roi') {
        if (!c.configId) return Swal.fire('Error', 'Config ID not found.', 'error');
        const cfg = await Store.getConfig(c.configId);
        if (!cfg) return Swal.fire('Error', 'Could not load proposal configuration.', 'error');
        const pkg = cfg.packages.find(p => p.name === pkgName);
        if (!pkg) return Swal.fire('Error', `Package "${pkgName}" not found in proposal.`, 'error');

        if (act === 'print') window.DetailsModal.openPrintForm(pkg, cfg, c.configId);
        else if (act === 'roi') window.ROICalculator.open(pkg);
      }

      if (act === 'cancel') {
        const res = await Swal.fire({title:'Cancel Approval?', text:`This will remove the "${pkgName}" selection for ${c.name}.`, icon:'warning',showCancelButton:true, confirmButtonText:'Yes, cancel it'});
        if (res.isConfirmed) {
          const newSelections = { ...c.selections };
          delete newSelections[pkgName];
          await Store.updateClient(id, { selections: newSelections });
          await Swal.fire({toast:true,position:'top-end',text:'Approval canceled.',timer:1200,showConfirmButton:false});
        }
      }
    });
  }

  async function renderSettings(el) {
    currentListenerUnsubscribe = Store.onSettingsUpdate(s => {
      const f = s.footer || Store.defaults().settings.footer;
      const p = s.pages || Store.defaults().settings.pages;
      const socials = f.socials || {};
      const wasFocusedId = document.activeElement?.id;

      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <h2 style="margin:0">Settings</h2>
          <button class="btn" id="saveSettingsBtn"><i class="ri-save-3-line"></i> Save All Settings</button>
        </div>
        <div id="settingsForm" style="margin-top:12px; display:grid; gap:12px;">
          <div class="kpi">
            <div class="k">Footer Content</div>
            <div class="form-grid" style="margin-top:8px;">
              <div><label class="small">Company Name</label><input id="f_name" class="input" value="${f.companyName || ''}"></div>
              <div><label class="small">Phone Number</label><input id="f_phone" class="input" value="${f.phone || ''}"></div>
              <div class="full-width"><label class="small">Description</label><textarea id="f_desc" class="input" rows="3">${f.description || ''}</textarea></div>
              <div class="full-width"><label class="small">Address</label><input id="f_addr" class="input" value="${f.address || ''}"></div>
              <div class="full-width"><label class="small">Email</label><input id="f_email" class="input" type="email" value="${f.email || ''}"></div>
            </div>
          </div>
          <div class="kpi">
            <div class="k">Social Media Links</div>
            <div class="form-grid" style="margin-top:8px;">
              <div><label class="small">Facebook URL</label><input id="s_fb" class="input" value="${socials.facebook || ''}"></div>
              <div><label class="small">Viber Link</label><input id="s_viber" class="input" value="${socials.viber || ''}"></div>
              <div><label class="small">Telegram Link</label><input id="s_tele" class="input" value="${socials.telegram || ''}"></div>
              <div><label class="small">TikTok URL</label><input id="s_tiktok" class="input" value="${socials.tiktok || ''}"></div>
              <div><label class="small">Website URL</label><input id="s_web" class="input" value="${socials.website || ''}"></div>
            </div>
          </div>
          <div class="content-editors-grid">
            <div class="kpi">
              <div class="k">Terms of Service Page</div>
              <div id="tos-editor" class="quill-editor"></div>
            </div>
            <div class="kpi">
              <div class="k">Privacy Policy Page</div>
              <div id="privacy-editor" class="quill-editor"></div>
            </div>
          </div>
        </div>
      `;

      const quillOptions = { theme: 'snow', modules: { toolbar: [ ['bold', 'italic', 'underline'], ['link'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['clean'] ] } };
      let tosEditor, privacyEditor;
      if (window.Quill) {
        tosEditor = new Quill('#tos-editor', quillOptions);
        privacyEditor = new Quill('#privacy-editor', quillOptions);
        if(p && p.tos) tosEditor.root.innerHTML = p.tos.content;
        if(p && p.privacy) privacyEditor.root.innerHTML = p.privacy.content;
      } else {
        $('#tos-editor').innerHTML = `<textarea class="input" rows="6">${p?.tos?.content || ''}</textarea>`;
        $('#privacy-editor').innerHTML = `<textarea class="input" rows="6">${p?.privacy?.content || ''}</textarea>`;
      }

      if(wasFocusedId) $(`#${wasFocusedId}`)?.focus();

      $('#saveSettingsBtn').onclick = async () => {
        const pages = window.Quill
          ? {
              tos: { content: tosEditor.root.innerHTML, updatedAt: new Date().toISOString() },
              privacy: { content: privacyEditor.root.innerHTML, updatedAt: new Date().toISOString() }
            }
          : {
              tos: { content: $('#tos-editor textarea').value, updatedAt: new Date().toISOString() },
              privacy: { content: $('#privacy-editor textarea').value, updatedAt: new Date().toISOString() }
            };

        const newSettings = {
          footer: {
            companyName: $('#f_name').value.trim(), description: $('#f_desc').value.trim(), address: $('#f_addr').value.trim(),
            phone: $('#f_phone').value.trim(), email: $('#f_email').value.trim(),
            socials: { facebook: $('#s_fb').value.trim(), viber: $('#s_viber').value.trim(), telegram: $('#s_tele').value.trim(), tiktok: $('#s_tiktok').value.trim(), website: $('#s_web').value.trim() }
          },
          pages
        };
        try {
          await Store.saveSettings(newSettings);
          Swal.fire({title: 'Saved!', text: 'Settings have been updated.', icon: 'success', timer: 1500, showConfirmButton: false});
        } catch (e) {
          Swal.fire('Error', 'Could not save settings.', 'error'); console.error(e);
        }
      };
    });
  }

  function openClientForm(data){
    const isEdit = !!data;
    const c = data || { name:'', company:'', email:'', phone:'', config: Store.defaults(), configId:'' };
    const cfg = JSON.parse(JSON.stringify(c.config || Store.defaults()));

    cfg.proposal = cfg.proposal || {}; cfg.faq = cfg.faq || [];
    if (!cfg.featuresMatrix) {
      cfg.featuresMatrix = (cfg.compare || []).map(row => ({
        name: row[0],
        includedIn: cfg.packages.map(p => p.key).filter((_, i) => row[i + 1] === '✔')
      }));
    }
    cfg.highlightFeatures = cfg.highlightFeatures || [
      { icon: 'ri-rocket-line', title: 'Fast Delivery', description: 'Priority project timeline.', includedIn: [] },
      { icon: 'ri-shield-star-line', title: '1 Year Warranty', description: 'Bug fixes and support.', includedIn: [] },
    ];

    const ov = document.createElement('div'); ov.className='modal-overlay';
    ov.innerHTML = `<div class="modal-box">
      <div class="modal-head"><strong>${isEdit ? 'Edit Client Proposal' : 'Add New Client'}</strong><button class="icon-btn" id="closeModal"><i class="ri-close-line"></i></button></div>
      <div class="modal-body">
        <div class="kpi">
          <div class="k"><i class="ri-user-line"></i> Client Details</div>
          <div class="pkg-row" style="margin-top:8px;">
            <div><label class="small">Name</label><input id="fName" class="input" value="${c.name || ''}"></div>
            <div><label class="small">Company</label><input id="fCompany" class="input" value="${c.company||''}"></div>
            <div><label class="small">Email</label><input id="fEmail" class="input" type="email" value="${c.email||''}"></div>
            <div><label class="small">Phone</label><input id="fPhone" class="input" type="tel" value="${c.phone||''}"></div>
          </div>
        </div>

        <div class="kpi" style="margin-top:12px">
          <div class="k"><i class="ri-file-text-line"></i> Proposal Details</div>
          <div class="form-grid-3" style="margin-top:8px;">
            <div><label class="small">Proposal Title</label><input id="confTitle" class="input" value="${cfg.proposal.title || ''}"></div>
            <div><label class="small">Subtitle / Caption</label><input id="confSub" class="input" value="${cfg.proposal.subtitle || ''}"></div>
            <div><label class="small">Downpayment (%)</label><input id="confDp" class="input" type="number" value="${cfg.proposal.downpaymentPercent || 50}"></div>
            <div class="full-width"><label class="small">Notes</label><input id="confNote" class="input" value="${cfg.proposal.note || ''}"></div>
          </div>
        </div>

        <div class="kpi" style="margin-top:12px">
          <div class="k"><i class="ri-stack-line"></i> Packages</div>
          <div id="packagesEditor" class="packages-grid" style="margin-top:8px;"></div>
        </div>

        <div class="kpi" style="margin-top:12px">
          <div class="k"><i class="ri-list-check-2"></i> Master Feature List</div>
          <div id="featuresMatrix" class="matrix-wrap" style="margin-top:8px;"></div>
          <button class="btn ghost" id="addFeature" style="margin-top:10px;"><i class="ri-add-line"></i> Add Feature</button>
        </div>

        <div class="kpi" style="margin-top:12px">
          <div class="k"><i class="ri-star-line"></i> Highlight Features</div>
          <div id="highlightsMatrix" class="matrix-wrap" style="margin-top:8px;"></div>
          <button class="btn ghost" id="addHighlight" style="margin-top:10px;"><i class="ri-add-line"></i> Add Highlight</button>
        </div>

        <div class="kpi" style="margin-top:12px">
          <div class="k"><i class="ri-question-answer-line"></i> FAQs</div>
          <div id="faqEditor" style="margin-top:8px;">
            <div id="faqRows"></div>
            <button class="btn ghost" id="faqAdd" style="margin-top:10px;"><i class="ri-add-line"></i> Add FAQ</button>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        ${isEdit && c.configId ? `<button class="btn" id="genLink"><i class="ri-link-m"></i> View/Share</button>` : ''}
        <span style="flex:1 1 auto"></span>
        <button class="btn" id="saveClient"><i class="ri-save-3-line"></i> ${isEdit ? 'Save Changes' : 'Create & Save'}</button>
      </div>
    </div>`;
    document.body.appendChild(ov);

    const box = ov.querySelector('.modal-box');
    const packagesEditor = $('#packagesEditor', box);
    const featuresMatrixEl = $('#featuresMatrix', box);
    const highlightsMatrixEl = $('#highlightsMatrix', box);
    const faqRows = $('#faqRows', box);

    // --- ICON PICKER PORTAL (escapes clipping/overflow) ---
    const iconPortal = document.createElement('div');
    iconPortal.className = 'mc-icon-portal';
    document.body.appendChild(iconPortal);
    let activePicker = null, activeMenu = null;

    function positionIconPortal() {
      if (!activePicker) return;
      const trigger = activePicker.querySelector('.icon-display') || activePicker;
      const r  = trigger.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;

      const margin = 12;
      const maxWidth = Math.min(520, vw - margin * 2);
      let width = Math.max(280, Math.min(maxWidth, vw - r.left - margin));
      iconPortal.style.width = width + 'px';

      let left = Math.min(r.left, vw - width - margin);
      left = Math.max(margin, left);
      iconPortal.style.left = left + 'px';

      let top = r.bottom + 6;
      iconPortal.style.top = top + 'px';

      requestAnimationFrame(() => {
        const h = iconPortal.firstElementChild?.offsetHeight || 0;
        if (top + h > vh - margin) {
          top = Math.max(margin, r.top - h - 6);
          iconPortal.style.top = top + 'px';
        }
      });
    }

    function openIconPicker(picker) {
      if (activePicker === picker) { closeIconPicker(); return; }
      closeIconPicker();

      activePicker = picker;
      const menu = picker.querySelector('.icon-menu');
      if (!menu) return;

      activeMenu = menu;
      iconPortal.innerHTML = '';
      iconPortal.appendChild(menu);
      iconPortal.style.display = 'block';
      picker.classList.add('open');
      positionIconPortal();

      window.addEventListener('resize', positionIconPortal);
      document.addEventListener('scroll', positionIconPortal, true);
    }
    function closeIconPicker() {
      if (!activePicker) return;
      if (activeMenu && !activePicker.contains(activeMenu)) {
        activePicker.appendChild(activeMenu);
      }
      activePicker.classList.remove('open');
      iconPortal.style.display = 'none';
      iconPortal.innerHTML = '';
      window.removeEventListener('resize', positionIconPortal);
      document.removeEventListener('scroll', positionIconPortal, true);
      activePicker = null; activeMenu = null;
    }

    // close when clicking outside
    const outsideHandler = (e) => {
      if (!activePicker) return;
      if (!iconPortal.contains(e.target) && !activePicker.contains(e.target)) {
        closeIconPicker();
      }
    };
    document.addEventListener('mousedown', outsideHandler);

    // will hold Quill instances for FAQ answers
    let faqEditors = {};

    function syncDOMToData() {
      $$('#featuresMatrix tbody tr', box).forEach((row, index) => {
        const item = cfg.featuresMatrix[index]; if (!item) return;
        item.name = row.querySelector('td[data-label="Feature"] input').value;
        item.includedIn = $$('input[type="checkbox"]', row).filter(chk => chk.checked).map(chk => chk.dataset.pkg);
      });

      $$('#highlightsMatrix tbody tr', box).forEach((row, index) => {
        const item = cfg.highlightFeatures[index]; if (!item) return;
        item.icon = row.querySelector('td[data-label="Icon"] input').value;
        item.title = row.querySelector('td[data-label="Title"] input').value;
        item.description = row.querySelector('td[data-label="Desc."] input').value;
        item.includedIn = $$('input[type="checkbox"]', row).filter(chk => chk.checked).map(chk => chk.dataset.pkg);
      });

      // FAQ: prefer Quill content, fallback to hidden input
      $$('#faqRows .faq-row', box).forEach((row, index) => {
        const item = cfg.faq[index]; if (!item) return;
        item.q = row.querySelector('.faq-q').value;
        item.a = faqEditors[index] ? faqEditors[index].root.innerHTML : row.querySelector('.faq-a').value;
      });
    }

    const drawPackages = () => {
      packagesEditor.innerHTML = cfg.packages.map(p => `
        <div class="package-col" data-key="${p.key}">
          <label class="small">Name</label><input class="input" data-prop="name" value="${p.name}">
          <label class="small">Scope</label><input class="input" data-prop="scope" value="${p.scope}">
          <label class="small">Price (One-time)</label><input class="input" type="number" data-prop="price" value="${p.price}">
          <label class="small">Subscription Price</label><input class="input" type="number" data-prop="hosting" value="${p.hosting || 0}">
          <label class="small">Subscription Cadence</label><input class="input" data-prop="cadence" value="${p.cadence || 'per year'}">
          <label class="small">Ribbon</label><input class="input" data-prop="ribbon" value="${p.ribbon}">
          <label class="small">Color</label>
          <select class="input" data-prop="ribbonColor">
            <option value="gray">Gray</option><option value="blue">Blue</option>
            <option value="red">Red</option><option value="gold">Gold</option>
          </select>
          <div class="pkg-visibility">
            <label class="small">Visible to Client</label>
            <label class="switch">
              <input type="checkbox" data-prop="enabled" ${p.enabled === false ? '' : 'checked'}>
              <span class="slider round"></span>
            </label>
          </div>
        </div>
      `).join('');
      cfg.packages.forEach(p => {
        const sel = packagesEditor.querySelector(`[data-key="${p.key}"] [data-prop="ribbonColor"]`);
        if(sel) sel.value = p.ribbonColor || 'gray';
      });
    };

    const drawFeaturesMatrix = () => {
      featuresMatrixEl.innerHTML = `<table>
        <thead><tr><th>Feature Name</th>${cfg.packages.map(p=>`<th>${p.name}</th>`).join('')}<th></th></tr></thead>
        <tbody>
          ${(cfg.featuresMatrix || []).map((feat, i) => `
            <tr data-index="${i}">
              <td data-label="Feature"><input class="input" value="${feat.name || ''}"></td>
              ${cfg.packages.map(p => `<td data-label="${p.name}"><input type="checkbox" data-pkg="${p.key}" ${(feat.includedIn || []).includes(p.key) ? 'checked':''}></td>`).join('')}
              <td><button class="icon-btn rm-row" title="Delete Feature"><i class="ri-delete-bin-line"></i></button></td>
            </tr>`).join('')}
        </tbody></table>`;
    };

    // === HIGHLIGHTS TABLE with dynamic ALL icons picker ===
    const drawHighlightsMatrix = () => {
      highlightsMatrixEl.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Icon</th><th>Title</th><th>Desc.</th>
              ${cfg.packages.map(p=>`<th>${p.name}</th>`).join('')}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${(cfg.highlightFeatures || []).map((hf, i) => `
              <tr data-index="${i}">
                <td data-label="Icon">
                  <div class="icon-picker" data-index="${i}">
                    <div class="icon-display">
                      <div class="icon-preview">
                        ${hf.icon ? `<i class="${hf.icon}"></i>` : `<i class="ri-question-line"></i>`}
                      </div>
                      <input class="input icon-class" placeholder="ri-rocket-line" value="${hf.icon || ''}">
                      <button class="icon-btn pick-btn" type="button" title="Pick icon">
                        <i class="ri-magic-line"></i> Pick
                      </button>
                    </div>
                    <div class="icon-menu">
                      <div class="icon-search" style="padding:6px 6px 8px;">
                        <input class="input icon-search-input" placeholder="Search icons…">
                      </div>
                      <div class="icon-grid"></div>
                    </div>
                  </div>
                </td>
                <td data-label="Title"><input class="input" value="${hf.title || ''}"></td>
                <td data-label="Desc."><input class="input" value="${hf.description || ''}"></td>
                ${cfg.packages.map(p => `
                  <td data-label="${p.name}">
                    <input type="checkbox" data-pkg="${p.key}" ${(hf.includedIn || []).includes(p.key) ? 'checked':''}>
                  </td>`).join('')}
                <td><button class="icon-btn rm-row" title="Delete Highlight">
                  <i class="ri-delete-bin-line"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    };

    // Open/close picker via PORTAL, populate ALL icons once, live search (delegated on picker)
    highlightsMatrixEl.addEventListener('click', async (e) => {
      const openBtn = e.target.closest('.pick-btn, .icon-preview');
      if (openBtn) {
        const picker = openBtn.closest('.icon-picker');

        if (!picker.dataset.loaded) {
          const menu   = picker.querySelector('.icon-menu');
          const grid   = menu.querySelector('.icon-grid');
          const search = menu.querySelector('.icon-search-input');
          const ALL = await ensureRemixIconIndex();
          renderIconGrid(ALL, grid);
          search.addEventListener('input', () => {
            const q = search.value.toLowerCase().trim();
            const filtered = q ? ALL.filter(n => n.includes(q)) : ALL;
            renderIconGrid(filtered, grid);
          }, { passive:true });
          picker.dataset.loaded = '1';
        }

        openIconPicker(picker);
        return;
      }
    });

    // SELECTION handler (menu lives in PORTAL)
    iconPortal.addEventListener('click', (e) => {
      const choice = e.target.closest('.icon-item');
      if (!choice) return;
      const picker = activePicker;
      if (!picker) return;
      const idx = +picker.dataset.index;
      const val = choice.dataset.val;
      if (!isNaN(idx)) {
        cfg.highlightFeatures[idx].icon = val;
      }
      picker.querySelector('.icon-class').value = val;
      picker.querySelector('.icon-preview').innerHTML = `<i class="${val}"></i>`;
      closeIconPicker();
    });

    // live preview while typing manual class name
    highlightsMatrixEl.addEventListener('input', (e) => {
      const inp = e.target.closest('.icon-class');
      if (!inp) return;
      const picker = inp.closest('.icon-picker');
      const idx = +picker.dataset.index;
      const val = inp.value.trim();
      if (!isNaN(idx)) cfg.highlightFeatures[idx].icon = val;
      picker.querySelector('.icon-preview').innerHTML = val ? `<i class="${val}"></i>` : `<i class="ri-question-line"></i>`;
      if (activePicker === picker) positionIconPortal();
    });

    // Rich FAQ editor (keeps .faq-q and hidden .faq-a)
    const drawFAQ = () => {
      faqRows.innerHTML = (cfg.faq || []).map((it, i) => `
        <div class="faq-row" data-index="${i}">
          <div class="faq-inputs">
            <input class="input faq-q" placeholder="Question" value="${it.q || ''}">
            <input class="input faq-a" type="hidden" value="${(it.a || '').replace(/"/g, '&quot;')}">
            <div id="faq-editor-${i}" class="quill-editor-faq"></div>
          </div>
          <button class="icon-btn rm-row" title="Delete FAQ"><i class="ri-delete-bin-line"></i></button>
        </div>
      `).join('');

      // init Quill editors if available; fallback to textarea
      faqEditors = {};
      if (window.Quill) {
        const opts = { theme: 'snow', modules: { toolbar: [['bold','italic','underline'], ['link'], [{ list:'ordered' }, { list:'bullet' }], ['clean']] } };
        (cfg.faq || []).forEach((it, i) => {
          const editor = new Quill(`#faq-editor-${i}`, opts);
          editor.root.innerHTML = it.a || '';
          faqEditors[i] = editor;
          editor.on('text-change', () => {
            const hidden = $(`.faq-row[data-index="${i}"] .faq-a`, box);
            if (hidden) hidden.value = editor.root.innerHTML;
          });
        });
      } else {
        (cfg.faq || []).forEach((it, i) => {
          const container = $(`#faq-editor-${i}`, box);
          container.innerHTML = `<textarea class="input" rows="4">${it.a || ''}</textarea>`;
          const ta = container.querySelector('textarea');
          const hidden = $(`.faq-row[data-index="${i}"] .faq-a`, box);
          ta.addEventListener('input', () => hidden.value = ta.value);
        });
      }
    };

    // Package inputs listener (includes toggle switch)
    packagesEditor.addEventListener('input', e => {
      const input = e.target;
      const key = input.closest('.package-col').dataset.key;
      const pkg = cfg.packages.find(p => p.key === key);
      if(!pkg) return;
      const prop = input.dataset.prop;

      if (input.type === 'checkbox') {
        pkg[prop] = input.checked;
      } else {
        pkg[prop] = input.type === 'number' ? parseFloat(input.value) : input.value;
      }

      if (prop === 'name') { syncDOMToData(); drawFeaturesMatrix(); drawHighlightsMatrix(); }
    });

    $('#addFeature', box).onclick = () => { syncDOMToData(); cfg.featuresMatrix.push({ name: 'New Feature', includedIn: [] }); drawFeaturesMatrix(); };
    $('#addHighlight', box).onclick = () => { syncDOMToData(); cfg.highlightFeatures.push({ icon: 'ri-rocket-line', title: 'New Highlight', description: '', includedIn: [] }); drawHighlightsMatrix(); };
    $('#faqAdd', box).onclick = () => { syncDOMToData(); cfg.faq.push({ q: '', a: '' }); drawFAQ(); };

    // delete buttons for features/highlights
    $$('.matrix-wrap', box).forEach(wrap => {
      wrap.addEventListener('click', e => {
        const btn = e.target.closest('.rm-row'); if (!btn) return;
        syncDOMToData();
        const index = parseInt(btn.closest('tr').dataset.index);
        if(isNaN(index)) return;
        if (wrap.id === 'featuresMatrix') { cfg.featuresMatrix.splice(index, 1); drawFeaturesMatrix(); }
        else if (wrap.id === 'highlightsMatrix') { cfg.highlightFeatures.splice(index, 1); drawHighlightsMatrix(); }
      });
    });

    // delete buttons for FAQ
    $('#faqEditor', box).addEventListener('click', e => {
      const delBtn = e.target.closest('.rm-row'); if (!delBtn) return;
      syncDOMToData();
      const index = parseInt(delBtn.closest('.faq-row').dataset.index);
      if(isNaN(index)) return;
      cfg.faq.splice(index, 1);
      drawFAQ();
    });

    drawPackages(); drawFeaturesMatrix(); drawHighlightsMatrix(); drawFAQ();

    function cleanupAndClose() {
      try { closeIconPicker(); iconPortal.remove(); } catch(_) {}
      document.removeEventListener('mousedown', outsideHandler);
      ov.remove();
    }

    $('#saveClient', box).onclick = async () => {
      syncDOMToData();
      cfg.proposal.title = $('#confTitle', box).value.trim();
      cfg.proposal.subtitle = $('#confSub', box).value.trim();
      cfg.proposal.note = $('#confNote', box).value.trim();
      cfg.proposal.downpaymentPercent = parseInt($('#confDp', box).value) || 50;
      cfg.faq = cfg.faq.filter(f => f.q && f.a);
      delete cfg.compare;

      const payload = {
        name: $('#fName', box).value.trim(),
        company: $('#fCompany', box).value.trim(),
        email: $('#fEmail', box).value.trim(),
        phone: $('#fPhone', box).value.trim(),
        config: cfg,
        configId: c.configId || '',
        selections: c.selections || {}
      };
      if (!payload.name) return Swal.fire('Missing Name', 'Client name is required.', 'warning');
      try {
        if (isEdit) {
          await Store.saveConfig(payload.config, payload.configId);
          bc.postMessage({ type:'cfg-updated', id: payload.configId });
          await Store.updateClient(c.id, payload);
        } else {
          const configId = await Store.saveConfig(payload.config);
          payload.configId = configId;
          await Store.addClient(payload);
        }
        await Swal.fire({ title:'Saved!', icon:'success', timer:1200, showConfirmButton:false });
        cleanupAndClose();
      } catch (err) {
        console.error("Save failed:", err);
        Swal.fire('Error', 'Could not save the client data. ' + err.message, 'error');
      }
    };

    $('#closeModal', box).onclick = ()=> cleanupAndClose();
  }

  return { render, renderPage };
})();
