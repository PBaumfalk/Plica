/*!
 * PLICA – Formular einbetten
 * <div data-plica-form="https://formulare.example.de/f/kontakt"></div>
 * <script src="https://formulare.example.de/embed.js" async></script>
 * Passt die Höhe des iframes automatisch an. Nimmt nur Nachrichten
 * vom eigenen PLICA-Server und vom jeweiligen iframe an.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var origin;
  try {
    origin = new URL(script && script.src ? script.src : "", location.href).origin;
  } catch {
    return;
  }
  var frames = [];

  function mount(el) {
    if (el.getAttribute("data-plica-mounted")) return;
    var src = el.getAttribute("data-plica-form");
    if (!src) return;
    var url;
    try {
      url = new URL(src, origin);
    } catch {
      return;
    }
    if (url.origin !== origin) return; // nur Formulare dieses Servers
    url.searchParams.set("embed", "1");
    var iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.title = el.getAttribute("data-plica-title") || "Formular";
    iframe.loading = "lazy";
    iframe.setAttribute("allow", "clipboard-write");
    iframe.style.cssText = "display:block;width:100%;border:0;min-height:320px;height:" + (el.getAttribute("data-plica-height") || "640") + "px;transition:height .2s ease;color-scheme:normal";
    el.setAttribute("data-plica-mounted", "1");
    el.appendChild(iframe);
    frames.push(iframe);
  }

  function scan() {
    var els = document.querySelectorAll("[data-plica-form]");
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  window.addEventListener("message", function (ev) {
    if (ev.origin !== origin) return;
    var d = ev.data;
    if (!d || d.plica !== "resize" || typeof d.height !== "number") return;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === ev.source) {
        frames[i].style.height = Math.max(200, Math.min(20000, Math.ceil(d.height))) + "px";
      }
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
