// content.js
// Sporing af sidst behandlede URL for at undgå duplikater
let lastProcessedUrl = null;
let lastPodcastId = null;
let apiEpisodes = [];
let matchedEpisodes = [];
let currentOffset = 0;
const limit = 50;
let authToken = null;
let podcastId = null;
let episodeObserver = null;
let seenTitles = new Set();

// SVG for ulåst hængelåsikon
const unlockedPadlockSvg = `
<svg width="16" height="19" viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg" class="ButtonPlayEpisodeItemUI_iconPrimary__Jpthl">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M4.16445 7.1001H11.8353C12.3651 7.10008 12.8163 7.10007 13.1867 7.13034C13.5759 7.16213 13.9545 7.23177 14.3164 7.41618C14.8621 7.69421 15.3057 8.13786 15.5838 8.68353C15.7682 9.04546 15.8378 9.42405 15.8696 9.81321C15.8999 10.1836 15.8999 10.6348 15.8999 11.1647V14.8355C15.8999 15.3654 15.8999 15.8166 15.8696 16.187C15.8378 16.5761 15.7682 16.9547 15.5838 17.3167C15.3057 17.8623 14.8621 18.306 14.3164 18.584C13.9545 18.7684 13.5759 18.8381 13.1867 18.8699C12.8163 18.9001 12.3651 18.9001 11.8353 18.9001H4.16445C3.63458 18.9001 3.1834 18.9001 2.81297 18.8699C2.42381 18.8381 2.04522 18.7684 1.68328 18.584C1.13761 18.306 0.693969 17.8623 0.415936 17.3167C0.231522 16.9547 0.161888 16.5761 0.130092 16.187C0.0998268 15.8166 0.0998394 15.3654 0.0998542 14.8355V11.1647C0.0998394 10.6348 0.0998268 10.1836 0.130092 9.81321C0.161888 9.42405 0.231522 9.04546 0.415936 8.68353C0.693969 8.13786 1.13761 7.69421 1.68328 7.41618C2.04522 7.23177 2.42381 7.16213 2.81297 7.13034C3.1834 7.10007 3.63458 7.10008 4.16445 7.1001ZM2.95955 8.92436C2.6817 8.94706 2.56636 8.98642 2.50047 9.01999C2.29349 9.12545 2.12521 9.29373 2.01975 9.50071C1.98617 9.5666 1.94682 9.68194 1.92411 9.95979C1.90055 10.2481 1.89985 10.6252 1.89985 11.2001V14.8001C1.89985 15.375 1.90055 15.7521 1.92411 16.0404C1.94682 16.3183 1.98617 16.4336 2.01975 16.4995C2.12521 16.7065 2.29349 16.8747 2.50047 16.9802C2.56636 17.0138 2.6817 17.0531 2.95955 17.0758C3.2479 17.0994 3.62495 17.1001 4.19985 17.1001H11.7999C12.3748 17.1001 12.7518 17.0994 13.0402 17.0758C13.318 17.0531 13.4334 17.0138 13.4992 16.9802C13.7062 16.8747 13.8745 16.7065 13.98 16.4995C14.0135 16.4336 14.0529 16.3183 14.0756 16.0404C14.0992 15.7521 14.0999 15.375 14.0999 14.8001V11.2001C14.0999 10.6252 14.0992 10.2481 14.0756 9.95979C14.0529 9.68194 14.0135 9.5666 13.98 9.50071C13.8745 9.29373 13.7062 9.12545 13.4992 9.01999C13.4334 8.98642 13.318 8.94706 13.0402 8.92436C12.7518 8.9008 12.3748 8.9001 11.7999 8.9001H4.19985C3.62495 8.9001 3.2479 8.9008 2.95955 8.92436Z" fill="white"></path>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M7.99986 0.100098C5.01752 0.100098 2.59985 2.51776 2.59985 5.5001V8.0001H4.39986V5.5001C4.39986 3.51187 6.01163 1.9001 7.99986 1.9001C8.88808 1.9001 9.69986 2.21187 10.2999 2.81187V2.0001C10.2999 1.01776 9.28221 0.100098 7.99986 0.100098Z" fill="white"></path>
</svg>
`;

