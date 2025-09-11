/* Details Modal & Print/Export Form (QR header; full features; watermark; repeated page headers; compact page-3) */
window.DetailsModal = (function () {
  const currency = (n) =>
    "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function injectPrintWatermarkStyles() {
    if (document.getElementById("print-watermark-styles")) return;
    const s = document.createElement("style");
    s.id = "print-watermark-styles";
    s.textContent = `
@media print {
  /* Global defaults */
  #print-view .print-body{ font-size:11pt; }

  /* Brand/header cluster: contact + QR stay together on the right */
  .brand-block{
    display:flex;
    align-items:flex-end;
    justify-content:flex-start;   /* key: no space-between so contact & QR are adjacent */
    gap:12px;
  }
  .brand-left{ display:flex; align-items:flex-end; gap:10px; }
  .brand-left img{ height:56px !important; width:auto !important; }

  .brand-contact{
    margin-left:auto !important;  /* pushes contact (and next sibling QR) to the right */
    text-align:right !important;
    display:flex;
    flex-direction:column;
    gap:2pt;
    align-items:flex-end;
  }
  .brand-qr{
    width:72px !important; height:72px !important;
    align-self:flex-end !important;
    margin-left:8px;              /* small spacing beside contact */
  }

  /* Small separators for reused headers on p2 & p3 */
  .page-header{ margin-bottom:8pt; border-bottom:1px solid #e5e7eb; padding-bottom:6pt; }

  /* Watermark */
  #print-view{ position:relative; }
  #print-view::before{
    content:attr(data-watermark);
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%) rotate(-30deg);
    font-size:clamp(48pt,8.5vw,72pt); line-height:1.05;
    font-weight:600; letter-spacing:.5px; color:#000; opacity:.06;
    z-index:0; white-space:pre; overflow-wrap:normal; word-break:keep-all;
    text-align:center; pointer-events:none;
  }
  #print-view .print-body{ position:relative; z-index:1; }

  /* Signature labels centered; spacing tuned */
  .agreement-section .signature-area{ margin-top:7.5em !important; }
  .agreement-section .legal-note{ margin-top:7.5em !important; }
  .signature-area .sig-line{ text-align:center !important; }
  .signature-area .sig-line span{ display:inline-block !important; margin-top:6px !important; font-size:10pt; color:#555; }

  /* Page breaks */
  .highlights-start{ break-before:page; } /* Page 2 */
  .policies-start{ break-before:page; }   /* Page 3 */

  /* Page 2 & 3 typography */
  .print-faq, .print-policies{ font-size:11pt; line-height:1.25; }
  .print-faq h3{ font-size:12pt; margin:10pt 0 6pt; }
  .print-faq dt{ font-weight:600; margin:4pt 0 2pt; }
  .print-faq dd{ margin:0 0 6pt 0; padding-left:1.2em; color:#333; }

  .print-policies h3{ font-size:12pt; margin:10pt 0 6pt; }
  .print-policies .policy-content{ margin:0 0 8pt; }
  .print-policies .policy-content *{ font-size:11pt !important; line-height:1.25 !important; }
  .print-policies .policy-content p,
  .print-policies .policy-content li{ margin:8pt 0 !important; }
  .print-policies ul, .print-policies ol{ margin:6pt 0 8pt 18pt; }

  .section-break h2, .section-break h3{ margin:10pt 0 6pt; }
}
`;
    document.head.appendChild(s);
  }

  function resolveProposalUrl(settings, cfg) {
    const f = settings?.footer || {};
    return cfg?.proposal?.link || f.website || f.url || (typeof location !== "undefined" ? location.href : "https://example.com");
  }

  function buildQRImageSrc(data) {
    const d = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${d}`;
  }

  /* Strip a leading H1–H6 so we don't duplicate headings; then wrap with our title */
  function buildPolicySection(title, html) {
    if (!html) return "";
    let cleaned = html.trim();
    cleaned = cleaned.replace(/^<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>\s*/i, "");
    return `<h3>${title}</h3><div class="policy-content">${cleaned}</div>`;
  }

  async function open(pkg, cfg, cfgId) {
    const included = (cfg.featuresMatrix || []).filter(f => (f.includedIn || []).includes(pkg.key));
    Swal.fire({
      showCloseButton: true,
      showConfirmButton: false,
      width: "min(700px, 90vw)",
      html: `
        <div class="details-modal-header">
          <h2>${pkg.name}</h2>
          <p class="small muted">${pkg.scope || ""}</p>
        </div>
        <div class="details-modal-content">
          <h4>Complete Feature List:</h4>
          <ul class="details-feat-list">
            ${included.map(f => `<li><i class="ri-check-line"></i> ${f.name}</li>`).join("")}
          </ul>
        </div>
        <div class="details-modal-actions">
          <button class="btn ghost" id="roiBtn"><i class="ri-line-chart-line"></i> ROI Calculator</button>
          <button class="btn" id="printBtn"><i class="ri-printer-line"></i> Save & Print</button>
        </div>`,
      customClass: { popup: "details-modal" },
      didOpen: () => {
        document.getElementById("roiBtn").onclick = () => window.ROICalculator.open(pkg);
        document.getElementById("printBtn").onclick = () => openPrintForm(pkg, cfg, cfgId);
      }
    });
  }

  async function openPrintForm(pkg, cfg, cfgId) {
    const savedInfo = (await Store.getProposalInfo(cfgId)) || {};
    await Store.getSettings();

    Swal.fire({
      title: "Prepare for Export",
      html: `
        <p class="small muted" style="margin-top:0;">Enter the recipient's details for the document header.</p>
        <div id="print-info-form">
          <div class="form-grid">
            <div>
              <label class="small">Prefix</label>
              <select id="pi_prefix" class="input">
                <option>Mr.</option><option>Ms.</option><option>Mrs.</option>
                <option>Dr.</option><option>Engr.</option><option>Atty.</option>
              </select>
            </div>
            <div>
              <label class="small">Full Name</label>
              <input id="pi_name" class="input" value="${savedInfo.name || ""}" placeholder="e.g. Juan dela Cruz">
            </div>
            <div class="full-width">
              <label class="small">Position</label>
              <input id="pi_pos" class="input" value="${savedInfo.position || ""}" placeholder="e.g. CEO / Manager">
            </div>
            <div class="full-width">
              <label class="small">Company Name</label>
              <input id="pi_comp" class="input" value="${savedInfo.company || ""}" placeholder="e.g. ABC Corporation">
            </div>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: '<i class="ri-save-3-line"></i> Save & Generate',
      customClass: { popup: "details-modal" },
      preConfirm: async () => {
        const info = {
          prefix: document.getElementById("pi_prefix").value,
          name: document.getElementById("pi_name").value.trim(),
          position: document.getElementById("pi_pos").value.trim(),
          company: document.getElementById("pi_comp").value.trim()
        };
        if (!info.name || !info.company) {
          Swal.showValidationMessage("Full Name and Company are required.");
          return false;
        }
        await Store.saveProposalInfo(cfgId, info);
        return info;
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        const settingsNow = await Store.getSettings();
        await prepareAndPrint(pkg, cfg, result.value, settingsNow);
      }
    });

    if (savedInfo.prefix) document.getElementById("pi_prefix").value = savedInfo.prefix;
  }

  async function prepareAndPrint(pkg, cfg, clientInfo, settings) {
    injectPrintWatermarkStyles();

    const old = document.getElementById("print-view");
    if (old) old.remove();

    const tosHTML = settings?.pages?.tos?.content || "";
    const privacyHTML = settings?.pages?.privacy?.content || "";

    const printContainer = document.createElement("div");
    printContainer.id = "print-view";
    const companyName = settings.footer?.companyName || "Modern Cipher";
    printContainer.setAttribute("data-watermark", `${companyName}\nOfficial Proposal`);

    const companyInfo = settings.footer || {};
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const allFeatures = (cfg.featuresMatrix || []).filter(f => (f.includedIn || []).includes(pkg.key));
    const includedHighlights = (cfg.highlightFeatures || []).filter(h => (h.includedIn || []).includes(pkg.key));
    const dpPercent = cfg?.proposal?.downpaymentPercent ?? 50;
    const totalInvestment = (pkg.price || 0) + (pkg.hosting || 0);
    const downpaymentAmount = totalInvestment * (dpPercent / 100);
    const proposalUrl = resolveProposalUrl(settings, cfg);
    const qrSrc = buildQRImageSrc(proposalUrl);

    const tosSection = tosHTML ? buildPolicySection("Terms of Service", tosHTML) : "";
    const privSection = privacyHTML ? buildPolicySection("Privacy Policy", privacyHTML) : "";

    const pageHeaderHTML = `
      <div class="brand-block page-header">
        <div class="brand-left">
          <img src="app/assets/img/mc.png" alt="Logo">
          <div>
            <div class="brand-name">${companyInfo.companyName || ""}</div>
            <div class="brand-addr">${companyInfo.address || ""}</div>
          </div>
        </div>
        <div class="brand-contact">
          <div class="email">${companyInfo.email || ""}</div>
          <div class="phone">${companyInfo.phone || ""}</div>
        </div>
        <img class="brand-qr" alt="QR" src="${qrSrc}">
      </div>`;

    printContainer.innerHTML = `
      <div class="print-body">
        <!-- ===== Page 1 ===== -->
        ${pageHeaderHTML}

        <p class="print-date">${today}</p>

        <div class="client-info">
          <p><strong>PROPOSAL FOR:</strong></p>
          <p>
            <strong>${clientInfo.prefix} ${clientInfo.name}</strong><br>
            ${clientInfo.position}<br>
            ${clientInfo.company}
          </p>
        </div>

        <h1 class="doc-title">${cfg.proposal.title}</h1>

        <div class="cover-letter">
          <p>Dear ${clientInfo.prefix} ${clientInfo.name},</p>
          <p>Thank you for considering ${companyInfo.companyName || "our team"}. We are pleased to present this detailed quotation for the <strong>${pkg.name} Package</strong>, tailored to your project requirements.</p>
        </div>

        <div class="section-break">
          <h2>Quotation: ${pkg.name} Package</h2>
          <table class="quote-table">
            <tr>
              <td><strong>${pkg.scope || ""}</strong><div class="price-label">One-Time Development Fee</div></td>
              <td class="price-cell">${currency(pkg.price)}</td>
            </tr>
            <tr>
              <td><strong>Annual Subscription</strong><div class="price-label">${pkg.cadence || ""}</div></td>
              <td class="price-cell">${currency(pkg.hosting)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>Total Initial Investment (First Year)</strong></td>
              <td class="price-cell"><strong>${currency(totalInvestment)}</strong></td>
            </tr>
            <tr class="total-row">
              <td><strong>Downpayment (${dpPercent}%)</strong></td>
              <td class="price-cell"><strong>${currency(downpaymentAmount)}</strong></td>
            </tr>
          </table>
          ${cfg.proposal.note ? `<p class="small-note"><em>Note: ${cfg.proposal.note}</em></p>` : ""}
        </div>

        <div class="section-break">
          <h3>Features Included</h3>
          <ul class="print-feat">
            ${allFeatures.map(f => `<li>${f.name}</li>`).join("")}
          </ul>
        </div>

        <!-- ===== Page 2 ===== -->
        <div class="highlights-start"></div>
        ${pageHeaderHTML}

        ${
          includedHighlights.length > 0
            ? `<div class="section-break">
                 <h3>Exclusive Highlights</h3>
                 <ul class="print-feat">
                   ${includedHighlights.map(h => `<li><strong>${h.title}:</strong> ${h.description}</li>`).join("")}
                 </ul>
               </div>`
            : ""
        }

        <div class="agreement-section">
          <h2>Acceptance of Proposal</h2>
          <p>Should you wish to proceed, please sign below to confirm your acceptance. A formal contract and the initial invoice for the downpayment will follow.</p>
          <div class="signature-area">
            <div class="sig-line"><span>Signature</span></div>
            <div class="sig-line"><span>Printed Name</span></div>
            <div class="sig-line"><span>Date</span></div>
          </div>
          <p class="legal-note">${companyInfo.companyName || ""} | Confidential Proposal</p>
        </div>

        <!-- FAQs at bottom of Page 2 -->
        <div class="section-break print-faq">
          <h3>Frequently Asked Questions</h3>
          ${
            cfg.faq && cfg.faq.length
              ? `<dl>${cfg.faq.map(f => `<dt>${f.q}</dt><dd>${f.a}</dd>`).join("")}</dl>`
              : `<p class="muted">No FAQs provided.</p>`
          }
        </div>

        <!-- ===== Page 3 ===== -->
        <div class="policies-start"></div>
        ${pageHeaderHTML}

        ${
          (tosSection || privSection)
            ? `<div class="print-policies">
                 ${tosSection}
                 ${privSection}
               </div>`
            : ""
        }
      </div>
    `;

    document.body.appendChild(printContainer);

    const qrImgs = Array.from(printContainer.querySelectorAll('.brand-qr'));
    const ready = new Promise((resolve) => {
      let left = qrImgs.length || 1, done=false;
      const finish = () => { if (!done && --left <= 0){ done = true; resolve(); } };
      if (qrImgs.length === 0) resolve();
      qrImgs.forEach(img => {
        img.addEventListener("load", finish, { once: true });
        img.addEventListener("error", finish, { once: true });
      });
      setTimeout(resolve, 1500);
    });

    await ready;
    window.print();
    document.body.removeChild(printContainer);
  }

  return { open, openPrintForm };
})();
