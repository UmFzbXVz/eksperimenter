function runScript() {
	const currentUrl = window.location.href;
	const prefix = "https://www.kb.dk/find-materiale/dr-arkivet/post/";
	let kbdra = '';
	let kbdrakey = '';
	let kbdraext = '';
	let streamLink = ""

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
document.addEventListener('DOMContentLoaded', () => {
	runScript();
});

function castDate(date) {
  const d = new Date(date);

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}`;
}

function generateKalturaLink(entryId, programName, description, startTime) {
	const url = "https://api.kaltura.nordu.net/api_v3/service/multirequest";
	const headers = {
		"Accept": "*/*",
		"Content-Type": "application/json"
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
				"redirectFromEntryId": entryId
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

	fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(data)
		})
		.then(response => response.json())
		.then(responseData => {
			try {
				const entryId = responseData[1]['objects'][0]['id'];
				kbdra = entryId;
				const flavorId = responseData[2]['sources'][0]['flavorIds'];
				kbdrakey = flavorId;
				const fileExt = responseData[2]['flavorAssets'][0]['fileExt'];
				kbdraext = fileExt;

				streamLink = `https://api.kltr.nordu.net/p/397/sp/39700/serveFlavor/entryId/${entryId}/flavorId/${flavorId}/name/a.${fileExt}`;

				console.log("Genereret streamlink:", streamLink);
				addUIButtons(streamLink, programName, description, startTime);
			} catch (error) {
				console.error("Fejl ved generering af Kaltura-link:", error);
			}
		})
		.catch(error => console.error("Fejl ved API-kald til Kaltura:", error));
}

function addUIButtons(streamLink, programName, description, startTime) {
	const observer = new MutationObserver(() => {
		const metadataContainer = document.querySelector('.boardcast-record-data');

		if (!metadataContainer) return;

		observer.disconnect();
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
	img.classList.add("icon-img");

	button.title = title;
	button.appendChild(img);
	button.onclick = () => onClick(button, img);

	return button;
}

const style = document.createElement('style');
style.textContent = `
@keyframes pulseGreen {
  0% { filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0.5)); transform: scale(1); }
  50% { filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8)); transform: scale(1.1); }
  100% { filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0.5)); transform: scale(1); }
}
.pulse-success {
  animation: pulseGreen 0.5s ease-out;
}
`;
document.head.appendChild(style);
const copyButton = createIconButton(
	"https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Copy_-_The_Noun_Project.svg/640px-Copy_-_The_Noun_Project.svg.png",
	"Kopiér URL",
	(button, img) => {
		navigator.clipboard.writeText(streamLink).then(() => {
			img.classList.add("pulse-success");
			setTimeout(() => {
				img.classList.remove("pulse-success");
			}, 500);
		});
	}
);
		let castWindow = null;

const castButton = createIconButton(
	"https://upload.wikimedia.org/wikipedia/commons/2/26/Chromecast_cast_button_icon.svg",
	"Chromecast",
	() => {
		const url = 'https://umfzbxvz.github.io/kbdra/?entryId=' + kbdra + '&flavorId=' + kbdrakey + '&ext=' + kbdraext + '&d=' + castDate(startTime);

		if (castWindow && !castWindow.closed) {
			castWindow.location.href = url;
			castWindow.focus();
		} else {
			castWindow = window.open(
				url,
				'castPopup',
				'width=440,height=590,top=100,left=100,toolbar=no,menubar=no,scrollbars=no,resizable=no,status=no'
			);

			castWindow.onload = function () {
				const contentHeight = castWindow.document.body.scrollHeight;
				const contentWidth = castWindow.document.body.scrollWidth;

				castWindow.resizeTo(contentWidth + 20, contentHeight + 40);

				const style = castWindow.document.createElement('style');
				style.innerHTML = `
					html, body {
						overflow: hidden !important;
						margin: 0;
						padding: 0;
					}
				`;
				castWindow.document.head.appendChild(style);
			};
		}
	}
);


const downloadButton = createIconButton(
	"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Download_icon_black.svg/640px-Download_icon_black.svg.png",
	"Download",
	(button, img) => startDownloadWithProgress(streamLink, programName, startTime, img)
);
		buttonWrapper.appendChild(castButton);
		buttonWrapper.appendChild(copyButton);
		buttonWrapper.appendChild(downloadButton);

		metadataContainer.parentNode.insertBefore(buttonWrapper, metadataContainer);
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
}

function startDownloadWithProgress(downloadUrl, programName, startTime, iconImg) {
    const originalSrc = iconImg.src;

    updateCircularProgress(iconImg, 0);

    fetch(downloadUrl)
        .then(response => {
            if (!response.ok) throw new Error("Fejl ved download");

            const contentLength = response.headers.get('content-length');
            if (!contentLength) throw new Error("Ingen content-length!");

            const total = parseInt(contentLength, 10);
            let loaded = 0;
            const reader = response.body.getReader();
            const chunks = [];

            function read() {
                return reader.read().then(({ done, value }) => {
                    if (done) return;

                    chunks.push(value);
                    loaded += value.length;

                    const percent = Math.floor((loaded / total) * 99);
                    updateCircularProgress(iconImg, percent);

                    return read();
                });
            }

            return read().then(() => new Blob(chunks));
        })
       .then(blob => {
    const formattedDate = startTime.split('T')[0];
    const fileExtension = downloadUrl.split('.').pop(); 
    const fileName = `${formattedDate} - ${programName}.${fileExtension}`;

            const link = document.createElement('a');
            console.log("Downloading link:", link);
            link.href = URL.createObjectURL(blob);
            link.download = fileName;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => console.error("Fejl under download:", error))
        .finally(() => {
            iconImg.src = originalSrc;
        });
}

function updateCircularProgress(imgElement, percent) {
	const size = 40;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');

	ctx.beginPath();
	ctx.arc(size / 2, size / 2, size / 2 - 3, 0, 2 * Math.PI);
	ctx.strokeStyle = '#ddd';
	ctx.lineWidth = 4;
	ctx.stroke();

	const startAngle = -Math.PI / 2;
	const endAngle = startAngle + (percent / 100) * 2 * Math.PI;
	ctx.beginPath();
	ctx.arc(size / 2, size / 2, size / 2 - 3, startAngle, endAngle);
	ctx.strokeStyle = '#002E70'; // KB-blå
	ctx.lineWidth = 4;
	ctx.stroke();

	// Tekst i midten
	ctx.fillStyle = '#000';
	ctx.font = 'bold 12px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	const displayText = percent.toString().padStart(2, '0');
	ctx.fillText(displayText, size / 2, size / 2);

	imgElement.src = canvas.toDataURL();
}

function removeExistingButtons() {
	document.querySelectorAll('#custom-button-wrapper').forEach(el => el.remove());
}

// Initial execution
runScript();

let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
	if (window.location.href !== lastUrl) {
		lastUrl = window.location.href;
		runScript();
		removeExistingButtons();
	}
});

observer.observe(document.body, {
	childList: true,
	subtree: true
});
