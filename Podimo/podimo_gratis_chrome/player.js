// Indlæser CSS for afspiller via CSS
function injectStyles() {
    const styleId = 'custom-player-styles';
    if (!document.getElementById(styleId)) {
        const link = document.createElement('link');
        link.id = styleId;
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('player.css');
        document.head.appendChild(link);
    }
}

// Indlæser Shaka Player asynkront og verificerer browserunderstøttelse
async function loadShaka() {
    if (window.shaka && shaka.Player.isBrowserSupported()) {
        shaka.polyfill.installAll();
        return shaka.Player;
    }
    throw new Error('Shaka Player understøttes ikke');
}

// Angiver mediekilde for audio- eller videoelement
async function setMediaSource(mediaElement, url, isVideo) {
    if (!isVideo) {
        mediaElement.src = url;
    } else {
        try {
            const Player = await loadShaka();
            const player = new Player(mediaElement);
            mediaElement.player = player;
            await player.load(url);
        } catch (err) {
            if (mediaElement.canPlayType('application/vnd.apple.mpegurl')) {
                mediaElement.src = url;
            } else {
                throw new Error('HLS understøttes ikke i denne browser');
            }
        }
    }
}

// Formaterer tid fra sekunder til HH:MM:SS eller MM:SS
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Opdaterer afspilningsknap baseret på medieafspillerens tilstand
function updatePlayButtonState(mediaElement, playButton) {
    if (mediaElement.paused) {
        playButton.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M10.65 12.2869C10.65 10.1192 12.9741 8.74504 14.8735 9.78971L25.2609 15.5028C27.2296 16.5856 27.2296 19.4144 25.2609 20.4972L14.8735 26.2103C12.9741 27.255 10.65 25.8808 10.65 23.7131V12.2869Z" fill="white"></path>
      </svg>
    `;
    } else {
        playButton.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="10" width="4" height="16" fill="white"/>
        <rect x="20" y="10" width="4" height="16" fill="white"/>
      </svg>
    `;
    }
}