// Normaliserer strenge til sammenligning ved at fjerne overskydende mellemrum
function normalizeString(str) {
    return str ? str.trim().replace(/\s+/g, ' ') : '';
}

// Opdaterer afspilningsknaps SVG til ulåst ikon
function updatePlayButtonToUnlocked(playButton) {
    if (!playButton) return;
    const iconContainer = playButton.querySelector('.ButtonPlayEpisodeItemUI_iconContainer__Tju\\+K');
    if (iconContainer) iconContainer.innerHTML = unlockedPadlockSvg;
}

// Uddrager episoder fra HTML-DOM med gentagelseslogik
function extractHtmlEpisodes(maxRetries = 5, retryDelay = 500) {
    return new Promise((resolve) => {
        let retries = 0;

        function tryExtract() {
            try {
                const episodeElements = document.querySelectorAll('[data-cy="PodcastScreenContentEpisodesList"] .ReactVirtualized__Table__row');
                const htmlEpisodes = Array.from(episodeElements).map((el) => {
                    const titleEl = el.querySelector('div[class*="EpisodesListItemView_title__"] span');
                    const dateEl = el.querySelector('[data-cy="Datetime"]');
                    const durationEl = el.querySelector('div[class*="EpisodesListItemView_publishDuration__"] span');
                    const imageEl = el.querySelector('img[class*="ImageComponentUI_container_image__"]');
                    const playButtonEl = el.querySelector('div[class*="ButtonPlayEpisodeItemUI_main__"]');
                    return {
                        title: normalizeString(titleEl?.textContent || 'No title found'),
                        publishDate: dateEl?.textContent || 'No date found',
                        duration: durationEl?.textContent?.split(' — ')[1] || 'No duration found',
                        imageUrl: imageEl?.src || 'No image URL found',
                        playButton: playButtonEl || null
                    };
                });

                if (htmlEpisodes.length > 0 || retries >= maxRetries) {
                    resolve(htmlEpisodes);
                } else {
                    retries++;
                    setTimeout(tryExtract, retryDelay);
                }
            } catch (err) {
                retries++;
                if (retries >= maxRetries) resolve([]);
                else setTimeout(tryExtract, retryDelay);
            }
        }

        tryExtract();
    });
}

