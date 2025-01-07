// Find elementet baseret på CSS-selector
const targetSelector = "#main-canvas > news-template > div:nth-child(1) > div > data > div:nth-child(1) > div:nth-child(3) > div > div.column.col-12.col-sm-12.col-md-8.col-lg-8.ng-star-inserted > div:nth-child(4) > article-content-widget > div";
const targetElement = document.querySelector(targetSelector);

// Find artiklens slug
const slug = window.location.pathname.split("/").pop();

// Send besked til baggrunds-script for at hente API-data
if (targetElement && slug) {
    chrome.runtime.sendMessage({ action: "fetchContent", slug }, (response) => {
        if (response && response.contentHTML) {
            // Opdater elementets indhold
            targetElement.innerHTML = response.contentHTML;
        }
    });
}
