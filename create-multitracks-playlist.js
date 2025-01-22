// ==UserScript==
// @name         Create Multitracks Playlist
// @namespace    http://tampermonkey.net/
// @version      V1.0
// @description  Reads JSON data from clipboard and creates a Multitracks setlist.
// @author       You
// @match        https://immanuel-detmold.church.tools/?q=churchservice
// @match        https://www.multitracks.com/*
// @include      https://www.multitracks.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=multitracks.com
// @downloadURL  https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/create-multitracks-playlist.js
// @updateURL    https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/create-multitracks-playlist.js
// @grant        GM_openInTab
// @grant        GM_setClipboard
// ==/UserScript==

(async function () {
  "use strict";

  // Utility function: Wait until an element matching the given selector appears.
  async function waitForElementAsync(
    selector,
    context = document,
    intervalTime = 500
  ) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const element = context.querySelector(selector);
        if (element) {
          clearInterval(interval);
          resolve(element);
        }
      }, intervalTime);
    });
  }

  // Creates the setlist using the provided JSON data.
  async function handleSetlists(jsonData) {
    const setlistName = `${jsonData.date} - ${jsonData.time}`;

    const newSetlistButton = await waitForElementAsync(
      "#newSetlistSection a.btn"
    );
    newSetlistButton.click();

    const iframe = await waitForElementAsync("iframe.js-frame-add-setlist");
    if (!iframe) {
      console.error("Iframe not found");
      return;
    }

    const iframeDocument =
      iframe.contentDocument || iframe.contentWindow.document;
    if (!iframeDocument) {
      console.error("Unable to access iframe document");
      return;
    }

    const setlistNameInput = await waitForElementAsync(
      "input[placeholder='Enter Setlist Name']",
      iframeDocument
    );
    if (setlistNameInput) {
      console.log("Setlist name input found");
      setlistNameInput.focus();
      setlistNameInput.value = setlistName;
    } else {
      console.error("Setlist name input not found");
      return;
    }

    // Change the Date
    iframeDocument.querySelector("#datepickerValue").value = jsonData.date;

    const createSetlistButton = await waitForElementAsync(
      "a#lnkSave",
      iframeDocument
    );
    if (createSetlistButton) {
      createSetlistButton.click();
    } else {
      console.error("Create Setlist button not found");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 1 second

    await handleSongs(jsonData.songs);
  }

  // Adds songs from the JSON data.
  async function handleSongs(songs) {
    for (const [index, song] of songs.entries()) {
      await handleAddSong(song, index);
    }

    await saveSetlist();
  }

  // Add a song from JSON data
  async function handleAddSong(song, index) {
    if (!song.multitracks) {
      song.multitracks = song.pad;
    }
    console.log("SONG: ", song);

    // For first song do it differently
    if (index == 0) {
      // CLick on Add Song
      const addSongButton = await waitForElementAsync(
        "div.setlists-details--add-message div a"
      ); // Adjusted selector
      addSongButton.click();
    }

    // Click on Add Item
    document.querySelector("span.add-item").click();

    // Step 1: Click on the "Library" tab
    await clickTabBasedOnType(song.type);

    // Step 2: Click into the search input
    const searchInput = await waitForElementAsync(
      "input.setlists-details--song-search--input.js-add-item-song-search-input"
    );
    if (searchInput) {
      searchInput.focus();
      searchInput.value = ""; // Clear existing text

      // Type the multitracks name character by character
      for (const char of song.multitracks) {
        searchInput.value += char;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 5)); // Simulate typing delay
      }
      searchInput.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
      searchInput.dispatchEvent(
        new KeyboardEvent("keyup", { key: "Enter", bubbles: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait
    } else {
      console.error("Search input not found.");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait
    // Step 3: Wait for and click the song link
    await clickSongSpanByText(song.multitracks);

    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait

    // Step 4: Select the key
    //if(song.type == "song") {
    await selectKey(song.key);

    // Setp 5: If Pad also select tempo
    if (song.type == "pad") {
      await handleSongTempo(song);
    }
    //}
    //else {
    //alert("Clicking: " + song.key.toUpperCase())
    //  document.querySelector(`#${song.key.toUpperCase()}`).click()
    //}

    // Step 5: Add the song to the setlist
    const selector =
      song.type === "song"
        ? "a.js-add-song-save"
        : song.type === "pad"
        ? ".js-add-pad-save"
        : null;
    if (!selector) return console.error("Unknown type: ", song.type);

    const addButton = await waitForElementAsync(selector);
    addButton
      ? addButton.click()
      : console.error(`Add button for ${song.type} not found.`);
    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait
  }

  async function clickTabBasedOnType(type) {
    let tab;

    // Determine the correct tab based on the type
    if (type === "song") {
      tab = document.querySelector("li[data-container='library'] a.tab-filter");
    } else if (type === "pad") {
      tab = document.querySelector("li[data-container='pads'] a.tab-filter");
    }

    // Click the tab if found
    if (tab) {
      tab.click();
    } else {
      console.error(`${type} tab not found.`);
    }
  }

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

    // Select the base key
    const keyButton = document.querySelector(`#${key[0].toUpperCase()}`);
    if (keyButton) {
      keyButton.click();
    } else {
      console.warn(
        `Key button not found for base key: "${key[0].toUpperCase()}"`
      );
      return;
    }

    // Handle accidentals
    const accidental = key.length > 1 ? key[1] : null;

    if (accidental === "#" && sharpRadio) {
      sharpRadio.click();
    } else if (accidental === "b" && flatRadio) {
      flatRadio.click();
    } else if (accidental) {
      console.error(`Invalid accidental: "${accidental}"`);
    }
  }

  async function handleSongTempo(song) {
    if (song.tempo && song.tempo !== "") {
      // Click the switch
      const switchElement = document.querySelector(
        "div:nth-child(4) > .onoff-switch > .onoff-switch--label > .onoff-switch--inner"
      );
      if (switchElement) {
        switchElement.click();
      } else {
        console.error("Switch element not found.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 500ms before re-checking
      // Set the tempo
      const bpmInput = document.querySelector("#bpmPad");
      if (bpmInput) {
        bpmInput.value = parseInt(song.tempo);
        bpmInput.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        console.error("BPM input element not found.");
      }
    }
  }

  async function clickSongSpanByText(targetText) {
    console.log("Searching for the target span...");
    const timeout = Date.now() + 10000; // 10 seconds timeout

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

      console.log(`Still searching for span with text: "${targetText}"`);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms before re-checking
    }

    console.error(
      `Target span with text "${targetText}" not found within timeout.`
    );
  }

  // Saves the setlist to the cloud.
  async function saveSetlist() {
    const saveToCloudButton = await waitForElementAsync(
      "[role='link'][name='Save to Cloud']"
    );
    saveToCloudButton.click();
  }

  // Page Routing Logic
  async function routePage() {
    const clipboardData = await navigator.clipboard.readText();
    if (
      window.location.href.includes(
        "https://immanuel-detmold.church.tools/?q=churchservice"
      )
    ) {
      addPlaylistButton();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    } else if (
      window.location.href.includes(
        "https://www.multitracks.com/premium/setlists/?setlistSelection="
      ) ||
      window.location.href === "https://www.multitracks.com/premium/setlists/"
    ) {
      try {
        if (clipboardData) {
          const confirmed = confirm("Set automatisch erstellen?");
          if (confirmed) {
            const jsonData = JSON.parse(clipboardData);
            await handleSetlists(jsonData);
          }
        } else {
          alert("Keine Daten in der Zwischenablage gefunden.");
        }
      } catch (error) {
        alert(
          "Fehler beim Lesen der Zwischenablage oder JSON-Daten: " +
            error.message
        );
        console.error("Clipboard or JSON error:", error);
      }
    } else if (
      window.location.href.includes(
        "https://www.multitracks.com/premium/setlists/details.aspx?setlistID"
      )
    ) {
      if (clipboardData) {
        try {
          const jsonData = JSON.parse(clipboardData);
          const confirmed = confirm("Songs automatisch einfügen?");
          if (confirmed) {
            await handleSongs(jsonData.songs);
          }
        } catch (error) {
          console.error("Error parsing JSON data:", error);
        }
      } else {
        console.error("No data entered in prompt.");
      }
    }
  }

  // Inject "Multitracks Playlist" button on ChurchTools page.
  function addPlaylistButton() {
    waitForElementAsync("#cdb_group form").then((form) => {
      const button = document.createElement("button");
      button.id = "multitracks-playlist-button";
      button.className = "btn btn-secondary bg-amber-500 text-white";
      button.type = "button";
      button.innerHTML =
        '<i class="fas fa-music fa-fw" aria-hidden="true"></i> Multitracks Playlist';
      button.style.marginLeft = "10px";

      button.onclick = function () {
        GM_openInTab("https://www.multitracks.com/premium/setlists/", {
          active: true,
        });
      };

      form.appendChild(button);
    });
  }

  // Initialize the script.
  window.addEventListener("load", routePage);
})();
