(async () => {
  function cleanText(text) {
    return text.trim().replace(/\s+/g, ' ');
  }

  function extractLabel(doc) {
    const labelElem = doc.querySelector('span.label');
    return labelElem ? cleanText(labelElem.textContent) : '';
  }
  function extractHeadline(doc) {
    const headlineElem = doc.querySelector('h1.article__headline');
    return headlineElem ? cleanText(headlineElem.textContent) : '';
  }
  function extractLead(doc) {
    const leadElem = doc.querySelector('div.article__lead');
    return leadElem ? cleanText(leadElem.textContent) : '';
  }
  function extractAuthors(doc) {
    const bylineElem = doc.querySelector('div.article__byline');
    if (!bylineElem) return [];
    return cleanText(bylineElem.textContent).split(/\s+og\s+/).map(a => a.trim());
  }
  function extractPublishedDate(doc) {
    const dateElem = doc.querySelector('time.article__date');
    if (dateElem && dateElem.getAttribute('datetime')) {
      const iso = dateElem.getAttribute('datetime').replace('Z', '+00:00');
      const date = new Date(iso);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
  function extractContent(doc) {
    const paragraphs = doc.querySelectorAll('div.article__content div.article__text p');
    return Array.from(paragraphs)
      .map(p => cleanText(p.textContent))
      .filter(p => p.length > 0);
  }
  function extractImages(doc) {
    const figures = doc.querySelectorAll('figure.article__figure');
    const images = [];
    figures.forEach(figure => {
      const imgWrapper = figure.querySelector('div.image__wrapper');
      const captionElem = figure.querySelector('figcaption.image__caption');
      if (imgWrapper && imgWrapper.getAttribute('data-src')) {
        images.push({
          url: imgWrapper.getAttribute('data-src'),
          caption: captionElem ? cleanText(captionElem.textContent) : ''
        });
      }
    });
    return images;
  }

  try {
    // Find article med async-url:
    const article = document.querySelector('article[data-load-async-url*="/jfm-load-article-content/"]');
    if (!article) {
      console.log('Ingen artikel med data-load-async-url fundet');
      return;
    }
    const asyncUrl = article.getAttribute('data-load-async-url');
    const baseUrl = `${location.protocol}//${location.hostname}`;
    const fullUrl = `${baseUrl}${asyncUrl}`;

    // Hent indhold
    const response = await fetch(fullUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await response.text();

    // Parse html
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    const parsedArticle = {
      label: extractLabel(doc),
      headline: extractHeadline(doc),
      lead: extractLead(doc),
      authors: extractAuthors(doc),
      published_date: extractPublishedDate(doc),
      content: extractContent(doc),
      images: extractImages(doc)
    };

    // Poll for paywall-elementer, fjern dem og indsæt content
    const maxWait = 15000;
    const intervalTime = 500;
    let waited = 0;

    const intervalId = setInterval(() => {
      const paywalls = document.querySelectorAll('.article-paywall, jfm-zephr-block');
      if (paywalls.length > 0) {
        paywalls.forEach(el => el.remove());
        console.log('Paywall-elementer fjernet');

        const container = document.querySelector('div.article__content.content[data-article-content]');
        if (container) {
          const renderedHTML = parsedArticle.content.map(p => `<div class="article__text"><p>${p}</p></div>`).join('');
          container.innerHTML = renderedHTML;
          console.log('Artikelindhold indsat i article__content');
        } else {
          console.log('Kunne ikke finde container til artikelindhold');
        }
        clearInterval(intervalId);
      } else {
        waited += intervalTime;
        if (waited >= maxWait) {
          console.log('Paywall-elementer ikke fundet inden for 15 sekunder');
          clearInterval(intervalId);
        }
      }
    }, intervalTime);

  } catch (error) {
    console.error('Fejl i content script:', error);
  }
})();

