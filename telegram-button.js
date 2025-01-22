// ==UserScript==
// @name         Telegram Button Injector
// @namespace    http://tampermonkey.net/
// @version      V1.2
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

  // Function to add the button
  function addButtonToForm() {
    // Wait until the form is available in the DOM
    const interval = setInterval(() => {
      const form = document.querySelector("#cdb_group form");
      if (form) {
        // Stop checking once the form is found
        clearInterval(interval);

        // Create the new button
        const button = document.createElement("button");
        button.id = "telegram-open-button";
        button.className = "btn btn-default bg-cyan-500 text-white";
        button.type = "button";
        button.innerHTML =
          '<i class="fas fa-paper-plane fa-fw" aria-hidden="true"></i> Öffne Telegram';
        button.style.marginLeft = "10px";

        // Add functionality to the button
        button.onclick = function () {
          GM_openInTab("https://web.telegram.org/a/#-1001944158000", {
            active: true,
          });
        };

        // Append the button to the form
        form.appendChild(button);
      }
    }, 500); // Check every 500ms
  }

  // Wait for the page to fully load before adding the button
  window.addEventListener("load", addButtonToForm);
})();
