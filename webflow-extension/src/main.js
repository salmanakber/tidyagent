/**
 * tidyAgent Designer Extension bootstrap.
 * Opens the hosted Webflow app home inside the Designer (with optional siteId).
 */
(function () {
  var app = "https://agent.tidyflowapp.com/webflow";
  var params = new URLSearchParams();
  params.set("embed", "1");

  function go() {
    location.replace(app + "?" + params.toString());
  }

  try {
    if (window.webflow) {
      if (typeof window.webflow.setExtensionSize === "function") {
        window.webflow.setExtensionSize({ width: 480, height: 720 });
      }
      if (typeof window.webflow.getSiteInfo === "function") {
        window.webflow
          .getSiteInfo()
          .then(function (info) {
            if (info && info.siteId) params.set("siteId", info.siteId);
            go();
          })
          .catch(go);
        return;
      }
    }
  } catch (error) {
    /* fall through */
  }
  go();
})();
