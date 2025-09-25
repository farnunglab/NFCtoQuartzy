var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.ts
var CATALOG = {
  // "TIP200": { name: "200 µL filtered pipette tips", vendor_name: "Vendor", catalog_number: "ABC-123", unit_price: "85.00" }
  "EXAMPLE_CODE": { name: "Example item", vendor_name: "Acme", catalog_number: "AC-001", unit_price: "1.00" },
  "EMPTYCASSETTES": { name: "Invitrogen Empty Gel Cassettes, mini, 1.0 mm", vendor_name: "Thermo Scientific", catalog_number: "NC2010", unit_price: "1.00" },
  "GEL10WELL": { name: "Invitrogen novex NuPAGE 4 12% Bis Tris Protein Gels, 1.0mm, 10 well", vendor_name: "Thermo Scientific", catalog_number: "NP0321BOX", unit_price: "1.00" },
  "TIP20": { name: "VWR LTS Compatible Pipet Tips, Reload, Non-Filtered, Sterile, 20 uL", vendor_name: "VWR", catalog_number: "76322-530", unit_price: "1.00" },
  "NITROGEN": { name: "Liquid Nitrogen", vendor_name: "AirGas", catalog_number: "XXX", unit_price: "1.00" },
  "MALTOSE": { name: "D-(+)-Maltose monohydrate,powder, BioReagent, suitable for cell culture, suitable for insect cell culture, ≥98%", vendor_name: "Sigma-Aldrich", catalog_number: "M5895-1KG", unit_price: "1.00" },
  "TOWELS": { name: "Scott® Essential C Fold Paper Towels (01510) with Fast-Drying Absorbency Pockets, 12 Packs / Case, 200 C Fold Towels / Pack", vendor_name: "Kimberly-Clark", catalog_number: "01510", unit_price: "1.00" },
  "GLOVESLARGE": { name: "Microflex® XCEED™ Powder-Free Nitrile Examination Gloves, Blue, 23.5 cm (9 3/16 ), Large", vendor_name: "Ansell", catalog_number: "163351", unit_price: "1.00" },
  "GLOVESMEDIUM": { name: "Microflex® XCEED™ Powder-Free Nitrile Examination Gloves, Blue, 23.5 cm (9 3/16 ), Medium", vendor_name: "Ansell", catalog_number: "163352", unit_price: "1.00" },
  "GLOVESSMALL": { name: "Microflex® XCEED™ Powder-Free Nitrile Examination Gloves, Blue, 23.5 cm (9 3/16 ), Small", vendor_name: "Ansell", catalog_number: "163353", unit_price: "1.00" },
  "INSECTCELLMEDIA": { name: "ESF 921 Insect Cell Culture Medium, Protein Free, 1L Bottle", vendor_name: "Expression Systems", catalog_number: "96-001-01", unit_price: "1.00" },
  "NACL": { name: "Sodium Chloride, Redi-Dri™, anhydrous, free-flowing, ACS, ≥99%", vendor_name: "Sigma-Aldrich", catalog_number: "746398-5KG", unit_price: "1.00" },
  "TIP200": { name: "VWR® Next Generation Pipet Tip Refill System, Rainin® LTS™ Style Tips, 1–200 µL, Sterile", vendor_name: "VWR", catalog_number: "76322-532", unit_price: "1.00" },
  "SEROLOGICAL50MLINDIVIDUAL": { name: "VWR® Disposable Serological Pipets, Premium Line, Capacity=50 mL, Color Code=Purple, Packaging=Individually Wrapped in Paper/Plastic, Graduations=0.5 mL, Sterility=Sterile", vendor_name: "VWR", catalog_number: "75816-088", unit_price: "1.00" },
  "SEROLOGICAL10MLINDIVIDUAL": { name: "Vwr® Disposable Serological Pipets, Premium Line, Capacity=10 mL, Color Code=Orange, Packaging=50/Bag, Graduations=0.1 mL, Sterility=Sterile", vendor_name: "VWR", catalog_number: "76184-754", unit_price: "1.00" }
};
function textResponse(status, body, type = "text/plain") {
  return new Response(body, { status, headers: { "content-type": `${type}; charset=utf-8` } });
}
__name(textResponse, "textResponse");
function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(jsonResponse, "jsonResponse");
function toHex(buf) {
  const view = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < view.length; i++) out += view[i].toString(16).padStart(2, "0");
  return out;
}
__name(toHex, "toHex");
function fromUtf8(s) {
  return new TextEncoder().encode(s);
}
__name(fromUtf8, "fromUtf8");
async function hmacSHA256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    fromUtf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, fromUtf8(message));
  return toHex(mac);
}
__name(hmacSHA256Hex, "hmacSHA256Hex");
function constantTimeEqual(hexA, hexB) {
  if (hexA.length !== hexB.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hexA.length; i++) {
    mismatch |= hexA.charCodeAt(i) ^ hexB.charCodeAt(i);
  }
  return mismatch === 0;
}
__name(constantTimeEqual, "constantTimeEqual");
function formatDateOnly(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
__name(formatDateOnly, "formatDateOnly");
function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]
  );
}
__name(escapeHtml, "escapeHtml");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/healthz") return textResponse(200, "ok");
    if (pathname === "/go") {
      const code2 = url.searchParams.get("code") ?? "";
      const qty2 = url.searchParams.get("qty") ?? "1";
      if (!code2 || !/^[1-9]\d*$/.test(qty2) || !CATALOG[code2]) {
        return jsonResponse(400, { error: "Invalid code/qty" });
      }
      const ts2 = (/* @__PURE__ */ new Date()).toISOString();
      const secret2 = (env.HMAC_SECRET || "").trim();
      const msg2 = `${code2}|${qty2}|${ts2}`;
      const sig2 = await hmacSHA256Hex(secret2, msg2);
      const target = new URL(url.origin + "/reorder");
      target.searchParams.set("code", code2);
      target.searchParams.set("qty", qty2);
      target.searchParams.set("ts", ts2);
      target.searchParams.set("sig", sig2);
      return Response.redirect(target.toString(), 302);
    }
    if (pathname !== "/reorder") {
      return textResponse(404, "Not found");
    }
    const code = url.searchParams.get("code") ?? "";
    const qtyRaw = url.searchParams.get("qty") ?? "";
    const ts = url.searchParams.get("ts") ?? "";
    const sig = url.searchParams.get("sig") ?? "";
    if (!code || !qtyRaw || !ts || !sig) {
      return jsonResponse(400, { error: "Missing or invalid query parameters: code, qty, ts, sig." });
    }
    if (!/^[1-9]\d*$/.test(qtyRaw)) {
      return jsonResponse(400, { error: "qty must be a positive integer string." });
    }
    const tsMs = Date.parse(ts);
    if (!Number.isFinite(tsMs)) {
      return jsonResponse(400, { error: "Invalid timestamp format (ts). Use ISO 8601." });
    }
    const now = Date.now();
    const maxSkewMs = (Number.parseInt(env.ALLOWED_SKEW_MIN || "1440", 10) || 1440) * 6e4;
    if (Math.abs(now - tsMs) > maxSkewMs) {
      return jsonResponse(403, { error: "URL signature expired or not yet valid." });
    }
    const secret = (env.HMAC_SECRET || "").trim();
    const msg = `${code}|${qtyRaw}|${ts}`;
    const expected = await hmacSHA256Hex(secret, msg);
    if (!constantTimeEqual(expected, sig)) {
      return jsonResponse(403, { error: "Bad signature." });
    }
    const qty = Number.parseInt(qtyRaw, 10);
    const fpKey = `fp:${expected}`;
    try {
      const seen = await env.DEDUP.get(fpKey, { cacheTtl: 60 });
      if (seen) {
        return textResponse(200, "Already processed this request recently.");
      }
      await env.DEDUP.put(fpKey, "1", { expirationTtl: 600 });
    } catch (e) {
      console.warn("KV error", e);
    }
    const item = CATALOG[code];
    if (!item) {
      return jsonResponse(400, { error: `Unknown code '${code}'. Update CATALOG in the Worker.` });
    }
    const requiredBefore = formatDateOnly(new Date(now + 14 * 24 * 60 * 60 * 1e3));
    const payload = {
      lab_id: env.LAB_ID,
      type_id: item.type_id || env.TYPE_ID,
      name: item.name,
      vendor_name: item.vendor_name,
      catalog_number: item.catalog_number,
      price: { amount: item.unit_price, currency: env.CURRENCY || "USD" },
      quantity: qty,
      required_before: requiredBefore,
      notes: `Requested via NFC (${code}).}`
    };
    const res = await fetch("https://api.quartzy.com/order-requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Access-Token": env.QUARTZY_ACCESS_TOKEN
      },
      body: JSON.stringify(payload)
    });
    if (res.status !== 201) {
      const text = await res.text();
      console.error("Quartzy error", res.status, text);
      return jsonResponse(502, { error: "Quartzy API call failed", status: res.status, body: text });
    }
    const created = await res.json();
    const appUrl = created?.app_url || "https://app.quartzy.com/";
    const html = `<!doctype html>
<meta charset="utf-8">
<title>Request submitted</title>
<body style="font:14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:24px">
  <h1>Request submitted</h1>
  <p>Item: <b>${escapeHtml(item.name)}</b></p>
  <p>Quantity: <b>${qty}</b></p>
  <p><a href="${appUrl}">Open in Quartzy</a></p>
</body>`;
    return new Response(html, { status: 201, headers: { "content-type": "text/html; charset=utf-8" } });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
