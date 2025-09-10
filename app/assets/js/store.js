/* Firestore + local helpers (admin + public) */
(function(){
  const A = () => window.FB.api;
  const DB = () => window.FB.db;

  const col = (name) => A().collection(DB(), name);
  const docRef = (name, id) => A().doc(DB(), name, id);

  const tsToDate = (v) => {
    if (!v) return null;
    if (v.toDate) try { return v.toDate(); } catch(_){}
    const n = Number(v);
    return isFinite(n) ? new Date(n) : null;
  };

  const defaults = () => ({
    brand: { name: "Modern Cipher", logo: "app/assets/img/mc.png" },
    proposal: { title: "Project Proposal", subtitle:"Website & system bundle", note:"All prices VAT-exclusive." },
    packages: [
      { key:"starter", name:"Starter", scope:"Brochure site", price:9900, hosting:4000, cadence:"year (domain + hosting)", ribbon:"Basic", ribbonColor:"gray" },
      { key:"plus",    name:"Plus",    scope:"Brochure + CMS", price:19900, hosting:4000, cadence:"year (domain + hosting)", ribbon:"Popular", ribbonColor:"red" },
      { key:"pro",     name:"Pro",     scope:"Booking + CMS",  price:29900, hosting:4000, cadence:"year (domain + hosting)", ribbon:"Best value", ribbonColor:"blue" },
      { key:"premium", name:"Premium", scope:"Full system",    price:49900, hosting:4000, cadence:"year (domain + hosting)", ribbon:"Premium", ribbonColor:"gold" }
    ],
    faq:[
      { q:"How long is delivery?", a:"Usually 2–4 weeks depending on scope." },
      { q:"What about domain/hosting?", a:"Annual fee covers domain + hosting + maintenance." }
    ],
    settings: {
      footer: {
        companyName: "Modern Cipher",
        description: "Professional system & web development — dynamic proposal links per client.",
        address: "Angeles City, Pampanga, Philippines",
        phone: "+63 912 345 6789",
        email: "contact@moderncipher.com",
        socials: {
          facebook: "#", viber: "#", telegram: "#",
          gmail: "#", tiktok: "#", website: "#"
        }
      },
      pages: {
        tos: {
          updatedAt: new Date().toISOString(),
          content: `<h2>Terms of Service</h2><p>Welcome to Modern Cipher. By engaging our services, you agree to the following terms and conditions.</p><h3>1. Services</h3><p>Modern Cipher provides a wide range of digital services, including but not limited to web development, system creation, digital product design, and graphic design. The scope of work for each project will be detailed in its respective proposal.</p><h3>2. Downpayment and Payment</h3><p>Project commencement is subject to a downpayment. <strong>The percentage of this downpayment is variable and will be mutually agreed upon by Modern Cipher and the Client as specified in the project proposal.</strong> Final payment is due upon project completion, prior to the turnover of final assets.</p><h3>3. Revisions & Support</h3><p>The number of revisions included is specified in the selected package. Additional revisions may incur extra charges. We are committed to delivering quality service and providing support as detailed in the proposal.</p>`
        },
        privacy: {
          updatedAt: new Date().toISOString(),
          content: `<h2>Privacy Policy</h2><p>Modern Cipher respects your privacy.</p><h3>1. Information We Collect</h3><p>We may collect personal information such as your name, email, and contact details when you inquire about or engage our services. This information is used solely for communication and project management.</p><h3>2. How We Use Your Information</h3><p>Your information is used to provide and improve our services, process payments, and communicate with you about your project. We do not sell or share your personal information with third parties for marketing purposes.</p><h3>3. Data Security</h3><p>We take reasonable measures to protect your personal information from unauthorized access or disclosure.</p>`
        }
      }
    }
  });

  async function getConfig(id){
    const d = await A().getDoc(docRef("configs", id));
    if (!d.exists()) return null;
    const data = d.data();
    return { id, ...data };
  }
  // REAL-TIME LISTENER for a single config document
  function onConfigUpdate(id, callback) {
    return A().onSnapshot(docRef("configs", id), (doc) => {
      callback(doc.exists() ? { id, ...doc.data() } : null);
    });
  }

  function linkFor(cfgId){ return location.origin + App.BASE + "#/p/" + cfgId; }

  function isAuthed(){ return !!(window.FB?.auth?.currentUser); }
  function onAuth(callback){ return A().onAuthStateChanged(window.FB.auth, callback); }
  async function login(email, pass){ await window.FB.api.signInWithEmailAndPassword(window.FB.auth, email, pass); return true; }
  async function logout(){ await window.FB.api.signOut(window.FB.auth); }

  async function listClients(){ const q = A().query(col("clients"), A().orderBy("updatedAt","desc")); const snap = await A().getDocs(q); return snap.docs.map(d=>{ const v = d.data(); return { id:d.id, ...v, updatedAt: tsToDate(v.updatedAt) || tsToDate(v.createdAt) || new Date() }; }); }
  // REAL-TIME LISTENER for the clients collection
  function onClientsUpdate(callback) {
    const q = A().query(col("clients"), A().orderBy("updatedAt", "desc"));
    return A().onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const v = d.data();
        return { id: d.id, ...v, updatedAt: tsToDate(v.updatedAt) || tsToDate(v.createdAt) || new Date() };
      });
      callback(list);
    });
  }

  async function getClient(id){ const d = await A().getDoc(docRef("clients", id)); if(!d.exists()) return null; const v = d.data(); return { id, ...v, updatedAt: tsToDate(v.updatedAt) || tsToDate(v.createdAt) || new Date() }; }
  async function addClient(payload){ const now = A().serverTimestamp(); const ref = await A().addDoc(col("clients"), { ...payload, createdAt: now, updatedAt: now }); return ref.id; }
  async function updateClient(id, patch){ patch.updatedAt = A().serverTimestamp(); await A().updateDoc(docRef("clients", id), patch); }
  async function deleteClient(id){ await A().deleteDoc(docRef("clients", id)); }

  async function getClientByConfigId(configId) {
    if (!configId) return null;
    const q = A().query(col("clients"), A().where("configId", "==", configId));
    const snap = await A().getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const v = d.data();
    return { id: d.id, ...v };
  }

  async function saveConfig(cfg, id){
    const now = A().serverTimestamp();
    if (id){
      await A().setDoc(docRef("configs", id), { ...cfg, updatedAt: now }, { merge:true });
      return id;
    }
    const ref = await A().addDoc(col("configs"), { ...cfg, createdAt: now, updatedAt: now });
    return ref.id;
  }
  
  async function getSettings() {
    const d = await A().getDoc(docRef("settings", "main"));
    if (!d.exists()) return defaults().settings;
    return d.data();
  }
  // REAL-TIME LISTENER for the settings document
  function onSettingsUpdate(callback) {
      return A().onSnapshot(docRef("settings", "main"), (doc) => {
          callback(doc.exists() ? doc.data() : defaults().settings);
      });
  }

  async function saveSettings(settingsData) {
    await A().setDoc(docRef("settings", "main"), settingsData, { merge: true });
  }

  async function getProposalInfo(configId) {
    const d = await A().getDoc(docRef("proposal_info", configId));
    return d.exists() ? d.data() : null;
  }
  async function saveProposalInfo(configId, info) {
    await A().setDoc(docRef("proposal_info", configId), info, { merge: true });
  }

  window.Store = {
    defaults, getConfig, onConfigUpdate, linkFor,
    isAuthed, login, logout, onAuth,
    listClients, onClientsUpdate, getClient, addClient, updateClient, deleteClient,
    getClientByConfigId,
    saveConfig,
    getSettings, onSettingsUpdate, saveSettings,
    getProposalInfo, saveProposalInfo
  };
})();