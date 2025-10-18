(function () {
  const originalParseInt = window.parseInt;
  window.parseInt = function (str, radix) {
    return originalParseInt(str, radix || 10);
  };

  async function fetchConfig(uuid) {
    const configUrl = `https://play.lwcdn.com/web/public/native/config/7e165983-ccb1-453f-bc68-0d8ee7199e66/${uuid}`;
    try {
      const response = await fetch(configUrl);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (data.src && data.src[0]) {
        return data.src[0].startsWith('//') ? `https:${data.src[0]}` : data.src[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async function getVideoUrls() {
    const pageUrl = window.location.href;
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const uuidMatch = pageUrl.match(uuidRegex);
    const uuid = uuidMatch ? uuidMatch[0] : null;

    if (!uuid) {
      return {
        primary: 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd',
        fallback: null
      };
    }

    let primaryUrl, fallbackUrl;
    if (pageUrl.includes('video-on-demand')) {
      primaryUrl = `https://cf1318f5d.lwcdn.com/hls/${uuid}/playlist.m3u8`;
      fallbackUrl = primaryUrl;
    } else if (pageUrl.includes('live-sport')) {
      primaryUrl = await fetchConfig(uuid);
      if (!primaryUrl) {
        primaryUrl = `https://cf-live1318f5d.lwcdn.com/live/${uuid}/playlist.m3u8`;
      }
      fallbackUrl = `https://cf1318f5d.lwcdn.com/hls/${uuid}/playlist.m3u8`;
    } else {
      primaryUrl = 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd';
      fallbackUrl = null;
    }

    return { primary: primaryUrl, fallback: fallbackUrl };
  }

  async function initializeShakaPlayer(container) {
    const video = document.createElement('video');
    video.id = 'shaka-video';
    video.style.width = '100%';
    video.style.maxWidth = '700px';
    video.style.margin = '0 auto';
    video.controls = true;
    video.autoplay = false;

    container.replaceWith(video);

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      return;
    }

    const player = new shaka.Player(video);
    const { primary, fallback } = await getVideoUrls();
    let currentUrl = primary;

    player.configure({
      streaming: {
        retryParameters: {
          maxAttempts: 3,
          timeout: 30000
        }
      }
    });

    function loadVideo(url) {
      player.load(url).catch(() => {});
    }

    player.addEventListener('error', () => {
      if (currentUrl === primary && fallback) {
        currentUrl = fallback;
        loadVideo(currentUrl);
      }
    });

    fetch(currentUrl, { method: 'HEAD' }).catch(() => {});
    loadVideo(currentUrl);
  }

  function checkAndReplaceDiv() {
    const zephrBlocks = document.querySelectorAll('jfm-zephr-block');
    for (const block of zephrBlocks) {
      const shadow = block.shadowRoot;
      if (shadow) {
        const divs = shadow.querySelectorAll('div');
        for (const div of divs) {
          const loginLink = div.querySelector('a[href*="jfmplay.dk/log-ind"]');
          if (loginLink) {
            initializeShakaPlayer(div);
            return true;
          }
        }
      }
    }
    return false;
  }

  if (checkAndReplaceDiv()) {
    return;
  }

  const maxAttempts = 120;
  let attempts = 0;
  const pollInterval = setInterval(() => {
    if (checkAndReplaceDiv()) {
      clearInterval(pollInterval);
    } else {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
    }
  }, 500);
})();
