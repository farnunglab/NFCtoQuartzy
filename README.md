# NFCtoQuartzy
A tiny workflow that lets lab members reorder common lab supplies by tapping an NFC tag (or scanning a QR code). The workflow makes use of Cloudflare Worker.

When a tag is scanned:

1. The phone opens a URL encoding for a catalog item like https://"your-worker-domain"/go?code=TIP200&qty=1.
2. The Worker verifies the signature, de‑duplicates repeats, and calls the Quartzy API to create an Order Request.
4. The user sees a confirmation page with a link to the item in Quartzy.


```
[NFC Tag / QR]
      │  opens
      ▼
https://<worker>/go?code=TIP200&qty=1
      │  signs & redirects (HMAC + timestamp)
      ▼
https://<worker>/reorder?code=...&qty=...&ts=...&sig=...
      │  verifies + dedups + submits
      ▼
  Quartzy API  ──► Order Request
      │
      ▼
  "Request submitted" page + link to Quartzy
```
---
We currently use the following NFC tags: https://www.amazon.com/dp/B09YR1BVYQ

NFC tags can be programmed with any NFC-capable smartphone (including iPhone and Android devices).
On iOS, we use "NFC Tools" to program the NFC tags.

---

## What’s in here

The Worker implements three endpoints:

- `GET /healthz` → `ok` (for uptime checks)
- `GET /go?code=CODE&qty=QTY` → validates inputs, **signs** them, and redirects to `/reorder`
- `GET /reorder?code=...&qty=...&ts=...&sig=...` → **verifies the HMAC**, deduplicates the request, and posts to Quartzy

The item catalog is embedded in the Worker under `CATALOG` as simple codes mapped to `{ name, vendor_name, catalog_number, unit_price }`.  
Example codes included: `TIP200`, `TIP20`, `NITROGEN`, `GLOVESLARGE`, `SEROLOGICAL10MLINDIVIDUAL`, etc.

Security highlights:

- **HMAC-SHA256 signatures** (using `HMAC_SECRET`) protect `/reorder` from tampering.
- **Timestamped URLs** (`ts`) with an expiration window (default **24 h**) via `ALLOWED_SKEW_MIN`.
- **Idempotency**: KV-backed short-term **dedup** prevents accidental double-submits (10‑minute window).

---

## Prerequisites

- A **Cloudflare** account with **Workers** and **KV** enabled.
- **Wrangler** CLI (v3+).
- **Quartzy** access token and the IDs you plan to submit orders to:
  - `QUARTZY_ACCESS_TOKEN`, can be obtained from here: https://app.quartzy.com/profile/access-tokens
  - `LAB_ID`, can be obtained by following the linked guide: https://docs.quartzy.com/guides/org-and-lab-ids
  - `TYPE_ID` (can be set globally, or per-item via `item.type_id` in `CATALOG`), can be obtained by running the following in a Terminal: `curl -s 'https://api.quartzy.com/types?lab_id=<LAB_ID>' \
  -H 'Access-Token: <QUARTZY_ACCESS_TOKEN>' | jq '.[] | {id, name}'`. Make sure to add your `LAB_ID` and  `QUARTZY_ACCESS_TOKEN`.

> 🔐 Never commit secrets to source control. Use Wrangler **secrets** for sensitive values (see below).

---
## Quick Setup: Wrangler + Cloudflare Workers (Steps 1–4)

## 1) Basic requirements

- A **Cloudflare account** (free is fine).
- **Node.js** and **npm** installed.
- (Optional) **Git** for version control.
- (Optional) A code editor (VS Code, etc.).

Verify your tools:

```bash
node -v
npm -v
```


## 2) Install Wrangler

Use a **local (per-project)** install (recommended), or run with `npx` on demand.

**Per-project install**
```bash
# if you're starting fresh
mkdir my-project && cd my-project
npm init -y

# add wrangler to devDependencies
npm i -D wrangler@latest

# confirm it works
npx wrangler --version
```

**On-demand (no install)**
```bash
npx wrangler --version
```

## 3) Create a new Worker project

Use **C3** (`create-cloudflare`) to scaffold a Worker:

```bash
npm create cloudflare@latest -- my-worker # This will be the name of your Worker
cd my-worker
```

