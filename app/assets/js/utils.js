/* ========= Global utilities ========= */
(function (w) {
  w.$  = (sel, root=document) => root.querySelector(sel);
  w.$$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  w.currency = function (n, symbol='₱') {
    const v = Number(n || 0);
    return `${symbol}${v.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  };

  // robust date formatter (accepts Firestore Timestamp, millis, ISO, or missing)
  w.fmtDate = function (v) {
    if (!v) return '';
    let d;
    if (typeof v === 'number') d = new Date(v);
    else if (typeof v?.toDate === 'function') d = v.toDate();
    else if (typeof v === 'string') d = new Date(v);
    else d = new Date();
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  };

  w.uid = function (len=10) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const buf = new Uint8Array(len);
    (self.crypto || window.crypto).getRandomValues(buf);
    return Array.from(buf, n => chars[n % chars.length]).join('');
  };

  w.downloadBlob = function (filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },0);
  };

  // public header morph (no-op on admin)
  function morphHeader() {
    const h = document.getElementById('siteHeader');
    if (!h) return; h.classList.toggle('is-solid', window.scrollY>8);
  }
  window.addEventListener('scroll', morphHeader, { passive:true });
  window.addEventListener('load', morphHeader);
})(window);

// deepEqual helper
window.deepEqual = function a(x,y){
  if (x===y) return true;
  if (typeof x!=='object' || typeof y!=='object' || !x || !y) return false;
  const kx = Object.keys(x), ky = Object.keys(y);
  if (kx.length !== ky.length) return false;
  for (const k of kx) if (!a(x[k], y[k])) return false;
  return true;
};
