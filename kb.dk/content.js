function runScript() {
  const currentUrl = window.location.href;
  const prefix = "https://www.kb.dk/find-materiale/dr-arkivet/post/";
  
  if (currentUrl.startsWith(prefix)) {
    const identifier = currentUrl.slice(prefix.length);
    console.log("Fundet identifier: " + identifier);

    const apiUrl = `https://www.kb.dk/ds-api/bff/v1/proxy/record/${identifier}?format=JSON-LD`;

    fetch(apiUrl)
      .then(response => {
        if (!response.ok) throw new Error("API-kaldet mislykkedes: " + response.status);
        return response.json();
      })
      .then(data => {
        console.log("API-svardata:", data);

        const programName = data.name || 'Navn ikke tilgængelig';
        const description = data.description || 'Beskrivelse ikke tilgængelig';
        const startTime = data.startTime || 'Starttidspunkt ikke tilgængeligt';
        
        const kalturaIDProperty = data.identifier.find(item => item.PropertyID === 'KalturaID');
        const kalturaID = kalturaIDProperty ? kalturaIDProperty.value : null;

        if (kalturaID) {
          generateKalturaLink(kalturaID, programName, description, startTime);
        } else {
          console.error("Kaltura ID ikke fundet.");
        }
      })
      .catch(error => console.error("Fejl ved API-kald:", error));
  }
}

function generateKalturaLink(entryId, programName, description, startTime) {
  const url = "https://api.kaltura.nordu.net/api_v3/service/multirequest";
  const headers = { "Accept": "*/*", "Content-Type": "application/json" };
  
  const data = {
    "1": { "service": "session", "action": "startWidgetSession", "widgetId": "_397" },
    "2": { 
      "service": "baseEntry", "action": "list", "ks": "{1:result:ks}", 
      "filter": { "redirectFromEntryId": entryId }, 
      "responseProfile": { "type": 1, "fields": "id" }
    },
    "3": { 
      "service": "baseEntry", "action": "getPlaybackContext", "entryId": "{2:result:objects:0:id}",
      "ks": "{1:result:ks}", "contextDataParams": { "objectType": "KalturaContextDataParams", "flavorTags": "all" }
    },
    "apiVersion": "3.3.0", "format": 1, "ks": "", "clientTag": "html5:v3.14.4", "partnerId": 397
  };

  fetch(url, { method: "POST", headers, body: JSON.stringify(data) })
    .then(response => response.json())
    .then(responseData => {
      try {
        const entryId = responseData[1]['objects'][0]['id'];
        const flavorId = responseData[2]['sources'][0]['flavorIds'];
        const fileExt = responseData[2]['flavorAssets'][0]['fileExt'];

        const streamLink = `https://vod-cache.kaltura.nordu.net/p/397/sp/39700/serveFlavor/entryId/${entryId}/v/12/flavorId/${flavorId}/name/a.${fileExt}`;

        console.log("Genereret streamlink:", streamLink);
        addUIButtons(streamLink, programName, description, startTime);
      } catch (error) {
        console.error("Fejl ved generering af Kaltura-link:", error);
      }
    })
    .catch(error => console.error("Fejl ved API-kald til Kaltura:", error));
}

function addUIButtons(streamLink, programName, description, startTime) {
  console.log("Tilføjer UI-knapper...");

  const observer = new MutationObserver(() => {
    const metadataContainer = document.querySelector('.boardcast-record-data');

    if (!metadataContainer) return;

    observer.disconnect();
    console.log("Metadata-sektion fundet!");

    removeExistingButtons();

    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = "custom-button-wrapper";
    buttonWrapper.style.cssText = "display: flex; gap: 15px; justify-content: flex-end; margin-bottom: 10px; padding-top: 10px; width: 100%;";

    function createIconButton(imgSrc, title, onClick) {
      const button = document.createElement('button');
      button.style.cssText = "background: transparent; border: none; padding: 0; cursor: pointer;";

      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = title;
      img.style.cssText = "width: 40px; height: 40px;";

      button.title = title;
      button.appendChild(img);
      button.onclick = onClick;

      return button;
    }

    const castButton = createIconButton(
      "https://upload.wikimedia.org/wikipedia/commons/2/26/Chromecast_cast_button_icon.svg",
      "Chromecast",
      () => startChromecastSession(streamLink, programName, description)
    );

    const downloadButton = createIconButton(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Download_icon_black.svg/640px-Download_icon_black.svg.png",
      "Download",
      () => startDownload(streamLink, programName, startTime)
    );

    buttonWrapper.appendChild(castButton);
    buttonWrapper.appendChild(downloadButton);

    metadataContainer.parentNode.insertBefore(buttonWrapper, metadataContainer);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function removeExistingButtons() {
  document.querySelectorAll('#custom-button-wrapper').forEach(el => el.remove());
}

function startChromecastSession(streamUrl, title, description) {
  if (window.cast && window.cast.framework) {
    const context = cast.framework.CastContext.getInstance();
    const session = context.getCurrentSession();

    if (session) {
      startChromecastPlayback(session, streamUrl, title, description);
    } else {
      context.requestSession().then(() => {
        const newSession = context.getCurrentSession();
        if (newSession) {
          startChromecastPlayback(newSession, streamUrl, title, description);
        }
      }).catch(err => console.error('Fejl ved Chromecast-session:', err));
    }
  } else {
    console.error('Chromecast API ikke tilgængelig');
  }
}

function startChromecastPlayback(session, streamUrl, title, description) {
  const mediaInfo = new chrome.cast.media.MediaInfo(streamUrl, 'video/mp4');
  mediaInfo.metadata = new chrome.cast.media.MovieMediaMetadata();
  mediaInfo.metadata.title = title;
  mediaInfo.metadata.subtitle = description;

  const request = new chrome.cast.media.LoadRequest(mediaInfo);
  session.loadMedia(request).then(() => {
    console.log('Afspilning på Chromecast påbegyndes..');
  }).catch(err => console.error('Fejl ved afspilning på Chromecast:', err));
}

function startDownload(downloadUrl, programName, startTime) {
  console.log("Starter download:", downloadUrl);

  fetch(downloadUrl)
    .then(response => {
      if (!response.ok) throw new Error('Downloadfejl: ' + response.statusText);
      return response.blob();
    })
    .then(blob => {
      const formattedDate = startTime.split('T')[0];
      const fileExtension = downloadUrl.substring(downloadUrl.lastIndexOf('.'));
      const fileName = `${formattedDate} - ${programName}${fileExtension}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(error => console.error("Fejl ved download:", error));
}

runScript();

let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    runScript();
    removeExistingButtons();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