Follow the prompts (typical choices):
- **Hello World** template  
- **Worker** (no D1/Pages/etc. unless you want them)  
- Choose JavaScript or TypeScript  
- Optionally initialize a Git repo

This will generate a structure like:
```
my-worker/
  ├─ src/worker.ts (or index.js)
  ├─ wrangler.jsonc
  └─ package.json
```

## 4) Authenticate Wrangler

Log in and verify your identity:

```bash
npx wrangler login
npx wrangler whoami
```

> You’ll be redirected to your browser to grant access. After logging in, `whoami` should print your Cloudflare account info.

You're now ready to run `npx wrangler dev` (local preview) and `npx wrangler deploy` (publish).

---

## Configuration of the Worker

Add the `wrangler.jsonc` to your folder and `worker.ts` to your src folder.

### 1) Worker settings (`wrangler.jsonc`)

This project uses JSONC (JSON with comments). Make sure to edit the name of your app in `wrangler.jsonc` according to the name that you gave when you generated the Worker project.

### 2) KV Namespace

If you don’t already have the KV namespace:

```bash
# Create a KV namespace and note the id
wrangler kv namespace create DEDUP
wrangler kv namespace create DEDUP --preview
# Then copy the resulting IDs into wrangler.jsonc under kv_namespaces[]
```

### 3) Secrets & environment variables

Set these with Wrangler (once per environment):

```bash
wrangler secret put QUARTZY_ACCESS_TOKEN   # See under Prerequisites how to obtain it.
wrangler secret put HMAC_SECRET    # This is a custom key phrase. You can use any key phrase you want.
wrangler secret put LAB_ID  # See under Prerequisites how to obtain it.
wrangler secret put TYPE_ID   # optional per-item override exists, See under Prerequisites how to obtain the TYPE_IDs from the Quartzy API.
```

Non-sensitive defaults are already in `vars`:
- `CURRENCY` (default `USD`)
- `ALLOWED_SKEW_MIN` (default `1440` minutes = 24 h)

---

## Deploy & Run

```bash
# Log in and verify
wrangler whoami

# Local dev (uses preview KV id)
wrangler dev

# Deploy to Cloudflare
wrangler deploy
```

> After deploy, note your Worker’s URL, e.g. `https://XXX.<your-subdomain>.workers.dev`  
> Optionally add a custom domain/route in Cloudflare (“Workers Routes”) like `https://nfc.yourlab.org/*`.

---

## Encoding the NFC tags (or QR codes)

Each tag stores a plain URL to **/go** with the item `code` and `qty`. Example:

```
https://nfc.yourlabs.workers.url.org/go?code=TIP200&qty=1 #This is the URL you want to write to the NFC tag.
```

Guidelines:
- `code` must match a key in `CATALOG` **exactly** (case-sensitive).
- `qty` must be a positive integer string (e.g., `1`, `2`, `10`).
- Prefer short, memorable codes printed on the physical label (e.g., `TIP200`, `GLOVESMEDIUM`).
- You can also generate a **QR code** with the same URL for redundancy.

> The tag URL **must** point to `/go`.

---

## Customizing the catalog

Items live in the Worker as:

```js
const CATALOG = {
  "TIP200": {
    name: "VWR® Next Generation Pipet Tip Refill System, Rainin® LTS™ Style Tips, 1–200 µL, Sterile",
    vendor_name: "VWR",
    catalog_number: "76322-532",
    unit_price: "1.00"         // price->amount sent to Quartzy
    // type_id: "..."           // optional per-item override of env.TYPE_ID
  },
  "NITROGEN": {
    name: "Liquid Nitrogen",
    vendor_name: "AirGas",
    catalog_number: "XXX",
    unit_price: "1.00"
  },
  // ...
};
```

You can:
- Add or remove codes.
- Set an item-specific `type_id` to override the global `TYPE_ID`.
- Adjust `unit_price` and `CURRENCY` (defaults to `USD`).
- Tweak `required_before` lead time by changing `14` (days) in the Worker.

---

## How the signing works (security)

- `/go` builds the message `code|qty|ts`, signs with HMAC‑SHA256 using `HMAC_SECRET`, and 302‑redirects to:

  ```
  /reorder?code=...&qty=...&ts=...&sig=<hex>
  ```

