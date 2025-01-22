async function saveSetlist() {
  const url = "https://www.multitracks.com/json/setlist/save.aspx";
  const payload = {
    setlistID: 3388141,
    items: [
      {
        contentID: 29111,
        isCloud: false,
        title: "Praise",
        artist: "Elevation Worship",
        album: "CAN YOU IMAGINE?",
        albumID: 7566,
        imageExists: true,
        libraryID: 6087185,
        hasChart: false,
        hasMidi: false,
        bpm: 127,
        songURL: "/songs/Elevation-Worship/CAN-YOU-IMAGINE-/Praise/",
        duration: 296.692925,
        artistURL: "/artists/Elevation-Worship/",
        isRenting: false,
        keyID: 10,
        key: "C",
        arrangementID: 0,
        categoryID: 0,
        showSongSpecificPad: false,
        contentStatus: 1,
        contentTimeSignatureID: 3,
        stemID: 26121731,
        patchID: 391,
        bundleID: 53,
        contentType: 32,
        pcID: 0,
        image: "https://mtracks.azureedge.net/public/images/albums/40/7566.jpg",
        image2x: "https://mtracks.azureedge.net/public/images/albums/100/7566.jpg",
        songID: 0,
        previewBegin: null,
        previewEnd: null,
        contentTypes: [
          {
            contentID: 29111,
            isCloud: false,
            contentType: 32,
            title: "AppTrack",
            redemptionID: 3704174,
            customMixKey: null,
          },
        ],
        keys: [
          { contentID: 29111, key: "C", keyID: 10, selectedKey: false },
          // other keys ...
          { contentID: 29111, key: "A", keyID: 1, selectedKey: true },
        ],
        arrangements: [{ arrangementID: 0, title: "Default" }],
        timeSignatures: [{ timeID: 3, title: "4/4" }],
        order: 1,
        redemptionID: 3704174,
      },
      {
        contentID: 94,
        contentType: 33,
        title: "Celestial Pads",
        artist: "Edgar Mantilla",
        album: "Celestial Pads",
        key: "C",
        categoryID: 2,
        bpm: 127,
        timeSignatureID: 3,
      },
    ],
    message: "",
    title: "26.01.2025 - 10:00 test",
    isPinned: false,
    date: "01/26/2025 00:00:00",
    tags: "",
    description: "",
    serviceTypeID: 2692,
    autoUpdate: true,
  };

  const headers = {
    "accept": "*/*",
    "content-type": "application/json",
    "request-id": "|b5472222135542fbabf6509e69a9d7c6.d575f9cb31124130",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      credentials: "include", // Send cookies along with the request
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Response:", result);
  } catch (error) {
    console.error("Error during fetch:", error);
  }
}

// Call the function
saveSetlist();
