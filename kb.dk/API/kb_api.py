import requests
import json
import urllib.parse
import time

class ApiService:
    def __init__(self):
        self.client = requests.Session()
        self.auth_cookie = None
        self.kb_domain = "www.kb.dk"
        self.api_domain = "api.kaltura.nordu.net"
        self.ds_api_domain = "www.kb.dk"
        self.kaltura_partner_id = "397"
        self.kaltura_widget_id = "_397"
        self.kaltura_player_version = "html5:v3.14.4"

    def fetch_data(self, url):
        """Henter rå tekstdata fra en given URL."""
        headers = {'User-Agent': 'Mozilla/5.0'}

        if self.auth_cookie:
            headers['Cookie'] = self.auth_cookie

        try:
            response = self.client.get(url, headers=headers)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Kunne ikke hente data fra {url}: {e}")
            return None

    def _generate_kaltura_stream_link(self, entry_id: str, flavor_id: str, file_ext: str) -> str:
        """
        Genererer et komplet Kaltura stream-link ud fra entryId, flavorId og filendelse.
        """
        return (
            f"https://vod-cache.kaltura.nordu.net/p/{self.kaltura_partner_id}/sp/{self.kaltura_partner_id}00/serveFlavor/"
            f"entryId/{entry_id}/v/12/flavorId/{flavor_id}/name/a.{file_ext}"
        )

    def extract_media_url_from_kaltura_response(self, response_data):
        """
        Udtrækker media URL med 'flavor' og filendelse baseret på API-response.
        Forventer et multirequest-svar fra Kaltura.
        """
        try:
            data = json.loads(response_data)
            context_object = data[2]
            flavor_assets = context_object.get('flavorAssets', [])
            sources = context_object.get('sources', [])
            if not sources or not flavor_assets:
                print("Manglende 'sources' eller 'flavorAssets' i Kaltura-respons.")
                return None
            flavor_id = sources[0].get('flavorIds')

            media_object = data[1].get('objects', [])[0]
            entry_id = media_object.get('id', '')
            file_ext = flavor_assets[0].get('fileExt', '') if flavor_assets else ''

            if not (entry_id and flavor_id and file_ext):
                print("Manglende data til at bygge media URL.")
                return None

            media_url = self._generate_kaltura_stream_link(entry_id, flavor_id, file_ext)
            return media_url
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"Kunne ikke parse media-url fra Kaltura-respons: {e}")
            return None
        except Exception as e:
            print("Uventet fejl under parsing af Kaltura-respons:")
            return None

    def fetch_kaltura_data(self, entry_id):
        """Henter metadata og afspilningsinformation for en specifik Kaltura entry."""
        url = f"https://{self.api_domain}/api_v3/service/multirequest"
        json_payload = {
            "1": {
                "service": "session",
                "action": "startWidgetSession",
                "widgetId": self.kaltura_widget_id
            },
            "2": {
                "service": "baseEntry",
                "action": "list",
                "ks": "{1:result:ks}",
                "filter": {"redirectFromEntryId": entry_id},
                "responseProfile": {
                    "type": 1,
                    "fields": "id,referenceId,name,duration,description,thumbnailUrl,dataUrl,duration,msDuration,flavorParamsIds,mediaType,type,tags,startTime,date,dvrStatus,externalSourceType,status"
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
            "4": {
                "service": "metadata_metadata",
                "action": "list",
                "filter": {
                    "objectType": "KalturaMetadataFilter",
                    "objectIdEqual": "{2:result:objects:0:id}",
                    "metadataObjectTypeEqual": "1"
                },
                "ks": "{1:result:ks}"
            },
            "apiVersion": "3.3.0",
            "format": 1,
            "ks": "",
            "clientTag": self.kaltura_player_version,
            "partnerId": self.kaltura_partner_id
        }

        headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Host': self.api_domain,
            'Referer': f'https://{self.kb_domain}/find-materiale/dr-arkivet/',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0',
            'Content-Type': 'application/json'
        }

        if self.auth_cookie:
            headers['Cookie'] = f"Authorization={self.auth_cookie}"

        try:
            response = self.client.post(url, json=json_payload, headers=headers)
            response.raise_for_status()
            # logging.debug(f"Kaltura response for entry {entry_id}: {response.text}")
            return response.text
        except requests.RequestException as e:
            print(f"Kunne ikke hente Kaltura-data for entry {entry_id}: {e}")
            return None

    def authenticate(self, on_complete):
        """
        Udfører autentifikation mod KB-API'en og gemmer auth-cookie til senere brug.
        'on_complete' er en callback-funktion, der kaldes uanset resultat.
        """
        current_unix_time = int(time.time())

        cookie_header = (
            f"""ppms_privacy_6c58358e-1595-4533-8cf8-9b1c061871d0={{"visitorId":"0478c604-ce60-4537-8e17-fdb53fcd5c31","domain":{{"normalized":"{self.kb_domain}","isWildcard":false,"pattern":"{self.kb_domain}"}},"consents":{{"analytics":{{"status":1}}}}}}; """
            f"""CookieScriptConsent={{"bannershown":1,"action":"reject","consenttime":{current_unix_time},"categories":"[]","key":"99a8bf43-ba89-444c-9333-2971c53e72a6"}}"""
        )

        auth_url = f"https://{self.ds_api_domain}/ds-api/bff/v1/authenticate/"
        headers = {
            'Accept': 'application/json, text/plain, */*',
            'Cookie': cookie_header,
            'Referer': f'https://{self.kb_domain}/find-materiale/dr-arkivet/'
        }

        try:
            response = self.client.get(auth_url, headers=headers)
            response.raise_for_status()
            cookies = response.cookies.get_dict()
            auth_cookie = cookies.get("Authorization")
            if auth_cookie:
                self.auth_cookie = auth_cookie
                print("Autentificering gennemført og auth-cookie gemt.")
            else:
                print("Ingen Authorization-cookie fundet i svaret.")
        except requests.RequestException as e:
            print(f"Autentificering mislykkedes: {e}")
        finally:
            on_complete()  

    def fetch_search_results(self, search_term, start_index=0, sort_option="startTime asc", rows=10, media_type=""):
        """
        Henter søgeresultater fra KB's DR-arkiv-API.
        Understøtter medietype-filtrering for 'ds.radio' og 'ds.tv'.
        """
        encoded = urllib.parse.quote(search_term, safe='*')
        media_filter = self._build_media_filter(media_type)

        url = (
            f"https://{self.ds_api_domain}/ds-api/bff/v1/proxy/search/?q={encoded}{media_filter}"
            f"&facet=false&start={start_index}&sort={urllib.parse.quote(sort_option)}&rows={rows}"
        )

        headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Host': self.ds_api_domain,
            'Referer': f'https://{self.kb_domain}/find-materiale/dr-arkivet/find',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0'
        }

        if self.auth_cookie:
            headers['Cookie'] = f"Authorization={self.auth_cookie}"

        try:
            response = self.client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.HTTPError as e:
            print(f"HTTP {response.status_code} ved forespørgsel til søge-API: {e}")
            return None
        except requests.RequestException as e:
            print(f"Forespørgsel til søge-API mislykkedes: {e}")
            return None
        except json.JSONDecodeError:
            print("Kunne ikke parse JSON-respons fra søge-API.")
            return None

    def _build_media_filter(self, media_type):
        """Bygger media filter strengen baseret på media type."""
        if media_type in ("ds.radio", "ds.tv"):
            return f"&fq=origin%3A%22{media_type}%22"
        return ""

    def parse_search_response(self, response_data):
        """
        Parser JSON-streng til Python-objekt.
        Returnerer None hvis input er ugyldigt.
        """
        try:
            return json.loads(response_data) if response_data else None
        except json.JSONDecodeError as e:
            print(f"Kunne ikke parse søge-respons: {e}")
            return None
