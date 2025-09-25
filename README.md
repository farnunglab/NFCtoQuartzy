# NFCtoQuartzy
Tool to implement NFC tag based orders to Quartzy

**NFC → Cloudflare Worker → Quartzy “Tap‑to‑Reorder”**
Make reordering lab consumables as simple as tapping an NFC tag. When a user taps the tag, their phone opens a URL to your Cloudflare Worker. The Worker validates the link, de‑duplicates the tap, and calls the Quartzy Public API to create an Order Request.
