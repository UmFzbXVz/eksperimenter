function runScript() {

  const currentUrl = window.location.href;
  const prefix = "https://www.kb.dk/find-materiale/dr-arkivet/post/";
  if (currentUrl.startsWith(prefix)) {
    const identifier = currentUrl.slice(prefix.length);
    console.log("Fundet identifier: " + identifier);

    // Byg API-URL'en med identifieren
    const apiUrl = `https://www.kb.dk/ds-api/bff/v1/proxy/record/${identifier}?format=JSON-LD`;
    console.log("API-kald: " + apiUrl);

    // Variabler til opbevaring af data
    let programName = '';
    let description = '';
    let startTime = '';
    let genre = '';
    let broadcaster = '';
    let channel = '';
    let streamLink = '';
    let kalturaID = '';

    // Foretag API-kaldet
    fetch(apiUrl)
      .then(response => {
        console.log("API-svar:", response);
        if (response.ok) {
          return response.json(); // Parse JSON data
        } else {
          throw new Error("API-kaldet mislykkedes med status: " + response.status);
        }
      })
      .then(data => {
        console.log("API-svardata:", data);

        // Udtræk relevante data fra API-svaret
        programName = data.name || 'Navn ikke tilgængelig';
        description = data.description || 'Beskrivelse ikke tilgængelig';
        startTime = data.startTime || 'Starttidspunkt ikke tilgængeligt';
        genre = data.genre || 'Genre ikke tilgængelig';
        broadcaster = data.publication?.broadcaster?.legalName || 'Broadcastør ikke tilgængelig';
        channel = data.kb?.channel_id || 'Kanal ikke tilgængelig';

        // Udtræk KalturaID fra API-svaret
        const kalturaIDProperty = data.identifier.find(item => item.PropertyID === 'KalturaID');
        kalturaID = kalturaIDProperty ? kalturaIDProperty.value : 'KalturaID ikke fundet';

        console.log("Programnavn: " + programName);
        console.log("Beskrivelse: " + description);
        console.log("Starttidspunkt: " + startTime);
        console.log("Genre: " + genre);
        console.log("Broadcastør: " + broadcaster);
        console.log("Kanal ID: " + channel);
        console.log("Kaltura ID: " + kalturaID);

        // Efter API-kald, opret stream linket ved hjælp af KalturaID
        streamLink = generateKalturaLink(kalturaID);
        console.log("Stream Link: " + streamLink);

        /*Skab Chromecast-ikon og tilføj det til siden
        const castButton = document.createElement('button');
        castButton.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/2/26/Chromecast_cast_button_icon.svg" alt="Cast" style="width: 50px; height: 50px; cursor: pointer; position: fixed; bottom: 10px; right: 70px; z-index: 9999;" />';
        castButton.title = "Chromecast";
        document.body.appendChild(castButton); */

        // Skab Download-knappen og tilføj den til siden
        const downloadButton = document.createElement('button');
        downloadButton.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Download_icon_black.svg/640px-Download_icon_black.svg.png" alt="Download" style="width: 50px; height: 50px; cursor: pointer; position: fixed; bottom: 10px; right: 10px; z-index: 9999;" />';
        downloadButton.title = "Hent";
        document.body.appendChild(downloadButton);

        // Når der klikkes på Download-knappen, start download af medie
        downloadButton.addEventListener('click', () => {
          console.log("Påbegynder indhentning af mediefil...");

          // Start download af medie
          startDownload(streamLink);
        });

        // Når der klikkes på Chromecast-knappen, start Chromecast sessionen
        castButton.addEventListener('click', () => {
          console.log("Chromecast-session startet!");

          // Start Chromecast session og send medie
          startChromecastSession(streamLink, programName, description);
        });
      })
      .catch(error => {
        console.error("Fejl ved API-kald:", error); // Log fejl, hvis API kaldet mislykkes
      });

    // Funktion til at generere Kaltura-streamlink
    function generateKalturaLink(entryIdValue) {
      console.log("Genererer Kaltura-link med entryIdValue:", entryIdValue);

      const url = "https://api.kaltura.nordu.net/api_v3/service/multirequest";
      const headers = {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
      };

      const data = {
        "1": {
          "service": "session",
          "action": "startWidgetSession",
          "widgetId": "_397"
        },
        "2": {
          "service": "baseEntry",
          "action": "list",
          "ks": "{1:result:ks}",
          "filter": {
            "redirectFromEntryId": entryIdValue
          },
          "responseProfile": {
            "type": 1,
            "fields": "id"
          }
        },
        "3": {
          "service": "baseEntry",
          "action": "getPlaybackContext",
          "entryId": "{2:result:objects:0:id}",
          "ks": "{1:result:ks}",
          "contextDataParams": {
            "objectType": "KalturaContextDataParams",
            "flavorTags": "all"
          }
        },
        "apiVersion": "3.3.0",
        "format": 1,
        "ks": "",
        "clientTag": "html5:v3.14.4",
        "partnerId": 397
      };

      console.log("API-svar:", data);

      return fetch(url, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(data)
        })
        .then(response => {
          console.log("Kaltura-svar:", response);
          return response.json();
        })
        .then(responseData => {
          console.log("Kaltura svardata:", responseData);

          try {
            const entryId = responseData[1]['objects'][0]['id'];
            const flavorId = responseData[2]['sources'][0]['flavorIds'];
            const fileExt = responseData[2]['flavorAssets'][0]['fileExt']; // Dynamisk filtype

            const outputLink = `https://vod-cache.kaltura.nordu.net/p/397/sp/39700/serveFlavor/entryId/${entryId}/v/12/flavorId/${flavorId}/name/a.${fileExt}`;

            console.log("Genereret streamlink:", outputLink);
            streamLink = outputLink;
            addUIButtons(streamLink);
            return outputLink;
          } catch (error) {
            console.error("Fejl ved generering af Kalturalink:", error);
            return "Error extracting stream link";
          }
        })
        .catch(error => {
          console.error("Fejl ved API-kald til Kaltura:", error);
          return "Error generating stream link";
        });
    }

    function addUIButtons(streamLink) {
      console.log("Tilføjer UI-knapper med streamLink:", streamLink);

      /*const castButton = document.createElement('button');
      castButton.id = 'castButton';
      castButton.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/2/26/Chromecast_cast_button_icon.svg" alt="Cast" style="width: 50px; height: 50px; cursor: pointer; position: fixed; bottom: 10px; right: 70px; z-index: 9999;" />';
      castButton.title = "Chromecast";
      document.body.appendChild(castButton); */

      const downloadButton = document.createElement('button');
      downloadButton.id = 'downloadButton';
      downloadButton.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Download_icon_black.svg/640px-Download_icon_black.svg.png" alt="Download" style="width: 50px; height: 50px; cursor: pointer; position: fixed; bottom: 10px; right: 10px; z-index: 9999;" />';
      downloadButton.title = "Hent";
      document.body.appendChild(downloadButton);

      // Event Listeners
      downloadButton.addEventListener('click', () => startDownload(streamLink));
      castButton.addEventListener('click', () => startChromecastSession(streamLink, programName, description));
    }

    // Funktion til at starte Chromecast 
    function startChromecastSession(streamUrl, title, description) {
      if (window.cast && window.cast.framework) {
        const context = cast.framework.CastContext.getInstance();
        context.requestSession().then(() => {
          console.log('Chromecast session startet');

          // Opret mediainfo-objekt
          const mediaInfo = new chrome.cast.media.MediaInfo(streamUrl, 'video/mp4');
          mediaInfo.metadata = new chrome.cast.media.Metadata(chrome.cast.media.MetadataType.VIDEO);
          mediaInfo.metadata.title = title;
          mediaInfo.metadata.description = description;

          // Opret request for at starte medieafspilning
          const request = new chrome.cast.media.LoadRequest(mediaInfo);
          context.getCurrentSession().loadMedia(request).then(() => {
            console.log('Medieafspilning startet på Chromecast');
          }).catch(err => {
            console.error('Fejl ved afspilning af medie på Chromecast', err);
          });
        }).catch(err => {
          console.error('Fejl ved oprettelse af Chromecast session', err);
        });
      } else {
        console.error('Chromecast API ikke tilgængelig');
      }
    }

    /// Funktion til at starte download
    function startDownload(downloadUrl) {
      console.log("Forsøger at downloade filen fra: " + downloadUrl);

      if (downloadUrl) {
        // Fetch filen som Blob for at sikre direkte download
        fetch(downloadUrl)
          .then(response => {
            if (!response.ok) {
              throw new Error('Download fejl: ' + response.statusText);
            }
            return response.blob(); // Omdan responsen til en Blob
          })
          .then(blob => {
            // Format startTime til YYYY-MM-DD (fjern tid og Z)
            const formattedDate = startTime.split('T')[0]; // Datoen er i formatet YYYY-MM-DD

            // Extract filtype (extension) fra downloadUrl ved at finde alt efter sidste punktum
            const fileExtension = downloadUrl.substring(downloadUrl.lastIndexOf('.')); // F.eks. .mp4, .mp3

            // Generer et meningsfuldt filnavn baseret på programName og startTime
            const fileName = `${formattedDate} - ${programName}${fileExtension}`; // F.eks. 2025-04-01 - AfsnitNavn.mp4

            // Opret et download link og brug det meningsfulde filnavn
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob); // Opret et downloadlink baseret på Blob
            link.download = fileName; // Brug det formaterede filnavn

            document.body.appendChild(link);
            link.click(); // Udløs download
            document.body.removeChild(link); // Fjern linket efter download
            console.log("");
          })
          .catch(error => {
            console.error("Fejl ved download af fil:", error);
          });
      } else {
        console.error("Ugyldig download URL.");
      }
    }

  }
}

function removeExistingButtons() {
  console.log("Nu burde knapperne være fjernet...");

  document.querySelectorAll('button[title="Chromecast"], button[title="Hent"]').forEach(button => {
    console.log("Fjerner knap:", button);
    button.remove();

    // Tving browseren til at opdage ændringen (SPA fix)
    button.style.display = "none"; // Skjuler knappen
    button.offsetHeight; // Trigger reflow
  });
}

// Kør scriptet første gang
runScript();

// Overvåg URL-ændringer (til SPA-sider)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;

    runScript();
    removeExistingButtons();
  }
});

// Observer ændringer i <body> (kan tilpasses afhængigt af siden)
observer.observe(document.body, {
  childList: true,
  subtree: true
});