- `/reorder` recomputes the HMAC and compares using a **constant‑time** check.
- The `ts` must be within `ALLOWED_SKEW_MIN` of current time (default 24 h).
- A KV entry keyed by the signature prevents accidental double‑submissions for **10 minutes**.

**Rotation tip:** If `HMAC_SECRET` is rotated, any previously signed `/reorder` URLs will stop working until refreshed by going through `/go` again.

---

## Testing

### Health check
```bash
curl -s https://nfc.yourlab.org/healthz
# -> ok
```

### Happy path (simulate a tag)
```bash
# Step 1: Ask /go to sign and redirect
curl -i "https://nfc.yourlab.org/go?code=TIP200&qty=1"

# Look for an HTTP 302 Location header to /reorder?code=...&qty=...&ts=...&sig=...

# Step 2: Follow the redirect (browser does this automatically)
curl -iL "https://nfc.yourlab.org/go?code=TIP200&qty=1"
# Expect 201 Created with a small HTML page linking to Quartzy
```

### Common errors & fixes

- `400 Invalid code/qty`  
  Ensure the `code` exists in `CATALOG` and `qty` is a positive integer string.

- `403 URL signature expired or not yet valid`  
  The signed `/reorder` link is outside the allowed window. Use `/go` again. Check device clock drift.

- `403 Bad signature`  
  The `/reorder` URL was modified or not produced by `/go`. Always start from `/go`.

- `Already processed this request recently.`  
  The same signed link was re-used within ~10 minutes. Generate a new one via `/go`.

- `502 Quartzy API call failed`  
  Inspect Worker logs (`wrangler tail`). Verify `QUARTZY_ACCESS_TOKEN`, `LAB_ID`, and `TYPE_ID`. The response body is included in the error for debugging.

- `KV error` in logs  
  Ensure the `DEDUP` KV namespace is created and bound in `wrangler.jsonc`.

---

## Operations

- **Logs**: `wrangler tail`
- **Local dev**: `wrangler dev` (uses `preview_id` KV)
- **Deploy**: `wrangler deploy`
- **Secret rotation**: `wrangler secret put HMAC_SECRET` (then re-encode tags to `/go` URLs as usual)
- **Access control (optional)**:
  - Add **Cloudflare Access** in front of the Worker for internal-only scanning.
  - Add WAF rules / rate limits if needed.

---

## Reference: Key environment variables

| Name                   | Type    | Required | Default | Purpose                                                                 |
|------------------------|---------|---------:|:--------|-------------------------------------------------------------------------|
| `QUARTZY_ACCESS_TOKEN` | secret  | ✅       | —       | Bearer token (sent as `Access-Token`) for Quartzy API.                  |
| `LAB_ID`               | secret  | ✅       | —       | Target Quartzy lab ID for the order request.                            |
| `TYPE_ID`              | secret  | ⚠️*      | —       | Default order-request type; can be overridden per item via `item.type_id`. |
| `HMAC_SECRET`          | secret  | ✅       | —       | Secret used to sign `/reorder` URLs. Use a long, random value.          |
| `CURRENCY`             | var     | ❌       | `USD`   | Currency code for `price.amount`.                                       |
| `ALLOWED_SKEW_MIN`     | var     | ❌       | `1440`  | Max age for signed URLs (minutes).                                      |
| `DEDUP`                | KV bind | ✅       | —       | KV namespace used for 10‑minute idempotency window.                     |

\* Required unless **every** catalog item sets its own `type_id`.

---

## Example tag set for your lab

- `TIP200` — Rainin LTS 1–200 µL tips, sterile → `.../go?code=TIP200&qty=1`
- `GLOVESLARGE` — Nitrile exam gloves, Large → `.../go?code=GLOVESLARGE&qty=1`
- `NITROGEN` — Liquid nitrogen refill → `.../go?code=NITROGEN&qty=1`
- `SEROLOGICAL10MLINDIVIDUAL` — 10 mL serological pipets → `.../go?code=SEROLOGICAL10MLINDIVIDUAL&qty=1`

Print the code on the label and encode the matching URL in the tag. That’s it!



