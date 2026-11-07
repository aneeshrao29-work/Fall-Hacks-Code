# JepiTheGenie demo file: open this full-screen, then press Cmd+Alt+D (offline) or Cmd+Shift+Space (live).
items = [
    {"name": "pie", "price": 6.7},
    {"name": "tea", "price": 3.5},
    {"name": "cookie", "price": 2.25},
]


def checkout(items):
    total = sum(item["price"] for item in items)
    tax = total * 0.12
    print(f"total: {total + tax}"


checkout(items)
