chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetchContent") {
        const apiUrl = `https://kontrast.dk/cache/api/v1/news/content/${message.slug}/slug/?prefetch=all`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data && data.content && data.content.rows) {
                    // Saml HTML fra alle content-rækker
                    const contentHTML = data.content.rows
                        .flatMap(row => row.flatMap(field => field.fields.map(f => f.content)))
                        .join("");
                    
                    sendResponse({ contentHTML });
                } else {
                    sendResponse({ contentHTML: "Kunne ikke hente indhold." });
                }
            })
            .catch(error => {
                console.error("API-fejl:", error);
                sendResponse({ contentHTML: "Fejl under hentning af indhold." });
            });

        return true; // Angiver, at vi sender et asynkront svar
    }
});
