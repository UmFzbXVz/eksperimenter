document.addEventListener('DOMContentLoaded', async() => {
            const resultDiv = document.getElementById('result');

            function cleanText(text) {
                return text.trim().replace(/\s+/g, ' ');
            }

            function extractLabel(soup) {
                const labelElem = soup.querySelector('span.label');
                return labelElem ? cleanText(labelElem.textContent) : '';
            }

            function extractHeadline(soup) {
                const headlineElem = soup.querySelector('h1.article__headline');
                return headlineElem ? cleanText(headlineElem.textContent) : '';
            }

            function extractLead(soup) {
                const leadElem = soup.querySelector('div.article__lead');
                return leadElem ? cleanText(leadElem.textContent) : '';
            }

            function extractAuthors(soup) {
                const bylineElem = soup.querySelector('div.article__byline');
                if (!bylineElem) return [];
                return cleanText(bylineElem.textContent).split(/\s+og\s+/).map(a => a.trim());
            }

            function extractPublishedDate(soup) {
                const dateElem = soup.querySelector('time.article__date');
                if (dateElem && dateElem.getAttribute('datetime')) {
                    const iso = dateElem.getAttribute('datetime').replace('Z', '+00:00');
                    const date = new Date(iso);
                    return isNaN(date.getTime()) ? null : date;
                }
                return null;
            }

            function extractContent(soup) {
                const paragraphs = soup.querySelectorAll('div.article__content div.article__text p');
                return Array.from(paragraphs)
                    .map(p => cleanText(p.textContent))
                    .filter(p => p.length > 0);
            }

            function extractImages(soup) {
                const figures = soup.querySelectorAll('figure.article__figure');
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
                const [tab] = await browser.tabs.query({
                    active: true,
                    currentWindow: true
                });
                const url = new URL(tab.url);
                const baseUrl = `${url.protocol}//${url.hostname}`;

                const results = await browser.tabs.executeScript(tab.id, {
                    code: `
        const article = document.querySelector('article[data-load-async-url*="/jfm-load-article-content/"]');
        article ? article.getAttribute('data-load-async-url') : null;
      `
                });

                const asyncUrl = results[0];
                if (asyncUrl) {
                    const fullUrl = `${baseUrl}${asyncUrl}`;
                    resultDiv.innerHTML = `
        <p><strong>Indhold (raw):</strong></p>
        <pre id="article-content">Indlæser...</pre>
      `;
                    resultDiv.className = 'found';

                    try {
                        const response = await fetch(fullUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0'
                            }
                        });
                        const text = await response.text();
                        const contentDiv = document.getElementById('article-content');
                        contentDiv.textContent = text;

                        const parser = new DOMParser();
                        const doc = parser.parseFromString(text, 'text/html');

                        const article = {
                            label: extractLabel(doc),
                            headline: extractHeadline(doc),
                            lead: extractLead(doc),
                            authors: extractAuthors(doc),
                            published_date: extractPublishedDate(doc),
                            content: extractContent(doc),
                            images: extractImages(doc)
                        };

                        // Render in popup
                        const parsedDiv = document.createElement('div');
                        parsedDiv.innerHTML = `
          <hr>
          <h3>${article.headline}</h3>
          <p><em>${article.label}</em></p>
          <p><strong>Overskrift:</strong> ${article.lead}</p>
          <p><strong>Af:</strong> ${article.authors.join(', ')}</p>
          <p><strong>Udgivet:</strong> ${article.published_date ? article.published_date.toLocaleString() : 'Unknown'}</p>
          <h4>Indhold:</h4>
          <ul>${article.content.map(p => `<li>${p}</li>`).join('')}</ul>
          <h4>Billeder:</h4>
          <ul>${article.images.map(img => `
            <li>
              <a href="${img.url}" target="_blank">${img.url}</a><br>
              <em>${img.caption}</em>
            </li>
          `).join('')}</ul>
        `;
        resultDiv.appendChild(parsedDiv);

const renderedHTML = article.content.map(p => `<div class="article__text"><p>${p}</p></div>`).join('');

await browser.tabs.executeScript(tab.id, {
  code: `
    (function pollRemoveAndInsert() {
      const maxWait = 10000; 
      const intervalTime = 500; 
      let waited = 0;

      const intervalId = setInterval(() => {
        const paywalls = document.querySelectorAll('.article-paywall');
        if (paywalls.length > 0) {
          paywalls.forEach(el => el.remove());
          console.log('Alle .article-paywall elementer fjernet');

          const container = document.querySelector('div.article__content.content[data-article-content]');
          if (container) {
            const renderedHTML = ${JSON.stringify(article.content.map(p => `<div class="article__text"><p>${p}</p></div>`).join(''))};
            container.innerHTML = renderedHTML;
            console.log('Artikelindhold indsat i article__content');
          } else {
            console.log('Kunne ikke finde container til artikelindhold');
          }

          clearInterval(intervalId);
        } else {
          waited += intervalTime;
          if (waited >= maxWait) {
            console.log('.article-paywall ikke fundet inden for 10 sekunder');
            clearInterval(intervalId);
          }
        }
      }, intervalTime);
    })();
  `
});

      } catch (fetchError) {
        const contentDiv = document.getElementById('article-content');
        contentDiv.textContent = `Fetch error: ${fetchError.message}`;
      }

    } else {
      resultDiv.textContent = 'Ingen paywalls fundet på denne hjemmeside. Hvis det er en fejl, får du hermed en undskyldning: Undskyld. Jeg prøvede mit bedste, men det var åbenlyst ikke nok.';
      resultDiv.className = 'not-found';
    }

  } catch (error) {
    resultDiv.textContent = `Error: ${error.message}`;
    resultDiv.className = 'error';
  }
});
