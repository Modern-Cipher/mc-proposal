/* Public App – renders proposals and static pages */
window.PublicApp = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  let scrollListener = null;

  function createFooter(footerSettings) {
    const socials = footerSettings.socials || {};
    return `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-cols">
            <div class="footer-col">
              <h4>${footerSettings.companyName}</h4>
              <p>${footerSettings.description}</p>
              <div class="footer-social">
                ${socials.facebook ? `<a href="${socials.facebook}" class="soc-link" title="Facebook"><i class="ri-facebook-box-fill"></i></a>` : ''}
                ${socials.viber ? `<a href="${socials.viber}" class="soc-link" title="Viber"><i class="ri-viber-fill"></i></a>` : ''}
                ${socials.telegram ? `<a href="${socials.telegram}" class="soc-link" title="Telegram"><i class="ri-telegram-fill"></i></a>` : ''}
                ${socials.tiktok ? `<a href="${socials.tiktok}" class="soc-link" title="TikTok"><i class="ri-tiktok-fill"></i></a>` : ''}
                ${socials.website ? `<a href="${socials.website}" class="soc-link" title="Website"><i class="ri-global-line"></i></a>` : ''}
              </div>
            </div>
            <div class="footer-col">
              <h4>Users Agreement</h4>
              <ul class="footer-list">
                <li><a href="#/tos">Terms of Service</a></li>
                <li><a href="#/privacy">Privacy Policy</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Contact Us</h4>
              <ul class="footer-list">
                ${footerSettings.email ? `<li><a href="mailto:${footerSettings.email}">${footerSettings.email}</a></li>` : ''}
                ${footerSettings.phone ? `<li><a href="tel:${footerSettings.phone}">${footerSettings.phone}</a></li>` : ''}
                ${footerSettings.address ? `<li class="address">${footerSettings.address}</li>` : ''}
              </ul>
            </div>
          </div>
          <div class="subfooter">© ${new Date().getFullYear()} ${footerSettings.companyName}. All rights reserved.</div>
        </div>
      </footer>
    `;
  }

  async function render(mount) {
    if (scrollListener) {
      window.removeEventListener('scroll', scrollListener);
      scrollListener = null;
    }

    const settings = await Store.getSettings();
    const footerSettings = settings.footer || Store.defaults().settings.footer;

    mount.innerHTML = `
      <div class="page">
        <main class="page-main main-public">
          <div class="container">
            <div id="publicHost"></div>
          </div>
        </main>
        ${createFooter(footerSettings)}
      </div>`;

    const holder = $("#publicHost");
    const hash = window.location.hash || "#/";
    const [, seg1, seg2] = hash.split("/");

    if (seg1 === "p" && seg2) {
      // NEW: Remember the last viewed proposal ID
      sessionStorage.setItem('lastProposalId', seg2);
    } else {
       holder.innerHTML = `<div class="main-content-card" style="padding-top: 40px;"><div class="empty-wrap"><div class="empty-card"><h3>No proposal loaded</h3><div class="small">This is a private link. Please use the URL provided to you.</div></div></div></div>`;
      return;
    }

    holder.innerHTML = `<div class="hero" style="text-align:center"><div class="title">Loading proposal…</div></div>`;
    try {
      const cfg = await Store.getConfig(seg2);
      if (!cfg) {
        holder.innerHTML = `<div class="main-content-card" style="padding-top: 40px;"><div class="empty-wrap"><div class="empty-card"><h3>Invalid or Expired Link</h3><div class="small">The proposal was not found.</div></div></div></div>`;
        return;
      }
      
      await window.PublicUI.renderAllInto({ root: holder, cfg, cfgId: seg2 });

      if (document.querySelector('.highlight-carousel')) { new Swiper('.highlight-carousel', { loop: cfg.highlightFeatures.length > 2, slidesPerView: 1, spaceBetween: 16, autoplay: { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true, }, pagination: { el: '.swiper-pagination', clickable: true, }, navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev', }, breakpoints: { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 }, } }); }
      
      const header = $(".header-card");
      if (header) {
        const handleScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
        scrollListener = handleScroll;
        window.addEventListener('scroll', scrollListener);
        handleScroll();
      }

    } catch (e) {
      console.error("Failed to load proposal:", e);
      holder.innerHTML = `<div class="main-content-card" style="padding-top: 40px;"><div class="empty-wrap"><div class="empty-card"><h3>Something went wrong</h3><div class="small">Please refresh or try again later.</div></div></div></div>`;
    }
  }

  async function renderPage(mount, pageKey) {
    if (scrollListener) { window.removeEventListener('scroll', scrollListener); scrollListener = null; }

    const settings = await Store.getSettings();
    const pageData = (settings.pages && settings.pages[pageKey]) 
      ? settings.pages[pageKey] 
      : Store.defaults().settings.pages[pageKey];
      
    const pageTitle = pageKey === 'tos' ? 'Terms of Service' : 'Privacy Policy';
    
    // NEW: Get the remembered proposal ID for the back link
    const lastProposalId = sessionStorage.getItem('lastProposalId');
    const backLink = lastProposalId ? `#/p/${lastProposalId}` : '#/';

    mount.innerHTML = `
      <div class="page">
        <main class="page-main main-public">
          <div class="container">
            <header class="header-card is-scrolled">
              <div class="brand">
                <div class="logo"><img src="app/assets/img/mc.png" alt=""></div>
                <div class="name">Modern Cipher</div>
              </div>
              <a href="${backLink}" class="icon-btn" title="Back to Proposal">
                <i class="ri-arrow-go-back-line"></i>
              </a>
            </header>
            <div class="content-page-wrap">
              <h1 class="content-title">${pageTitle}</h1>
              <p class="last-updated">Last Updated: ${fmtDate(pageData.updatedAt)}</p>
              <div class="content-body">${pageData.content}</div>
            </div>
          </div>
        </main>
        ${createFooter(settings.footer || Store.defaults().settings.footer)}
      </div>
    `;
  }

  return { render, renderPage };
})();