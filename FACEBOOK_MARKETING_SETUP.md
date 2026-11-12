# Amanah Facebook Marketing setup

This feature adds a Facebook Marketing tab to the existing Supabase-authenticated Admin Portal. It uses Meta OAuth and the Meta Graph API Page feed endpoint. Facebook Page tokens are encrypted with AES-256-GCM in Supabase and are never sent to browser JavaScript.

## 1. Apply the database migration

In the Supabase project used by this store, open SQL Editor and run the statements from `supabase/migrations/202611110001_facebook_marketing.sql` **one at a time**, in their listed order. Select one complete statement (from its opening keyword through the semicolon), paste it into the SQL Editor, and click **Run**. Repeat for each statement. This avoids SQL runners that reject PostgreSQL `DO` blocks or accept only one statement per execution. The statements are safe to retry.

The migration creates the OAuth-state and encrypted Page-connection tables. It does not change existing order, chat, or customer tables.

The storefront checkout also needs the additive migration `supabase/migrations/202611120001_checkout_details.sql`. Run its three `ALTER TABLE` statements in Supabase SQL Editor (or apply it with the Supabase CLI). It adds `confirm_phone`, `payment_method`, and `delivery_notes` to `public.amanah_orders` so the checkout does not discard those submitted fields. Existing order records are preserved.

## 2. Create/configure a Meta app

Open https://developers.facebook.com/apps/ and create or select a Meta app.

Add the Facebook Login product (or the current Meta Login product available in your app dashboard). Configure the Valid OAuth Redirect URI to exactly:

https://bmtikgyesxutrrupudph.supabase.co/functions/v1/facebook-marketing?action=callback

Request only the Page permissions needed for this feature:
- pages_show_list
- pages_read_engagement
- pages_manage_posts
- business_management

The integration first checks the user's Pages through `/me/accounts`. If the Page is assigned through a Business Portfolio and is not returned there, it uses the granted `business_management` permission to inspect the user's Business Portfolio Pages (owned and client Pages). This is why `business_management` is requested in addition to the Page permissions.

The Facebook user connecting the integration must have the appropriate access/tasks on the target Page and access to its Business Portfolio when applicable. Meta may require App Review and Advanced Access before users outside the app's roles can use these permissions. Use Meta's current app dashboard and permissions review requirements.

## 3. Set Supabase Edge Function secrets

In Supabase Dashboard > Edge Functions > Secrets, set:

- META_APP_ID = your Meta App ID
- META_APP_SECRET = your Meta App Secret
- META_GRAPH_API_VERSION = a currently supported Graph API version, formatted like vXX.0
- META_REDIRECT_URI = https://bmtikgyesxutrrupudph.supabase.co/functions/v1/facebook-marketing?action=callback
- META_TOKEN_ENCRYPTION_KEY = a base64-encoded random 32-byte key
- AMANAH_SITE_ORIGIN = https://amanahoperationsdept-beep.github.io

Generate the encryption key locally with:

openssl rand -base64 32

Do not commit the generated key, Meta App Secret, Page tokens, or Supabase secret/service-role key to GitHub. Keep a secure backup of the encryption key: losing it makes previously stored Page tokens undecryptable.

Supabase provides SUPABASE_URL, SUPABASE_PUBLISHABLE_KEYS, and SUPABASE_SECRET_KEYS to Edge Functions. The function uses the project secret key only server-side.

## 4. Deploy the Edge Function

From the repository root, authenticate and link the existing Supabase project:

supabase login
supabase link --project-ref bmtikgyesxutrrupudph
supabase functions deploy facebook-marketing

The function config sets verify_jwt=false because the OAuth callback is public; every administrator action separately validates the bearer token and checks public.is_amanah_admin().

## 5. Publish

After the site deployment and Edge Function deployment:
1. Sign in through the existing Amanah Admin Portal.
2. Open Facebook Marketing.
3. Click Connect Facebook Page and approve the requested permissions.
4. Select the Page, prepare the caption/link, and publish.

The connection uses OAuth state validation, long-lived Meta user-token exchange, AES-GCM encrypted Page-token storage, appsecret_proof, and server-side Page authorization.

## Important limitations

- GitHub Pages remains the static website host. The Edge Function is the secure backend.
- This integration publishes link posts using POST /{page-id}/feed. Facebook obtains the link preview from the URL's Open Graph tags. The current site has site-wide Open Graph metadata, so previews are not dynamically product-specific.
- Meta may reject publishing until the app is in the appropriate mode and has the necessary permissions/Advanced Access.
- No Meta App ID/Secret or Page token has been supplied in this repository; configure them as Supabase secrets, never in index.html.
- The code changes alone do not deploy the Supabase Edge Function or run the SQL migration.