// Opretter eller opdaterer brugerdefineret medieafspiller
function createOrUpdateMediaPlayer(metadata, isVideo) {
    injectStyles();

    // Skjuler webstedets standardafspiller
    const websitePlayer = document.querySelector('div[class^="Player_container__"]');
    if (websitePlayer) websitePlayer.style.display = 'none';

    // Opretter eller finder afspillercontainer
    let playerContainer = document.getElementById('custom-audio-player-container');
    if (!playerContainer) {
        playerContainer = document.createElement('div');
        playerContainer.id = 'custom-audio-player-container';
        document.body.appendChild(playerContainer);
    }
    playerContainer.innerHTML = '';

    // Opretter venstre side: metadata (billede eller video, titel, undertitel)
    const leftSide = document.createElement('div');
    leftSide.className = 'player-left-side';

    const imageContainer = document.createElement('div');
    imageContainer.className = 'player-image-container';

    let mediaElement;
    if (isVideo) {
        mediaElement = document.createElement('video');
        mediaElement.width = 56;
        mediaElement.height = 56;
    } else {
        mediaElement = document.createElement('audio');
        mediaElement.style.display = 'none';
        const image = document.createElement('img');
        image.src = metadata.apiImageUrl || 'https://via.placeholder.com/56';
        image.alt = metadata.apiTitle || 'Episode Image';
        image.className = 'player-image';
        imageContainer.appendChild(image);
    }
    mediaElement.id = 'custom-media-player';
    mediaElement.controls = false;
    mediaElement.className = isVideo ? 'player-image' : '';
    if (isVideo) {
        imageContainer.appendChild(mediaElement);
        mediaElement.addEventListener('dblclick', () => {
            if (!document.fullscreenElement) {
                mediaElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }

    // Tilføjer titel og undertitel
    const textContainer = document.createElement('div');
    textContainer.className = 'player-text-container';
    const title = document.createElement('div');
    title.textContent = metadata.apiTitle || 'Ukendt Episode';
    title.className = 'player-title';
    const subtitle = document.createElement('div');
    subtitle.textContent = metadata.apiPodcastName || 'Ukendt Podcast';
    subtitle.className = 'player-subtitle';
    textContainer.appendChild(title);
    textContainer.appendChild(subtitle);

    leftSide.appendChild(imageContainer);
    leftSide.appendChild(textContainer);

    // Opretter højre side: controls
    const rightSide = document.createElement('div');
    rightSide.className = 'player-right-side';

    if (!isVideo) rightSide.appendChild(mediaElement);

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'player-controls';

    // Spol-baglæns-15-sekunder-knap
    const backButton = document.createElement('button');
    backButton.className = 'player-button';
    backButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.8903 5.60275C11.4206 5.13304 10.9039 4.74275 10.3571 4.43133V2.39644C10.9044 2.08491 11.4215 1.69437 11.8916 1.22431C12.272 0.843892 12.6002 0.432803 12.8765 0L14.3937 0.96871C14.0813 1.45786 13.717 1.92343 13.3012 2.3573C15.0172 2.58483 16.6571 3.26032 18.0477 4.33332C20.0217 5.85639 21.3484 8.06821 21.7625 10.5268C22.1767 12.9855 21.648 15.5099 20.2819 17.5956C18.9159 19.6813 16.8131 21.1748 14.3938 21.7777C11.9745 22.3805 9.41686 22.0483 7.23183 20.8475C5.04681 19.6466 3.39535 17.6655 2.60744 15.3C1.81952 12.9345 1.95317 10.3588 2.98169 8.08755C4.0102 5.8163 5.85783 4.01676 8.15541 3.04849L8.85445 4.70721C6.97461 5.49943 5.46291 6.97178 4.6214 8.83007C3.77989 10.6884 3.67054 12.7958 4.31519 14.7312C4.95985 16.6666 6.31104 18.2875 8.09879 19.27C9.88654 20.2525 11.9792 20.5243 13.9586 20.0311C15.938 19.5379 17.6585 18.3159 18.7761 16.6094C19.8938 14.9029 20.3264 12.8375 19.9876 10.8259C19.6487 8.81425 18.5632 7.00458 16.9482 5.75843C15.7806 4.8576 14.3984 4.2992 12.9545 4.12785C13.0249 4.19388 13.0944 4.26125 13.1631 4.32995C13.6363 4.80309 14.0462 5.31624 14.3924 5.85835L12.8753 6.82706C12.5989 6.39426 12.2708 5.98317 11.8903 5.60275Z" fill="#A8A1F0"></path>
      <path d="M8.8478 8.87143C8.6478 9.63143 7.9578 10.0114 7.1078 10.0714L7.1178 11.8414C7.7478 11.8314 8.3278 11.5514 8.5978 11.1114C8.5578 11.2614 8.5578 11.4214 8.5578 11.5414V15.8714H10.3278V8.87143H8.8478Z" fill="#A8A1F0"></path>
      <path d="M14.0298 16.0614C15.4798 16.0614 16.7998 15.2114 16.7998 13.5214C16.7998 12.1814 15.9498 11.2214 14.6198 11.2214C13.8698 11.2214 13.3798 11.5614 13.0898 11.9014C13.1198 11.7814 13.1398 11.6814 13.1698 11.5014L13.3198 10.4814H16.4298V8.87143H11.9598L11.3898 13.0114H13.1698C13.3198 12.7314 13.6298 12.5214 14.0598 12.5214C14.6298 12.5214 15.0098 12.9514 15.0098 13.5314C15.0098 14.1814 14.5898 14.5814 14.0198 14.5814C13.4498 14.5814 13.1298 14.2114 13.0998 13.7214H11.2498C11.2598 14.9814 12.1598 16.0614 14.0298 16.0614Z" fill="#A8A1F0"></path>
    </svg>
  `;
    backButton.addEventListener('click', () => {
        mediaElement.currentTime = Math.max(0, mediaElement.currentTime - 15);
    });

    // Afspil/pause-knap
    const playButton = document.createElement('div');
    playButton.className = 'player-play-button';
    playButton.innerHTML = `
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M10.65 12.2869C10.65 10.1192 12.9741 8.74504 14.8735 9.78971L25.2609 15.5028C27.2296 16.5856 27.2296 19.4144 25.2609 20.4972L14.8735 26.2103C12.9741 27.255 10.65 25.8808 10.65 23.7131V12.2869Z" fill="white"></path>
    </svg>
  `;
    playButton.addEventListener('click', () => {
        if (mediaElement.paused) {
            mediaElement.play().catch(() => {});
        } else {
            mediaElement.pause();
        }
        updatePlayButtonState(mediaElement, playButton);
    });

    // Spol-forlæns-30-sekunder-knap
    const forwardButton = document.createElement('button');
    forwardButton.className = 'player-button';
    forwardButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.1099 5.60275C12.5796 5.13304 13.0963 4.74275 13.6432 4.43133V2.39644C13.0958 2.08491 12.5787 1.69437 12.1086 1.22431C11.7282 0.843892 11.4 0.432802 11.1237 0L9.60657 0.96871C9.9189 1.45786 10.2832 1.92343 10.699 2.3573C8.98299 2.58484 7.34317 3.26033 5.9525 4.33332C3.9785 5.85639 2.65187 8.06821 2.23769 10.5268C1.8235 12.9855 2.35226 15.5099 3.71831 17.5956C5.08436 19.6813 7.1871 21.1748 9.6064 21.7777C12.0257 22.3805 14.5834 22.0483 16.7684 20.8475C18.9534 19.6466 20.6049 17.6655 21.3928 15.3C22.1807 12.9345 22.0471 10.3588 21.0185 8.08755C19.99 5.8163 18.1424 4.01676 15.8448 3.04849L15.1458 4.70721C17.0256 5.49943 18.5373 6.97178 19.3788 8.83007C20.2203 10.6884 20.3297 12.7958 19.685 14.7312C19.0404 16.6666 17.6892 18.2875 15.9014 19.27C14.1137 20.2525 12.021 20.5243 10.0416 20.0311C8.0622 19.5379 6.34177 18.3159 5.22409 16.6094C4.10641 14.9029 3.6738 12.8375 4.01268 10.8259C4.35156 8.81425 5.43698 7.00458 7.05207 5.75843C8.21961 4.8576 9.60179 4.29921 11.0457 4.12785C10.9753 4.19388 10.9058 4.26125 10.8371 4.32995C10.364 4.80309 9.95397 5.31623 9.60782 5.85835L11.1249 6.82706C11.4013 6.39426 11.7295 5.98317 12.1099 5.60275Z" fill="#A8A1F0"></path>
      <path d="M8.76708 16.0615C10.4371 16.0615 11.5771 15.1915 11.5771 13.9015C11.5771 13.0515 11.0471 12.5015 10.3371 12.2815C10.9571 12.0715 11.4771 11.5515 11.4771 10.7415C11.4771 9.45146 10.3771 8.68146 8.85708 8.68146C7.14708 8.68146 6.05708 9.64146 5.99708 11.0715H7.84708C7.87708 10.5215 8.24708 10.1615 8.83708 10.1615C9.36708 10.1615 9.68708 10.4415 9.68708 10.8915C9.68708 11.4115 9.25708 11.6115 8.73708 11.6115H8.17708V13.0115H8.75708C9.38708 13.0115 9.78708 13.2715 9.78708 13.7715C9.78708 14.2915 9.39708 14.5815 8.79708 14.5815C8.12708 14.5815 7.74708 14.1715 7.73708 13.4815H5.88708C5.90708 15.0915 6.95708 16.0615 8.76708 16.0615Z" fill="#A8A1F0"></path>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M15.2954 16.0615C17.1454 16.0615 18.3054 14.6915 18.3054 12.3815C18.3054 10.0415 17.1254 8.68146 15.2954 8.68146C13.4754 8.68146 12.3054 10.0515 12.3054 12.3615C12.3054 14.6915 13.4454 16.0615 15.2954 16.0615ZM15.3054 14.5615C14.6254 14.5615 14.1054 13.9815 14.1054 12.4015C14.1054 10.7615 14.6054 10.1815 15.3054 10.1815C15.9954 10.1815 16.5054 10.7615 16.5054 12.3915C16.5054 13.9815 15.9954 14.5615 15.3054 14.5615Z" fill="#A8A1F0"></path>
    </svg>
  `;
    forwardButton.addEventListener('click', () => {
        mediaElement.currentTime = Math.min(mediaElement.duration, mediaElement.currentTime + 30);
    });

    // Tidslinje og tidsvisning
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'player-slider-container';

    const currentTime = document.createElement('span');
    currentTime.className = 'player-current-time';
    currentTime.textContent = '00:00';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'player-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';

    const totalDuration = document.createElement('span');
    totalDuration.className = 'player-total-duration';
    totalDuration.textContent = formatTime(metadata.apiDuration || 0);

    mediaElement.addEventListener('timeupdate', () => {
        currentTime.textContent = formatTime(mediaElement.currentTime);
        slider.value = (mediaElement.currentTime / mediaElement.duration) * 100 || 0;
    });
    mediaElement.addEventListener('loadedmetadata', () => {
        totalDuration.textContent = formatTime(mediaElement.duration);
    });
    slider.addEventListener('input', () => {
        mediaElement.currentTime = (slider.value / 100) * mediaElement.duration;
    });

    sliderContainer.appendChild(currentTime);
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(totalDuration);

    // Lydstyrkekontrol
    const volumeContainer = document.createElement('div');
    volumeContainer.className = 'player-volume-container';

    const volumeButton = document.createElement('button');
    volumeButton.className = 'player-button';
    volumeButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M7.68439 7.10002L12.4379 3.29724L13.9001 4.00002V20L12.4379 20.7028L7.68439 16.9H5.8401C3.18799 16.9 1.1001 14.6712 1.1001 12C1.1001 9.32881 3.188 7.10002 5.8401 7.10002H7.68439ZM12.1001 5.87258L8.3158 8.90002H5.8401C4.25065 8.90002 2.9001 10.253 2.9001 12C2.9001 13.7471 4.25065 15.1 5.8401 15.1H8.3158L12.1001 18.1275V5.87258Z" fill="#A8A1F0"></path>
      <path d="M16.8804 10.3928C16.6694 9.88318 16.36 9.42018 15.97 9.03017L17.2428 7.75738C17.7999 8.31453 18.2419 8.97597 18.5434 9.70392C18.845 10.4319 19.0002 11.2121 19.0001 12C19.0001 12.788 18.845 13.5682 18.5434 14.2961C18.2419 15.0241 17.7999 15.6855 17.2428 16.2427L15.97 14.9699C16.36 14.5799 16.6694 14.1169 16.8804 13.6073C17.0915 13.0977 17.2001 12.5516 17.2001 12C17.2001 11.4485 17.0915 10.9023 16.8804 10.3928Z" fill="#A8A1F0"></path>
      <path d="M18.7273 6.27281C19.4794 7.02492 20.076 7.9178 20.4831 8.90048C20.8901 9.88315 21.0996 10.9364 21.0996 12C21.0996 13.0637 20.8901 14.1169 20.4831 15.0996C20.076 16.0822 19.4794 16.9751 18.7273 17.7272L20.0001 19C20.9194 18.0808 21.6486 16.9895 22.1461 15.7884C22.6436 14.5873 22.8996 13.3 22.8996 12C22.8996 10.7 22.6436 9.41271 22.1461 8.21165C21.6486 7.01058 20.9194 5.91927 20.0001 5.00002L18.7273 6.27281Z" fill="#A8A1F0"></path>
    </svg>
  `;
    let volumeSliderVisible = false;
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'player-volume-slider';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.01';
    volumeSlider.value = mediaElement.volume;

    volumeButton.addEventListener('click', () => {
        volumeSliderVisible = !volumeSliderVisible;
        volumeSlider.style.display = volumeSliderVisible ? 'block' : 'none';
    });
    volumeSlider.addEventListener('input', () => {
        mediaElement.volume = volumeSlider.value;
    });

    volumeContainer.appendChild(volumeButton);
    volumeContainer.appendChild(volumeSlider);

    // Samler controls: tilbage | afspil/pause | frem | fremskridtslinje | lydstyrke
    controlsContainer.appendChild(backButton);
    controlsContainer.appendChild(playButton);
    controlsContainer.appendChild(forwardButton);
    controlsContainer.appendChild(sliderContainer);
    controlsContainer.appendChild(volumeContainer);

    rightSide.appendChild(controlsContainer);

    // Tilføjer til afspillercontainer
    playerContainer.appendChild(leftSide);
    playerContainer.appendChild(rightSide);

    // Synkroniserer afspilningsknap med medieafspillerens tilstand
    mediaElement.addEventListener('play', () => updatePlayButtonState(mediaElement, playButton));
    mediaElement.addEventListener('pause', () => updatePlayButtonState(mediaElement, playButton));

    return mediaElement;
}
