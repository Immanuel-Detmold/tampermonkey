// ==UserScript==
// @name         Telegram Button Injector
// @namespace    http://tampermonkey.net/
// @version      V1.31
// @description  Adds a button to open Telegram Web within the specified form
// @author       You
// @match        https://immanuel-detmold.church.tools/?q=churchservice
// @icon         https://www.google.com/s2/favicons?sz=64&domain=church.tools
// @grant        GM_openInTab
// @downloadURL  https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/telegram-button.js
// @updateURL    https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/telegram-button.js
// ==/UserScript==

(function () {
  "use strict";

  const TARGET_URL = "https://immanuel-detmold.church.tools/?q=churchservice#AgendaView/";
  const BUTTON_ID = "telegram-open-button";

  // Function to add the button
  function addButton() {
    if (document.getElementById(BUTTON_ID)) return; // Prevent duplicates

    const form = document.querySelector("#cdb_group form");
    if (form) {
      const button = document.createElement("button");
      button.id = BUTTON_ID;
      button.className = "btn btn-default bg-cyan-500 text-white";
      button.type = "button";
      button.innerHTML =
        '<i class="fas fa-paper-plane fa-fw" aria-hidden="true"></i> Öffne Telegram';
      button.style.marginLeft = "10px";
      button.onclick = () => {
        GM_openInTab("https://web.telegram.org/a/#-1001944158000", { active: true });
      };
      form.appendChild(button);
      console.log("Telegram button added.");
    }
  }

  // Function to check URL and add button if it matches
  function checkAndAddButton() {
    if (window.location.href === TARGET_URL) {
      addButton();
    }
  }

  // Observe DOM changes to detect when the form is loaded
  const observer = new MutationObserver(() => {
    checkAndAddButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for initial load and URL changes
  window.addEventListener("load", checkAndAddButton);
  window.addEventListener("popstate", checkAndAddButton);
  window.addEventListener("hashchange", checkAndAddButton);
})();
