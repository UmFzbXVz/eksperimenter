import requests
import json

# URL til API
url = "https://appapi.bog-ide.dk/api/product/getAllProducts"

# Filnavn på output-filen
output_file = "BOI_brugerdata.json"

# HEADERS til anmodningen
headers = {
    "accept": "application/json",
    "Accept-Encoding": "gzip",
    "Connection": "Keep-Alive",
    "Content-Length": "173",
    "Content-Type": "application/json",
    "Host": "appapi.bog-ide.dk",
    "User-Agent": "okhttp/4.10.0"
}

# Initialiser paginering
pageindex = 0
page_size = 999
total_count = None

# Dictionary til at gemme brugerdata
user_data = {}

# Hent data fra API, behandl det og gem brugerdata
while total_count is None or pageindex * page_size < total_count:
    payload = {
        "pageindex": pageindex,
        "pageSize": page_size,
        "sortByField": "score",
        "searchString": "*",
        "sortDirection": 1,
    }

    response = requests.post(url, headers=headers, json=payload)
    data = response.json()

    if total_count is None:
        total_count = data["totalCount"]
        print(f"Datapunkter: {total_count}")

    print(f"Side {pageindex + 1}: Indhentet {len(data['products'])} datapunkter")

    # Behandl data for at udtrække brugerinformation
    for product in data["products"]:
        if "recentReviews" in product:
            for review in product["recentReviews"]:
                user_email = review.get("userEmail", None)
                user_real_name = review.get("userRealName", "Ukendt Navn")
                if user_email:  # Kun brugere med en gyldig email
                    user_data[user_email] = user_real_name

    pageindex += 1

# Gem det endelige resultat i en fil
with open(output_file, "w", encoding="utf-8") as file:
    json.dump(user_data, file, ensure_ascii=False, indent=2)

print(f"Brugerdata gemt til {output_file}")
