// ==UserScript==
// @name         Create Multitracks Playlist
// @namespace    http://tampermonkey.net/
// @version      V1.3.5
// @description  Reads JSON data from clipboard and creates a Multitracks setlist.
// @author       Ronny S
// @match        https://immanuel-detmold.church.tools/?q=churchservice
// @match        https://www.multitracks.com/*
// @include      https://www.multitracks.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=multitracks.com
// @downloadURL  https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/create-multitracks-playlist.js
// @updateURL    https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/create-multitracks-playlist.js
// @grant        GM_openInTab
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  "use strict";

  // Global variable to store the selected arrangement
  let selectedArrangement = null;

  /** ---------------------------------------------------------------------
   *                     1) HELPER & UTILITY FUNCTIONS
   * ----------------------------------------------------------------------
   */

  /**
   * Utility function: Wait until an element matching the given selector appears in the DOM.
   * @param {string} selector - The CSS selector of the target element.
   * @param {Node} [context=document] - The DOM node to search within. Defaults to the entire document.
   * @param {number} [intervalTime=500] - Time in milliseconds between each check.
   * @returns {Promise<Element>} - A promise that resolves with the found element.
   */
  async function waitForElementAsync(
    selector,
    context = document,
    intervalTime = 500
  ) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        // console.log(`Searching for element: ${selector}`);
        const element = context.querySelector(selector);
        if (element) {
          clearInterval(interval);
          resolve(element);
        }
      }, intervalTime);
    });
  }

  /**
   * Clicks on a <span> with class "u-ellipsis" that exactly matches the given text.
   * Useful for selecting the correct song from search results.
   * @param {string} targetText - The text to match in the span.
   * @param {number} [timeoutMs=10000] - Timeout in milliseconds to keep searching.
   */
  async function clickSongSpanByText(targetText, timeoutMs = 10000) {
    console.log("Searching for the target span...");
    const timeout = Date.now() + timeoutMs; // e.g. 10 seconds

    while (Date.now() < timeout) {
      // Find all spans with the class "u-ellipsis"
      const spans = document.querySelectorAll("span.u-ellipsis");

      // Loop through the spans and find the one with the matching text
      for (const span of spans) {
        if (
          span.textContent.trim().toLowerCase() ===
          targetText.toLowerCase().trim()
        ) {
          span.click(); // Click the span
          console.log(`Clicked on span with text: ${targetText}`);
          return;
        }
      }

      // Wait 500ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.error(
      `Target span with text "${targetText}" not found within timeout.`
    );
  }

  /** ---------------------------------------------------------------------
   *            2) MULTITRACKS SETLIST CREATION & SONG INSERTION
   * ----------------------------------------------------------------------
   */

  /**
   * Creates a new setlist using the provided JSON data (clipboard).
   * @param {Object} jsonData - Parsed JSON data with structure { date, time, songs }
   */
  async function handleSetlists(jsonData) {
    const setlistName = `${jsonData.date} - ${jsonData.time}`;
    console.log("Creating setlist with name:", setlistName);

    // 1) Click the "New Setlist" button (exists in #newSetlistSection)
    const newSetlistButton = await waitForElementAsync(
      "#newSetlistSection2 a.btn"
    );
    newSetlistButton.click();

    // 2) Wait for the "Add Setlist" iframe to appear
    const iframe = await waitForElementAsync("iframe.js-frame-add-setlist");
    if (!iframe) {
      console.error("Iframe not found for adding new setlist.");
      return;
    }

    const iframeDocument =
      iframe.contentDocument || iframe.contentWindow.document;
    if (!iframeDocument) {
      console.error("Unable to access 'Add Setlist' iframe document.");
      return;
    }

    // 3) Fill in the setlist name
    const setlistNameInput = await waitForElementAsync(
      "input[placeholder='Enter Setlist Name']",
      iframeDocument
    );
    if (!setlistNameInput) {
      console.error("Setlist name input not found inside iframe.");
      return;
    }
    setlistNameInput.focus();
    setlistNameInput.value = setlistName;

    // 4) Set the setlist date
    const datepicker = iframeDocument.querySelector("#datepickerValue");
    if (datepicker) {
      datepicker.value = jsonData.date;
    }

    // 5) Click the "Create Setlist" button
    const createSetlistButton = await waitForElementAsync(
      "a#lnkSave",
      iframeDocument
    );
    if (!createSetlistButton) {
      console.error("Create Setlist button not found in iframe.");
      return;
    }
    createSetlistButton.click();

    // 6) Wait a moment, then add songs
    await new Promise((resolve) => setTimeout(resolve, 500));
    await handleSongs(jsonData.songs);
  }

  /**
   * Iterates over each song in the JSON data and adds them to the setlist.
   * @param {Array} songs - Array of song objects: [{ multitracks, key, tempo, type }, ...]
   */
  async function handleSongs(songs) {
    for (const [index, song] of songs.entries()) {
      await handleAddSong(song, index);
    }

    // Finally, save the setlist to the cloud
    await saveSetlist();
  }

  /**
   * Handles the process of adding a single song/pad to the current setlist.
   * @param {Object} song - The song object containing { multitracks, key, tempo, type, pad }.
   * @param {number} index - The song's index in the array.
   */
  async function handleAddSong(song, index) {
    // If the song property doesn't exist, use the "pad" property instead.
    if (!song.multitracks) {
      song.multitracks = song.pad;
      song.type = "pad";
    }
    console.log("Adding song/pad:", song);

    // 1) For the first song, click "Add Song". For subsequent songs, click "Add Item".
    if (index === 0) {
      const addSongButton = await waitForElementAsync(
        "div.setlists-details--add-message div a"
      );
      addSongButton.click();
    } else {
      const addItemButton = await waitForElementAsync("span.add-item");
      addItemButton.click();
    }

    // 2) Click the correct tab: library (song) or pads (ambient pad)
    await clickTabBasedOnType(song.type);

    // 3) Type into the search input
    const searchInput = await waitForElementAsync(
      "input.setlists-details--song-search--input.js-add-item-song-search-input"
    );
    if (!searchInput) {
      console.error("Search input not found for adding a song/pad.");
      return;
    }

    // Clear existing text
    searchInput.focus();
    searchInput.value = "";

    // Type the multitracks name character by character
    for (const char of song.multitracks) {
      searchInput.value += char;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 5)); // Simulate typing delay
    }

    // Dispatch enter to trigger search
    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    searchInput.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true })
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4) Wait for and click the matching song link
    await clickSongSpanByText(song.multitracks);

    // 5) Select the key
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait briefly

    // First, select the arrangement
    await selectArrangement();
    
    // Wait a moment for the arrangement selection to process
    await new Promise((resolve) => setTimeout(resolve, 300));

    await selectKey(song.key);

    // 6) If it's a pad, optionally set the tempo
    if (song.type === "pad") {
      await handleSongTempo(song);
    }

    // 7) Click the "Add" button for the song or pad
    let selector = null;
    if (song.type === "song") selector = "a.js-add-song-save";
    else if (song.type === "pad") selector = ".js-add-pad-save";

    if (!selector) {
      console.error("Unknown song type:", song.type);
      return;
    }

    const addButton = await waitForElementAsync(selector);
    if (addButton) addButton.click();
    else console.error(`Add button for ${song.type} not found.`);

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  /**
   * Clicks on either the "Library" or "Pads" tab, depending on the provided type.
   * @param {string} type - "song" or "pad"
   */
  async function clickTabBasedOnType(type) {
    let tabSelector = null;
    if (type === "song") {
      tabSelector = "li[data-container='library'] a.tab-filter";
    } else if (type === "pad") {
      tabSelector = "li[data-container='pads'] a.tab-filter";
    }

    if (tabSelector) {
      const tab = await waitForElementAsync(tabSelector);
      if (tab) tab.click();
      else console.error(`${type} tab not found.`);
    }
  }

  /**
   * Selects the arrangement based on the global selectedArrangement or falls back to "Immanuel"/"Default".
   * @returns {Promise<void>}
   */
  async function selectArrangement() {
    // Wait for the arrangement dropdown to appear
    const arrangementDropdown = await waitForElementAsync(
      "select.js-add-song-arrangement"
    );
    
    if (!arrangementDropdown) {
      console.warn("Arrangement dropdown not found. Skipping arrangement selection.");
      return;
    }

    let selectedOption = null;

    // If user selected an arrangement from the dialog, use that
    if (selectedArrangement) {
      selectedOption = Array.from(arrangementDropdown.options).find(
        (option) => option.textContent.trim().toLowerCase() === selectedArrangement.toLowerCase()
      );
      
      // If the selected arrangement is not found, always fall back to Default
      if (!selectedOption) {
        console.warn(`Arrangement "${selectedArrangement}" not found, falling back to Default`);
        selectedOption = Array.from(arrangementDropdown.options).find(
          (option) => option.textContent.trim().toLowerCase() === "default"
        );
      }
    }

    if (selectedOption) {
      // Select the found option
      arrangementDropdown.value = selectedOption.value;
      console.log("Selected arrangement:", selectedOption.textContent.trim());
    } else {
      // Otherwise, select "Default" by value "0"
      arrangementDropdown.value = "0";
      console.log("Selected arrangement: Default (by value)");
    }

    // Trigger change event to ensure the selection is registered
    arrangementDropdown.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Selects the given key on the Multitracks key selector.
   * @param {string} key - e.g. "C", "Gb", "D#"
   */
  async function selectKey(key) {
    if (!key) {
      console.warn("No key provided. Skipping key selection.");
      return;
    }

    

    // Deselect accidentals if pressed
    const sharpRadio = document.querySelector("#radio9");
    const flatRadio = document.querySelector("#radio10");

    if (sharpRadio && sharpRadio.checked) sharpRadio.click();
    if (flatRadio && flatRadio.checked) flatRadio.click();

    // Select the base key (e.g. "C")
    const baseKey = key[0].toUpperCase(); // e.g. "C"
    const keyButton = document.querySelector(`#${baseKey}`);
    if (!keyButton) {
      console.warn(`Key button not found for base key: "${baseKey}"`);
      return;
    }
    keyButton.click();

    // Handle accidentals (e.g. "b", "#")
    const accidental = key.length > 1 ? key[1] : null;
    if (accidental === "#" && sharpRadio) {
      sharpRadio.click();
    } else if (accidental === "b" && flatRadio) {
      flatRadio.click();
    } else if (accidental) {
      console.error(`Invalid accidental: "${accidental}"`);
    }
  }

  /**
   * If a pad has a tempo value, enable the tempo switch and set the BPM.
   * @param {Object} song - The song/pad data, potentially containing a "tempo" property.
   */
  async function handleSongTempo(song) {
    if (!song.tempo || song.tempo === "") return;

    // Click the switch for tempo
    const switchElement = document.querySelector(
      "div:nth-child(4) > .onoff-switch > .onoff-switch--label > .onoff-switch--inner"
    );
    if (switchElement) {
      switchElement.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else {
      console.error("Switch element for tempo not found.");
      return;
    }

    // Set the BPM
    const bpmInput = document.querySelector("#bpmPad");
    if (bpmInput) {
      bpmInput.value = parseInt(song.tempo, 10);
      bpmInput.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      console.error("BPM input element not found for pad tempo.");
    }
  }

  /**
   * Saves the current setlist to the cloud by clicking the "Save to Cloud" button.
   */
  async function saveSetlist() {
    const saveToCloudButton = await waitForElementAsync(".js-save-setlist");
    if (saveToCloudButton) {
      saveToCloudButton.click();
      console.log("Setlist saved to cloud.");
    } else {
      console.error("Could not find the 'Save to Cloud' button.");
    }
  }

  /** ---------------------------------------------------------------------
   *         3) BUTTONS & UI FOR AUTOMATIC SETLIST / SONG ADDITION
   * ----------------------------------------------------------------------
   */

  /**
   * Shows a dialog to select arrangement (Immanuel or Jugend)
   * @returns {Promise<string|null>} - The selected arrangement name or null if cancelled
   */
  async function showArrangementDialog() {
    return new Promise((resolve) => {
      // Create overlay
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "10000";

      // Create dialog
      const dialog = document.createElement("div");
      dialog.style.backgroundColor = "white";
      dialog.style.padding = "30px";
      dialog.style.borderRadius = "8px";
      dialog.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
      dialog.style.textAlign = "center";
      dialog.style.minWidth = "300px";

      // Title
      const title = document.createElement("h2");
      title.textContent = "Wähle Arrangement";
      title.style.marginBottom = "20px";
      title.style.color = "#333";
      dialog.appendChild(title);

      // Button container
      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.gap = "15px";
      buttonContainer.style.justifyContent = "center";

      // Immanuel button
      const immanuelBtn = document.createElement("button");
      immanuelBtn.textContent = "Immanuel";
      immanuelBtn.className = "btn";
      immanuelBtn.style.backgroundColor = "orange";
      immanuelBtn.style.color = "white";
      immanuelBtn.style.border = "none";
      immanuelBtn.style.padding = "10px 20px";
      immanuelBtn.style.borderRadius = "4px";
      immanuelBtn.style.cursor = "pointer";
      immanuelBtn.style.fontSize = "16px";
      immanuelBtn.addEventListener("mouseenter", () => {
        immanuelBtn.style.backgroundColor = "darkorange";
      });
      immanuelBtn.addEventListener("mouseleave", () => {
        immanuelBtn.style.backgroundColor = "orange";
      });
      immanuelBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve("Immanuel");
      };

      // Jugend button
      const jugendBtn = document.createElement("button");
      jugendBtn.textContent = "Jugend";
      jugendBtn.className = "btn";
      jugendBtn.style.backgroundColor = "orange";
      jugendBtn.style.color = "white";
      jugendBtn.style.border = "none";
      jugendBtn.style.padding = "10px 20px";
      jugendBtn.style.borderRadius = "4px";
      jugendBtn.style.cursor = "pointer";
      jugendBtn.style.fontSize = "16px";
      jugendBtn.addEventListener("mouseenter", () => {
        jugendBtn.style.backgroundColor = "darkorange";
      });
      jugendBtn.addEventListener("mouseleave", () => {
        jugendBtn.style.backgroundColor = "orange";
      });
      jugendBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve("Jugend");
      };

      // Default button
      const defaultBtn = document.createElement("button");
      defaultBtn.textContent = "Default";
      defaultBtn.className = "btn";
      defaultBtn.style.backgroundColor = "orange";
      defaultBtn.style.color = "white";
      defaultBtn.style.border = "none";
      defaultBtn.style.padding = "10px 20px";
      defaultBtn.style.borderRadius = "4px";
      defaultBtn.style.cursor = "pointer";
      defaultBtn.style.fontSize = "16px";
      defaultBtn.addEventListener("mouseenter", () => {
        defaultBtn.style.backgroundColor = "darkorange";
      });
      defaultBtn.addEventListener("mouseleave", () => {
        defaultBtn.style.backgroundColor = "orange";
      });
      defaultBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve("Default");
      };

      buttonContainer.appendChild(immanuelBtn);
      buttonContainer.appendChild(jugendBtn);
      buttonContainer.appendChild(defaultBtn);
      dialog.appendChild(buttonContainer);

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Close on overlay click
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  /**
   * Inserts the "Set automatisch erstellen" button (in #newSetlistSection),
   * and triggers `handleSetlists` from clipboard data when clicked.
   */
  const insertCreateSetlistButton = () => {

    const section = document.getElementById("newSetlistSection2");
    if (!section) return false; // No section found

    // Prevent duplicate insertion
    if (section.querySelector('[data-modal-target="automatisch"]')) {
      return true; // Already added
    }

    // Create the button element
    const btn = document.createElement("a");
    btn.className = "btn";
    btn.setAttribute("data-modal-target", "automatisch");
    btn.textContent = "Set automatisch erstellen";

    // Basic styling
    btn.style.backgroundColor = "orange";
    btn.style.border = "none";

    // Hover effects
    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = "darkorange";
      btn.style.color = "white";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "orange";
      btn.style.color = "";
    });

    // On click: read JSON from clipboard and call handleSetlists
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log('"Set automatisch erstellen" button clicked.');

      try {
        const clipboardData = await navigator.clipboard.readText();
        if (!clipboardData) {
          alert("Keine JSON-Daten in der Zwischenablage!");
          return;
        }
        const jsonData = JSON.parse(clipboardData);
        await handleSetlists(jsonData);
      } catch (err) {
        alert("Fehler beim Lesen der Zwischenablage oder Parsing JSON: " + err);
        console.error("Clipboard/JSON error:", err);
        const data = prompt("Füge die Daten hier manuell ein");
        const jsonData = JSON.parse(data);
        await handleSetlists(jsonData);
      }
    });

    // Append to the #newSetlistSection2
    section.appendChild(btn);
    console.log('"Set automatisch erstellen" button added.');
    return true;
  };

  /**
   * Inserts the "Song automatisch einfügen" button into the .premium--content--header div
   * and triggers `handleSongs` from clipboard data when clicked.
   */
  const insertAddSongsButton = () => {
    const headerDiv = document.querySelector(".premium--content--header");
    if (!headerDiv) return false;

    // Check if the button is already there
    if (headerDiv.querySelector('[data-button="song-automatisch-einfuegen"]')) {
      return true; // Already added
    }

    // Create container if not existing
    let buttonContainer = headerDiv.querySelector(".custom-button-container");
    if (!buttonContainer) {
      buttonContainer = document.createElement("div");
      buttonContainer.className = "custom-button-container";
      buttonContainer.style.display = "flex";
      buttonContainer.style.gap = "10px";
      buttonContainer.style.marginLeft = "auto";

      // Insert the container before the #saveSection (if available)
      const saveSection = document.getElementById("saveSection");
      if (saveSection) {
        headerDiv.insertBefore(buttonContainer, saveSection);
      } else {
        headerDiv.appendChild(buttonContainer);
      }
      console.log("Button container created and aligned to the right.");
    }

    // Move the existing "Edit Setlist" button (if found) into the container
    const editSetlistBtn = document.getElementById("editSetlistBtn");
    if (editSetlistBtn && !buttonContainer.contains(editSetlistBtn)) {
      buttonContainer.appendChild(editSetlistBtn);
      console.log('"Edit Setlist" button moved to the button container.');
    }

    // Create "Song automatisch einfügen" button
    const newButton = document.createElement("a");
    newButton.className = "btn";
    newButton.textContent = "Songs automatisch einfügen";
    newButton.href = "#";
    newButton.setAttribute("data-button", "song-automatisch-einfuegen");

    // Basic styling
    newButton.style.backgroundColor = "orange";
    newButton.style.border = "none";
    newButton.style.display = "inline-flex";
    newButton.style.alignItems = "center";
    newButton.style.justifyContent = "center";
    newButton.style.padding = "8px 12px";
    newButton.style.lineHeight = "1.2";

    // Hover effects
    newButton.addEventListener("mouseenter", () => {
      newButton.style.backgroundColor = "darkorange";
    });
    newButton.addEventListener("mouseleave", () => {
      newButton.style.backgroundColor = "orange";
    });

    // On click: show arrangement dialog, then read JSON from clipboard and call handleSongs
    newButton.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log('"Song automatisch einfügen" button clicked.');

      // Show arrangement selection dialog first
      selectedArrangement = await showArrangementDialog();
      if (!selectedArrangement) {
        console.log("Arrangement selection cancelled.");
        return;
      }
      console.log("Selected arrangement:", selectedArrangement);

      try {
        const clipboardData = await navigator.clipboard.readText();
        if (!clipboardData) {
          alert("Keine JSON-Daten in der Zwischenablage!");
          return;
        }
        const jsonData = JSON.parse(clipboardData);
        if (!jsonData.songs || !Array.isArray(jsonData.songs)) {
          alert("JSON-Daten enthalten keine gültige 'songs'-Eigenschaft!");
          return;
        }
        await handleSongs(jsonData.songs);
      } catch (err) {
        alert("Fehler beim Lesen der Zwischenablage oder Parsing JSON: " + err);
        console.error("Clipboard/JSON error:", err);
        const data = prompt("Füge die Daten hier manuell ein");
        const jsonData = JSON.parse(data);
        await handleSongs(jsonData.songs);
      } finally {
        // Reset selected arrangement after processing
        selectedArrangement = null;
      }
    });

    // Append the button to the container
    buttonContainer.appendChild(newButton);
    console.log('"Song automatisch einfügen" button added successfully.');
    return true;
  };

  /** ---------------------------------------------------------------------
   *         4) CHURCHTOOLS: ADD "MULTITRACKS PLAYLIST" BUTTON
   * ----------------------------------------------------------------------
   */
  const TARGET_URL =
    "https://immanuel-detmold.church.tools/?q=churchservice#AgendaView/";
  const BUTTON_ID = "multitracks-playlist-button";

  /**
   * Injects a "Multitracks Playlist" button on the ChurchTools page to open
   * the Multitracks setlists in a new tab.
   */
  const addPlaylistButton = () => {
    if (
      window.location.href !== TARGET_URL ||
      document.getElementById(BUTTON_ID)
    )
      return;
    const form = document.querySelector("#cdb_group form");
    if (form) {
      const btn = document.createElement("button");
      btn.id = BUTTON_ID;
      btn.className = "btn btn-secondary bg-amber-500 text-white";
      btn.type = "button";
      btn.innerHTML =
        '<i class="fas fa-music fa-fw" aria-hidden="true"></i> Multitracks Playlist';
      btn.style.marginLeft = "10px";

      // Clicking it opens the Multitracks page in a new tab
      btn.onclick = () => {
        GM_openInTab("https://www.multitracks.com/premium/setlists/", {
          active: true,
        });
      };

      form.appendChild(btn);
      console.log('"Multitracks Playlist" button added to ChurchTools page.');
    }
  };

  /** ---------------------------------------------------------------------
   *         5) SCRIPT INITIALIZATION & EVENT HOOKS
   * ----------------------------------------------------------------------
   */

  /**
   * Inserts the necessary buttons on Multitracks pages depending on the URL.
   * Observes DOM changes if elements are dynamically loaded.
   */
  const routePage = async () => {
    const currentUrl = window.location.href;

    // If on setlists page but not details.aspx -> Insert "Set automatisch erstellen"
    const isSetlistsPage =
      currentUrl.includes("https://www.multitracks.com/premium/setlists/") &&
      !currentUrl.includes(
        "https://www.multitracks.com/premium/setlists/details.aspx"
      );
    if (isSetlistsPage) {
      if (!insertCreateSetlistButton()) {
        // If button not added, observe the DOM
        const observer = new MutationObserver(() => {
          if (insertCreateSetlistButton()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }

    // If on details.aspx -> Insert "Song automatisch einfügen"
    const isDetailsPage = currentUrl.includes(
      "https://www.multitracks.com/premium/setlists/details.aspx"
    );
    if (isDetailsPage) {
      if (!insertAddSongsButton()) {
        // If button not added, observe the DOM
        const observer = new MutationObserver(() => {
          if (insertAddSongsButton()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  };

  // 1) Add the "Multitracks Playlist" button on ChurchTools page
  ["load", "popstate", "hashchange"].forEach((event) =>
    window.addEventListener(event, addPlaylistButton)
  );
  new MutationObserver(addPlaylistButton).observe(document.body, {
    childList: true,
    subtree: true,
  });
  addPlaylistButton(); // initial attempt

  // 2) Insert the relevant Multitracks buttons once the document is fully loaded
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      routePage();
    }
  });
})();