// Henter episoder fra GraphQL API
async function fetchApiEpisodes(offset) {
    const payload = {
        operationName: 'PodcastEpisodesResultsQuery',
        variables: {
            podcastId: podcastId,
            sorting: 'PUBLISHED_DESCENDING',
            offset: offset,
            limit: limit
        },
        query: `query PodcastEpisodesResultsQuery($podcastId: String!, $offset: Int, $limit: Int, $sorting: PodcastEpisodeSorting) {
            podcastEpisodes(
                podcastId: $podcastId
                offset: $offset
                limit: $limit
                converted: true
                published: true
                sorting: $sorting
            ) {
                ...PodcastEpisodeFragment
                __typename
            }
        }

        fragment PodcastEpisodeFragment on PodcastEpisode {
            id
            podcastId
            podcastName
            title
            imageUrl
            premiumBadge
            description
            publishDatetime
            authorName
            accessLevel
            accessLevels
            duration
            isMarkedAsPlayed
            hasVideo
            ...PodcastEpisodeUserProgress
            ...PodcastEpisodeRatingScoreFragment
            __typename
        }

        fragment PodcastEpisodeUserProgress on PodcastEpisode {
            userProgress {
                progress
                listenTime
                lastListenDatetime
                __typename
            }
            __typename
        }

        fragment PodcastEpisodeRatingScoreFragment on PodcastEpisode {
            ratingScore {
                score
                total
                __typename
            }
            __typename
        }`
    };

    try {
        const response = await fetch('https://open.podimo.com/graphql?queryName=PodcastEpisodesResultsQuery', {
            method: 'POST',
            headers: {
                'authority': 'open.podimo.com',
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9,da;q=0.8',
                'apollographql-client-name': 'web-player',
                'apollographql-client-version': '1.0.0',
                'authorization': authToken,
                'content-type': 'application/json',
                'cookie': document.cookie
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) return [];
        const data = await response.json();
        return data?.data?.podcastEpisodes || [];
    } catch (err) {
        return [];
    }
}

// Behandler nye episoder og tilknytter eventlisteners
async function processNewEpisodes(allHtmlEpisodes) {
    const currentSeenTitles = new Set(matchedEpisodes.map(m => normalizeString(m.html.title)));
    const newHtml = allHtmlEpisodes.filter(h => !currentSeenTitles.has(normalizeString(h.title)));

    if (newHtml.length === 0) return;

    // Matcher HTML-episoder mod API-data
    let tempMatched = newHtml.map(html => ({
        html,
        api: apiEpisodes.find(api => normalizeString(api.title) === normalizeString(html.title)) || null
    }));

    let unmatched = tempMatched.filter(m => !m.api);

    // Henter yderligere API-data for umatchede episoder
    while (unmatched.length > 0) {
        currentOffset += limit;
        const nextEpisodes = await fetchApiEpisodes(currentOffset);
        if (nextEpisodes.length === 0) break;
        apiEpisodes.push(...nextEpisodes);
        unmatched.forEach((m, i) => {
            const api = apiEpisodes.find(a => normalizeString(a.title) === normalizeString(m.html.title));
            if (api) tempMatched[tempMatched.indexOf(m)].api = api;
        });
        unmatched = tempMatched.filter(m => !m.api);
    }

    // Opdaterer SVG for matchede afspilningsknapper
    tempMatched.forEach(match => {
        if (match.api && match.html.playButton) {
            updatePlayButtonToUnlocked(match.html.playButton);
        }
    });

    // Tilknytter klik-eventlisteners til matchede afspilningsknapper
    tempMatched.forEach(match => {
        if (match.api && match.html.playButton) {
            match.html.playButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const mediaPayload = {
                    operationName: 'ShortLivedPodcastMediaUrlQuery',
                    variables: {
                        podcastId: podcastId,
                        episodeId: match.api.id
                    },
                    query: `query ShortLivedPodcastMediaUrlQuery($podcastId: String!, $episodeId: String!) {
                        podcastEpisodeStreamMediaById(podcastId: $podcastId, episodeId: $episodeId) {
                            url
                            __typename
                        }
                    }`
                };

                try {
                    const response = await fetch('https://open.podimo.com/graphql?queryName=ShortLivedPodcastMediaUrlQuery', {
                        method: 'POST',
                        headers: {
                            'authority': 'open.podimo.com',
                            'accept': '*/*',
                            'accept-encoding': 'gzip, deflate, br, zstd',
                            'accept-language': 'en-US,en;q=0.9,da;q=0.8',
                            'apollographql-client-name': 'web-player',
                            'apollographql-client-version': '1.0.0',
                            'authorization': authToken,
                            'content-type': 'application/json',
                            'cookie': document.cookie
                        },
                        body: JSON.stringify(mediaPayload)
                    });

                    if (!response.ok) return;
                    const mediaData = await response.json();
                    const mediaUrl = mediaData?.data?.podcastEpisodeStreamMediaById?.url;
                    if (!mediaUrl) return;

                    const isVideo = match.api.hasVideo;
                    let uuid;
                    let mediaUrlFinal;
                    if (isVideo) {
                        const uuidMatch = mediaUrl.match(/hls-media\/([a-f0-9\-]{36})\/main\.m3u8/i);
                        if (!uuidMatch) return;
                        uuid = uuidMatch[1];
                        mediaUrlFinal = `https://cdn.podimo.com/hls-media/${uuid}/main.m3u8`;
                    } else {
                        const uuidMatch = mediaUrl.match(/audios\/([a-f0-9\-]{36})\.mp3/i);
                        if (!uuidMatch) return;
                        uuid = uuidMatch[1];
                        mediaUrlFinal = `https://cdn.podimo.com/audios/${uuid}.mp3`;
                    }

                    if (typeof createOrUpdateMediaPlayer !== 'function' || typeof setMediaSource !== 'function') return;

                    const mediaElement = createOrUpdateMediaPlayer({
                        apiTitle: match.api.title,
                        apiImageUrl: match.api.imageUrl,
                        apiPublishDatetime: match.api.publishDatetime,
                        apiPodcastName: match.api.podcastName,
                        apiDuration: match.api.duration
                    }, isVideo);

                    await setMediaSource(mediaElement, mediaUrlFinal, isVideo);
                    await mediaElement.play();

                    const playerContainer = document.getElementById('custom-audio-player-container');
                    const playButton = playerContainer?.querySelector('.player-play-button');
                    if (playButton && typeof updatePlayButtonState === 'function') {
                        updatePlayButtonState(mediaElement, playButton);
                    }
                } catch (err) {}
            });
        }
    });

    matchedEpisodes.push(...tempMatched);
    tempMatched.forEach(m => seenTitles.add(normalizeString(m.html.title)));
}

