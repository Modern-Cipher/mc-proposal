/* Router: directs traffic to either the Admin, Public, or Page apps */
(function () {
  const $ = (s) => document.querySelector(s);
  let initialRouteCalled = false;

  // This function decides which page to show
  function route() {
    const hash = location.hash || "#/";
    const [, path, subpath] = hash.split("/"); // Get path and subpath (e.g., #/admin/settings)
    const appRoot = $("#app");

    if (path === "admin") {
      // Load the admin interface, passing the specific page to render
      window.Admin.render(appRoot, subpath || 'analytics');
    } else if (path === "tos" || path === "privacy") {
      // Load the static page viewer
      window.PublicApp.renderPage(appRoot, path);
    } else {
      // Load the public proposal viewer
      window.PublicApp.render(appRoot);
    }
  }
  
  // This function initializes the app
  function init() {
    // Wait for Firebase to confirm auth status before routing
    Store.onAuth(user => {
      // Only call the route on the very first auth check
      if (!initialRouteCalled) {
        route();
        initialRouteCalled = true;
      }
    });
  }

  // Route on hash change (when navigating between pages)
  window.addEventListener("hashchange", route);
  // Initialize on initial page load
  window.addEventListener("load", init);
})();