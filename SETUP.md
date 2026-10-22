# forex001 setup

The dashboard is a static website. It reads public Binance BTC market data and ECB reference exchange rates. Sign-in gates the dashboard UI; it does not make public market data private, connect to Pocket Option, or place trades.

## Configure account sign-in

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. In the Supabase project settings, copy the **Project URL** and the public **publishable key** (or legacy `anon` key). Never use a `service_role` or secret key in a browser.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add:
   - `SUPABASE_URL`: the Supabase Project URL.
   - `SUPABASE_ANON_KEY`: the public publishable/anon key.
4. In Supabase **Authentication → URL Configuration**, set the site URL to the GitHub Pages address and add that exact address as a redirect URL. The address is usually `https://<account>.github.io/<repository>/`.
5. Keep Supabase email confirmation enabled. For email/password accounts, use Supabase's hosted email confirmation flow.

The GitHub Pages workflow writes these values into `auth-config.js` during deployment. The publishable/anon key is designed for browser use; access control for any future private database tables must be enforced with Supabase Row Level Security policies. Do not add service-role keys, broker credentials, or other server secrets to this website.

If the GitHub Actions secrets are missing, the site shows a setup-required screen and does not display the dashboard.  To grant the site owner free Plus access, set the authenticated Supabase user's trusted `app_metadata.role` to `owner` using a secured server-side/admin operation. This enables alerts and up to seven symbols without payment. Never set owner or Plus claims from browser code or user-editable `user_metadata`. The owner email is not embedded in the public website source.

## Optional M-Pesa subscription

The website describes a free tier (up to four watchlist symbols) and a Plus tier (KES 1,000 per month, up to seven symbols and browser alerts when the selected asset's rule-based BUY/SELL setup changes). After manually verifying payment, grant a paid customer Plus by setting that authenticated user's trusted `app_metadata.plus_access` to `true` through a secured server-side/admin operation. The owner role also grants Plus access without payment. Never set either claim from browser code or user-editable `user_metadata`. These client-side checks gate dashboard features only; they are not secure authorization for private data or backend services.

The site publicly displays the owner's manually supplied M-Pesa phone number for Send Money payments. Customers must request access from the owner after payment; **the website does not initiate, receive, or verify payments, and does not automatically grant Plus access**. There are no automatic renewals. Browser alerts only run while the dashboard is open, monitor the currently selected asset, and require the customer to enable browser notifications; they are indicators, not guaranteed profits or personalized financial advice. Forex prices are daily ECB reference rates, not live broker quotes.

GitHub Pages only serves static files. Before taking payments, deploy a secure HTTPS backend that:

1. Uses a registered Safaricom Daraja business shortcode and the appropriate Daraja application credentials. Store all Daraja secrets only in the backend host's secret manager.
2. Accepts an authenticated customer's explicit request to start a one-month subscription, validates the amount and phone number server-side, and initiates a customer-confirmed M-Pesa STK Push to the merchant business account.
3. Verifies the Daraja payment callback server-side, validates the transaction and amount, handles duplicate callbacks safely, and records the subscription expiry for the signed-in account.
4. Exposes a protected subscription-status endpoint. The site must grant Plus access only from this verified status, never from a browser flag, receipt text, or local storage.
5. Sends clear KES 1,000/month pricing and renewal terms before checkout. Renew monthly only after the customer initiates and confirms each payment; this setup does not enable automatic recurring charges.

Also provide appropriate privacy, refund, and customer-support details before launch. Test the backend with Daraja sandbox credentials before production. Do not request or store a visitor's M-Pesa PIN, OTP, or broker credentials. Do not enter Daraja secrets into GitHub Pages, the HTML, or `auth-config.js`.

## Publish with GitHub Pages

1. Create a GitHub repository and add `boby_bot.html`, `auth-config.js`, `SETUP.md`, and `.github/workflows/pages.yml`.
2. Add the Supabase Actions secrets above.
3. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
4. Push the files to the repository's `main` branch. The workflow publishes the site and shows its URL in the deployment.

The live repository is `https://github.com/morganasledders-beep/forex001`. Push website changes to its `main` branch to trigger the workflow. The workflow deploys the dashboard but does not deploy a payment backend or activate payments.

## Local preview

For a local preview on Windows, open PowerShell in the website folder and run:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000/boby_bot.html`. Authentication needs a configured Supabase project URL and publishable/anon key. Do not put a `service_role` key in `auth-config.js`.
