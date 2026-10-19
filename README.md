# CallPosts

AI listing agent for Facebook Marketplace pay-per-call affiliates — [callposts.com](https://callposts.com).

- `public/` — landing page (`index.html`), the app (`app.html`), admin (`admin.html`)
- `netlify/functions/` — API: listings, AI photos, market picks, landing pages, accounts/credits, admin, payments webhook
- `netlify/lib/` — shared code: access codes and credits, landing page templates and SEO score

Hosted on Netlify (Functions, Blobs, Identity, AI Gateway). Settings live in Netlify environment variables
(`ACCESS_CODES`, `ADMIN_EMAILS`, `STARTER_CREDITS`, and for payments `CHECKOUT_LINKS`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `CREDIT_PACKS`).
