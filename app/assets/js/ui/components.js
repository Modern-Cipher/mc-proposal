/* PublicUI — Renders the public proposal view */
window.PublicUI = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const currency = (n) =>
    "₱" +
    Number(n || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  async function renderAllInto({ root, cfg, cfgId }) {
    root.innerHTML = `
      <header class="header-card">
        <div class="brand">
          <div class="logo"><img src="${
            cfg.brand?.logo || "app/assets/img/mc.png"
          }" alt=""></div>
          <div class="name">${cfg.brand?.name || "Modern Cipher"}</div>
        </div>
        <div class="badge"><i class="ri-verified-badge-line"></i>&nbsp; Official Proposal</div>
      </header>
      <div class="main-content-card">
        <section class="hero">
          <div class="kicker small">Proposal for ${
            cfg.proposal?.clientName || "Valued Client"
          }</div>
          <div class="title">${cfg.proposal?.title || "Project Proposal"}</div>
          <p class="small" style="margin:6px 0">${
            cfg.proposal?.subtitle || ""
          }</p>
          <p class="small muted" style="margin:4px 0;">${
            cfg.proposal?.note || ""
          }</p>
        </section>
        <div class="section" id="cardsMount"></div>
      </div>
      <div class="section" id="highlightsMount"></div>
      <div class="section" id="compareMount"></div>
      <div class="section" id="faqMount"></div>
    `;
    renderCards($("#cardsMount"), cfg, cfgId);
    renderHighlights($("#highlightsMount"), cfg);
    renderCompare($("#compareMount"), cfg);
    renderFaqs($("#faqMount"), cfg);
  }

  function renderCards(host, cfg, cfgId) {
    host.innerHTML = `<div class="cards">${cfg.packages
      .map((p) => card(p, cfg))
      .join("")}</div>`;
    host.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const key = btn.closest(".pkg").dataset.key;
      const pkg = cfg.packages.find((x) => x.key === key);
      if (!pkg) return;

      // UPDATED: Call the new, separate modal functions
      if (btn.dataset.act === "details") {
        window.DetailsModal.open(pkg, cfg, cfgId);
      }
      // This will be for the next step
      if (btn.dataset.act === "select") {
        window.SelectModal.open(pkg, cfg, cfgId); // NEW
      }
    });
  }

  function card(p, cfg) {
    const rb = p.ribbon
      ? `<span class="ribbon ribbon-${p.ribbonColor || "gray"}">${
          p.ribbon
        }</span>`
      : "";
    const includedFeatures = (cfg.featuresMatrix || []).filter((f) =>
      (f.includedIn || []).includes(p.key)
    );

    return `<article class="pkg" data-key="${p.key}">
      ${rb}
      <div class="head">
        <div class="k">${p.name}</div>
        <div class="scope small">${p.scope || ""}</div>
      </div>
      <div class="price">
        <div class="price-amount">${currency(p.price)}</div>
        <div class="price-label">one-time development fee</div>
        <div class="price-host small">+ ${currency(p.hosting || 0)} / ${
      p.cadence || "year"
    }</div>
      </div>
      <ul class="feat">${includedFeatures
        .slice(0, 8)
        .map((f) => `<li><i class="ri-check-line"></i> ${f.name}</li>`)
        .join("")}${
      includedFeatures.length > 8
        ? `<li class="muted" style="border:0; padding-top: 10px;">+ ${
            includedFeatures.length - 8
          } more features...</li>`
        : ""
    }</ul>
      <div class="actions">
        <button class="btn ghost" data-act="details"><i class="ri-information-line"></i> View Details</button>
        <button class="btn" data-act="select"><i class="ri-hand-coin-line"></i> Select</button>
      </div>
    </article>`;
  }

  function renderHighlights(host, cfg) {
    const highlights = (cfg.highlightFeatures || []).filter(
      (h) => h.includedIn && h.includedIn.length > 0
    );
    if (highlights.length === 0) return;
    const packageNames = Object.fromEntries(
      cfg.packages.map((p) => [p.key, p.name])
    );
    host.innerHTML = `<div class="section-title">Exclusive Highlights</div><div class="swiper highlight-carousel"><div class="swiper-wrapper">${highlights
      .map((hf) => {
        const assignedPackages = (hf.includedIn || [])
          .map((key) => packageNames[key])
          .join(" & ");
        return `<div class="swiper-slide"><div class="highlight-card"><div class="highlight-icon"><i class="${
          hf.icon || "ri-star-line"
        }"></i></div><div class="highlight-content"><div class="highlight-title">${
          hf.title
        }</div><div class="highlight-desc small muted">${
          hf.description
        }</div><div class="highlight-packages small"><span class="chip success">${assignedPackages} Only</span></div></div></div></div>`;
      })
      .join(
        ""
      )}</div><div class="swiper-pagination"></div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div></div>`;
  }

  function renderCompare(host, cfg) {
    const allFeatures = cfg.featuresMatrix || [];
    if (allFeatures.length === 0) return;
    host.innerHTML = `<div class="section-title">Feature Comparison</div><div class="table-wrap"><table><thead><tr><th>Feature</th>${cfg.packages
      .map((p) => `<th>${p.name}</th>`)
      .join("")}</tr></thead><tbody>${allFeatures
      .map(
        (f) =>
          `<tr><td>${f.name}</td>${cfg.packages
            .map((p) => {
              const has = (f.includedIn || []).includes(p.key);
              return `<td class="check">${has ? "✔" : "-"}</td>`;
            })
            .join("")}</tr>`
      )
      .join("")}</tbody></table></div>`;
  }
  function renderFaqs(host, cfg) {
    const faqs = cfg.faq || [];
    if (faqs.length === 0) return;
    host.innerHTML = `<div class="section-title">Frequently Asked Questions</div><div class="faq-list">${faqs
      .map(
        (item) =>
          `<details class="faq-item"><summary><i class="ri-question-answer-line"></i><span>${item.q}</span><i class="ri-arrow-down-s-line arrow"></i></summary><div class="faq-answer">${item.a}</div></details>`
      )
      .join("")}</div>`;
  }

  // DELETED the old openDetailsModal function. Its logic is now in details-modal.js

  return { renderAllInto };
})();