// Opsætter MutationObserver til dynamisk episodeindlæsning
function setupEpisodeObserver() {
    const container = document.querySelector('[data-cy="PodcastScreenContentEpisodesList"]');
    if (!container) return;

    if (episodeObserver) episodeObserver.disconnect();

    episodeObserver = new MutationObserver((mutations) => {
        let added = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) added = true;
        });
        if (added) {
            setTimeout(async () => {
                const allHtmlEpisodes = await extractHtmlEpisodes(1, 100);
                await processNewEpisodes(allHtmlEpisodes);
            }, 500);
        }
    });

    episodeObserver.observe(container, { childList: true, subtree: true });
}

// Hovedlogik til behandling af podcast-sider
async function runLogic() {
    const url = window.location.href;

    if (url !== lastProcessedUrl && url.includes('/podcast/')) {
        lastProcessedUrl = url;

        const uuidMatch = url.match(/\/podcast\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        podcastId = uuidMatch ? uuidMatch[1] : null;
        if (!podcastId) return;

        if (podcastId !== lastPodcastId) {
            apiEpisodes = [];
            matchedEpisodes = [];
            seenTitles = new Set();
            currentOffset = 0;
            lastPodcastId = podcastId;
            if (episodeObserver) episodeObserver.disconnect();
        }

        const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
            const [name, value] = cookie.split('=');
            acc[name] = decodeURIComponent(value);
            return acc;
        }, {});
        authToken = cookies['pmo_auth'] || null;
        if (!authToken) return;

        if (apiEpisodes.length === 0) {
            const initialEpisodes = await fetchApiEpisodes(0);
            if (initialEpisodes.length === 0) return;
            apiEpisodes.push(...initialEpisodes);
        }

        const htmlEpisodes = await extractHtmlEpisodes();
        if (htmlEpisodes.length === 0) return;

        await processNewEpisodes(htmlEpisodes);
        setupEpisodeObserver();
    }
}

// Udfører hovedlogik med forsinkelse for DOM-klarhed
setTimeout(() => runLogic().catch(() => {}), 100);

// Håndterer SPA-navigation
window.addEventListener('popstate', () => runLogic().catch(() => {}));
window.addEventListener('hashchange', () => runLogic().catch(() => {}));

// Overskriver historikmetoder
const originalPushState = history.pushState;
history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    runLogic().catch(() => {});
    return result;
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    runLogic().catch(() => {});
    return result;
};

// Forhindrer overskrivning af historikmetoder
Object.defineProperty(history, 'pushState', {
    value: history.pushState,
    writable: false,
    configurable: false
});
Object.defineProperty(history, 'replaceState', {
    value: history.replaceState,
    writable: false,
    configurable: false
});

// Håndterer klik til podcast-navigation
document.addEventListener('click', (event) => {
    try {
        const path = event.composedPath();
        let navigationTriggered = false;

        for (const el of path) {
            if (el.tagName) {
                const href = el.href || el.getAttribute('data-nav') || el.getAttribute('href') || '';
                const onclick = el.getAttribute('onclick') || '';
                const className = typeof el.className === 'string' ? el.className : '';
                const id = el.id || '';

                if (
                    href.toLowerCase().includes('/podcast/') ||
                    onclick.toLowerCase().includes('podcast') ||
                    (className && className.toLowerCase().includes('podcast')) ||
                    id.toLowerCase().includes('podcast') ||
                    className.includes('MediaCard_mediaCard__7HTNU')
                ) {
                    navigationTriggered = true;
                    break;
                }
            }
        }

        if (navigationTriggered) {
            setTimeout(() => runLogic().catch(() => {}), 100);
        }
    } catch (err) {}
});
