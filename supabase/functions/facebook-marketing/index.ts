import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_ORIGIN = Deno.env.get("AMANAH_SITE_ORIGIN") || "https://amanahoperationsdept-beep.github.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const GRAPH_VERSION = Deno.env.get("META_GRAPH_API_VERSION") || "";
const GRAPH_BASE = "https://graph.facebook.com/" + GRAPH_VERSION;
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Missing server configuration: " + name);
  return value;
}
function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function encodeBase64(value: Uint8Array) {
  let binary = "";
  value.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return encodeBase64(new Uint8Array(digest));
}
async function encryptionKey() {
  const raw = decodeBase64(required("META_TOKEN_ENCRYPTION_KEY"));
  if (raw.length !== 32) throw new Error("META_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptToken(token: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return { token_ciphertext: encodeBase64(new Uint8Array(cipher)), token_iv: encodeBase64(iv) };
}
async function decryptToken(ciphertext: string, ivText: string) {
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(ivText) }, key, decodeBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
function serviceClient() {
  const keys = JSON.parse(required("SUPABASE_SECRET_KEYS"));
  const key = keys.default || Object.values(keys)[0];
  if (!key) throw new Error("Supabase secret key is not configured.");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function userClient(accessToken: string) {
  const keys = JSON.parse(required("SUPABASE_PUBLISHABLE_KEYS"));
  const key = keys.default || Object.values(keys)[0];
  if (!key) throw new Error("Supabase publishable key is not configured.");
  return createClient(SUPABASE_URL, key, {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function requireAdmin(request: Request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Administrator sign-in is required.");
  const client = userClient(token);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Your administrator session is invalid or expired.");
  const { data: isAdmin, error: roleError } = await client.rpc("is_amanah_admin");
  if (roleError || isAdmin !== true) throw new Error("This account is not authorized to manage Amanah Facebook Marketing.");
  return { user: userData.user, db: serviceClient() };
}
function graphVersion() {
  if (!/^v\d+\.\d+$/.test(GRAPH_VERSION)) throw new Error("Set META_GRAPH_API_VERSION to a currently supported Meta Graph API version, such as vXX.0.");
  return GRAPH_VERSION;
}
function redirectUri() {
  return Deno.env.get("META_REDIRECT_URI") || (SUPABASE_URL + "/functions/v1/facebook-marketing?action=callback");
}
async function appSecretProof(accessToken: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(required("META_APP_SECRET")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accessToken));
  return Array.from(new Uint8Array(signature)).map(v => v.toString(16).padStart(2, "0")).join("");
}
async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(GRAPH_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || "Meta Graph API request failed.");
  return data;
}
function callbackPage(ok: boolean, error?: string) {
  const payload = JSON.stringify({ type: "AMANAH_FACEBOOK_OAUTH", ok, error: error || "" }).replace(/</g, "\\u003c");
  const target = JSON.stringify(SITE_ORIGIN);
  const safeError = String(error || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const page = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Amanah Facebook Connection</title></head><body style='font-family:system-ui,sans-serif;padding:32px;text-align:center;color:#064e3b'><h2>" +
    (ok ? "Facebook Page connected" : "Facebook connection failed") +
    "</h2><p>" + (ok ? "You can close this window and return to Amanah Admin Portal." : "Return to Amanah Admin Portal and try again. " + safeError) +
    "</p><script>if(window.opener){window.opener.postMessage(" + payload + "," + target + ");}setTimeout(function(){window.close();},900);</script></body></html>";
  return new Response(page, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function handleCallback(request: Request) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) return callbackPage(false, oauthError.slice(0, 300));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return callbackPage(false, "Missing authorization code or state.");
  const db = serviceClient();
  const stateHash = await sha256(state);
  const { data: stateRow, error: stateError } = await db.from("facebook_oauth_states")
    .select("state_hash,user_id,expires_at").eq("state_hash", stateHash).maybeSingle();
  if (stateError || !stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
    return callbackPage(false, "The connection request expired. Start the connection again.");
  }
  await db.from("facebook_oauth_states").delete().eq("state_hash", stateHash);

  try {
    const version = graphVersion();
    const appId = required("META_APP_ID");
    const appSecret = required("META_APP_SECRET");
    const redirect = redirectUri();
    const exchangeUrl = new URL("https://graph.facebook.com/" + version + "/oauth/access_token");
    exchangeUrl.searchParams.set("client_id", appId);
    exchangeUrl.searchParams.set("client_secret", appSecret);
    exchangeUrl.searchParams.set("redirect_uri", redirect);
    exchangeUrl.searchParams.set("code", code);
    const shortResponse = await fetch(exchangeUrl);
    const shortData = await shortResponse.json();
    if (!shortResponse.ok || shortData.error) throw new Error(shortData.error?.message || "Could not exchange the Meta authorization code.");

    const longUrl = new URL("https://graph.facebook.com/" + version + "/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortData.access_token);
    const longResponse = await fetch(longUrl);
    const longData = await longResponse.json();
    if (!longResponse.ok || longData.error) throw new Error(longData.error?.message || "Could not obtain a long-lived Meta user token.");
    const userToken = longData.access_token || shortData.access_token;
    const proof = await appSecretProof(userToken);
    const pagesData = await graphGet("/me/accounts", {
      fields: "id,name,access_token,tasks",
      limit: "100",
      access_token: userToken,
      appsecret_proof: proof,
    });
    const pages = Array.isArray(pagesData.data) ? pagesData.data : [];
    if (!pages.length) throw new Error("No Facebook Pages were returned. Confirm this Facebook account has Page access and approve the requested permissions.");
    let savedPages = 0;
    for (const page of pages) {
      if (!page.id || !page.access_token) continue;
      const encrypted = await encryptToken(page.access_token);
      const { error: saveError } = await db.from("facebook_page_connections").upsert({
        page_id: String(page.id),
        page_name: String(page.name || "Facebook Page"),
        connected_by: stateRow.user_id,
        token_ciphertext: encrypted.token_ciphertext,
        token_iv: encrypted.token_iv,
        updated_at: new Date().toISOString(),
      }, { onConflict: "page_id" });
      if (saveError) throw new Error("Could not securely save a Page connection: " + saveError.message);
      savedPages += 1;
    }
    if (savedPages === 0) throw new Error("Meta did not return a Page access token. Check that the connecting account has permission to create content on the selected Page.");
    return callbackPage(true);
  } catch (error) {
    console.error("Meta OAuth callback failed:", error);
    return callbackPage(false, error instanceof Error ? error.message : "Meta connection failed.");
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.get("action") === "callback") {
    try { return await handleCallback(request); }
    catch (error) {
      console.error(error);
      return callbackPage(false, error instanceof Error ? error.message : "OAuth callback failed.");
    }
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const { user, db } = await requireAdmin(request);
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "connect") {
      graphVersion();
      const state = crypto.randomUUID() + crypto.randomUUID();
      const stateHash = await sha256(state);
      const { error } = await db.from("facebook_oauth_states").insert({
        state_hash: stateHash,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (error) throw new Error("Could not initialize secure Meta connection: " + error.message);
      const authUrl = new URL("https://www.facebook.com/" + GRAPH_VERSION + "/dialog/oauth");
      authUrl.searchParams.set("client_id", required("META_APP_ID"));
      authUrl.searchParams.set("redirect_uri", redirectUri());
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "pages_show_list,pages_read_engagement,pages_manage_posts");
      return json({ auth_url: authUrl.toString() });
    }

    if (action === "status") {
      const { data, error } = await db.from("facebook_page_connections")
        .select("page_id,page_name,updated_at").order("page_name");
      if (error) throw error;
      return json({ pages: data || [] });
    }

    if (action === "disconnect") {
      const pageId = String(body.page_id || "");
      if (!pageId) return json({ error: "Select a Facebook Page to disconnect." }, 400);
      const { error } = await db.from("facebook_page_connections").delete()
        .eq("page_id", pageId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "publish") {
      const pageId = String(body.page_id || "");
      const message = String(body.message || "").trim();
      const link = String(body.link || "").trim();
      if (!pageId || !message) return json({ error: "Page and post caption are required." }, 400);
      if (message.length > 5000) return json({ error: "Post caption exceeds 5,000 characters." }, 400);
      let parsedLink: URL;
      try { parsedLink = new URL(link); } catch { return json({ error: "A valid HTTPS link is required." }, 400); }
      if (parsedLink.protocol !== "https:") return json({ error: "Only HTTPS links can be published." }, 400);
      const { data: page, error: pageError } = await db.from("facebook_page_connections")
        .select("page_id,page_name,token_ciphertext,token_iv")
        .eq("page_id", pageId).maybeSingle();
      if (pageError || !page) return json({ error: "That Facebook Page is not connected to your administrator account." }, 404);
      const pageToken = await decryptToken(page.token_ciphertext, page.token_iv);
      const proof = await appSecretProof(pageToken);
      const form = new URLSearchParams();
      form.set("message", message);
      form.set("link", parsedLink.toString());
      form.set("published", "true");
      form.set("access_token", pageToken);
      form.set("appsecret_proof", proof);
      const response = await fetch(GRAPH_BASE + "/" + encodeURIComponent(pageId) + "/feed", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        console.error("Meta publish error:", result.error || result);
        return json({ error: result.error?.message || "Meta rejected the Page post. Check Page permissions and Meta App Review status." }, 502);
      }
      return json({ success: true, post_id: result.id || result.post_id || "" });
    }

    return json({ error: "Unknown Facebook Marketing action." }, 400);
  } catch (error) {
    console.error("Facebook Marketing request failed:", error);
    const message = error instanceof Error ? error.message : "Facebook Marketing request failed.";
    const status = /sign in|session|authorized|administrator/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});
