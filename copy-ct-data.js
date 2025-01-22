// ==UserScript==
// @name         CT Daten kopieren
// @namespace    http://tampermonkey.net/
// @version      V1.2
// @description  Fügt einen Button "Song Daten kopieren" ein, der:
// @author       You
// @match        https://immanuel-detmold.church.tools/?q=churchservice
// @downloadURL  https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/copy-ct-data.js
// @updateURL    https://raw.githubusercontent.com/Immanuel-Detmold/tampermonkey/main/copy-ct-data.js
// @grant        GM.setClipboard
// ==/UserScript==

(function () {
  "use strict";

  const baseUrl = "https://immanuel-detmold.church.tools";

  // --- Toast CSS & Function ---
  const style = document.createElement("style");
  style.textContent = `
  .custom-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #323232;
    color: #fff;
    padding: 10px 20px;
    border-radius: 5px;
    opacity: 0;
    transition: opacity 0.5s ease;
    z-index: 9999;
    font-family: sans-serif;
  }
  .custom-toast.show {
    opacity: 1;
  }
`;
  document.head.appendChild(style);

  function showToast(message, duration = 3000) {
      const toast = document.createElement("div");
      toast.className = "custom-toast";
      toast.textContent = message;
      document.body.appendChild(toast);
      // Force reflow so that transition takes effect
      void toast.offsetWidth;
      toast.classList.add("show");

      setTimeout(() => {
          toast.classList.remove("show");
          setTimeout(() => {
              document.body.removeChild(toast);
          }, 500);
      }, duration);
  }

  // --- Utility: Parse key string into key & tempo ---
  function parseKeyTempo(keyString) {
      keyString = keyString.trim();
      if (keyString.includes("·")) {
          const parts = keyString.split("·");
          const key = parts[0].trim().toLowerCase();
          let tempo = parts[1] ? parts[1].replace("bpm", "").trim() : "";
          return { key, tempo };
      } else {
          return { key: keyString.toLowerCase(), tempo: "" };
      }
  }

  // --- Extract Basic Song Data from the Page Table ---
  function extractSongs() {
      const rows = document.querySelectorAll("tbody.ui-sortable tr.data");
      const songs = [];

      rows.forEach((row) => {
          const descriptionCell = row.querySelector('td[data-field="bezeichnung"]');
          if (descriptionCell && descriptionCell.textContent.includes("Song:")) {
              const songLink = descriptionCell.querySelector("a.view-song");
              let title = songLink ? songLink.textContent.trim() : "Unknown Title";
              title = title.replace(" - Aktive Songs", "").toLowerCase();

              const songId = songLink
              ? songLink.getAttribute("data-song-id")
              : "Unknown";

              const keySpan = descriptionCell.querySelector(
                  "span.pull-right.text-basic-secondary"
              );
              let keyString = keySpan ? keySpan.textContent.trim() : "Unknown";
              keyString = keyString.replace(/\s+/g, " ").trim();
              const { key, tempo } = parseKeyTempo(keyString);

              const responsibleCell = row.querySelector(
                  'td[data-field="responsible"]'
              );
              const responsible = responsibleCell
              ? responsibleCell.textContent.trim().toLowerCase()
              : "Unknown";

              songs.push({
                  id: songId,
                  title: title,
                  key: key,
                  tempo: tempo,
                  responsible: responsible,
              });
          }
      });

      return songs;
  }

  // --- API Call: Fetch Song Data using Existing Session ---
  async function getSongData(songID) {
      const url = `${baseUrl}/api/songs/${songID}`;
      try {
          const response = await fetch(url, {
              method: "GET",
              headers: {
                  accept: "application/json",
              },
              credentials: "include",
          });
          if (!response.ok) {
              throw new Error(`Error: ${response.status} ${response.statusText}`);
          }
          return await response.json();
      } catch (error) {
          console.error(`Failed to fetch data for song ${songID}:`, error);
          return null;
      }
  }

  // --- Extract Multitracks Song Name from API Response Data ---
  function getMultitracksName(songData) {
      if (
          !songData ||
          !songData.data ||
          !songData.data.arrangements ||
          !songData.data.arrangements.length
      ) {
          return null;
      }

      const arrangements = songData.data.arrangements;
      for (const arrangement of arrangements) {
          if (arrangement.links && Array.isArray(arrangement.links)) {
              for (const link of arrangement.links) {
                  if (link.name) {
                      const normalized = link.name.toLowerCase().trim();
                      // Regex to match variations like "multitracks: songname", allowing optional spaces.
                      const regex = /multi\s*tracks?\s*:\s*(.+)/i;
                      const match = normalized.match(regex);
                      if (match && match[1]) {
                          return match[1].trim().toLowerCase();
                      }
                  }
              }
          }
      }
      return null;
  }

  // --- Extract Date and Time from Legend ---
  function extractDateTime() {
      const legend = document.querySelector("legend.hoveractor");
      if (!legend) {
          return { date: null, time: null };
      }
      // The legend text might look like: "24.01.2025 19:00 - Ablaufplan Gebetsabend - Entwurf"
      // We'll extract date and time from the beginning.
      const text = legend.textContent.trim();
      // Regex to capture date and time:
      //   Date: two digits, dot, two digits, dot, four digits (e.g., 24.01.2025)
      //   Time: two digits, colon, two digits (e.g., 19:00)
      const regex = /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/;
      const match = text.match(regex);
      if (match) {
          return { date: match[1].trim(), time: match[2].trim() };
      }
      return { date: null, time: null };
  }

  // Function to modify the songs list
  function modifySongsList(data) {
      const firstSong = data.songs[0];

      // Insert the default pad at the beginning only if the first song has no multitracks

      // Process the rest of the list
      for (let i = 0; i < data.songs.length; i++) {
          const song = data.songs[i];

          // Verify tempo
          const tempo = parseFloat(song.tempo);
          if (isNaN(tempo) || tempo < 0 || tempo > 200 || song.tempo === "4/4") {
              song.tempo = "";
          }

          // Determine type property
          song.type = song.multitracks ? "song" : "pad";

          // Add a pad property if multitracks is null
          if (song.multitracks === null) {
              song.pad = "Celestial Pads";
          } else {
              // Insert a new pad object after the current song if it has multitracks
              const padObject = {
                  id: "",
                  title: "",
                  key: song.key,
                  tempo: song.tempo,
                  responsible: "",
                  multitracks: "Celestial Pads",
                  type: "pad",
              };
              data.songs.splice(i + 1, 0, padObject);
              i++; // Skip the newly added pad object
          }
      }

      // Add Pad in beginning, if multitracks in first song
      if (firstSong.multitracks) {
          const defaultPad = {
              id: "",
              title: "",
              key: firstSong.key,
              tempo: firstSong.tempo,
              responsible: "",
              multitracks: "Celestial Pads",
              type: "pad",
          };
          data.songs.unshift(defaultPad);
      }

      return data;
  }


  // --- Run Extraction Process ---
  async function runExtraction() {
      const songs = extractSongs();

      // For each song, fetch its full data to extract multitracks name.
      for (let song of songs) {
          if (song.id && song.id !== "Unknown") {
              const songApiData = await getSongData(song.id);
              const multiName = getMultitracksName(songApiData);
              song.multitracks = multiName ? multiName : null;
          } else {
              song.multitracks = null;
          }
      }

      // Extract date and time from the legend.
      const { date, time } = extractDateTime();

      // Create the final JSON object.
      let result = {
          date: date,
          time: time,
          songs: songs,
      };

      result = modifySongsList(result);
      const jsonString = JSON.stringify(result, null, 2);
      try {
          await GM.setClipboard(jsonString, "text");
          showToast("Song- und Legend-Daten wurden in die Zwischenablage kopiert!");
      } catch (err) {
          showToast("Fehler beim Kopieren der Daten!");
          console.error("Clipboard error:", err);
      }
  }

  // --- Button Injection ---
  function addButtonToForm() {
      const interval = setInterval(() => {
          const form = document.querySelector("#cdb_group form"); // Adjust selector if needed.
          if (form) {
              clearInterval(interval);

              const button = document.createElement("button");
              button.id = "song-data-copy-button";
              button.className = "btn btn-default bg-cyan-500 text-white";
              button.type = "button";
              button.innerHTML =
                  '<i class="fas fa-copy fa-fw" aria-hidden="true"></i> Song Daten kopieren';
              button.style.marginLeft = "10px";

              button.onclick = function () {
                  runExtraction();
              };

              form.appendChild(button);
          }
      }, 500);
  }

  // Inject the button when the page has fully loaded.
  window.addEventListener("load", addButtonToForm);
})();