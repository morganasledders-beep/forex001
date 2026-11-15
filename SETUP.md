# forex001 setup

The dashboard is a static website. Its native watchlist reads public Binance BTC market data and ECB reference exchange rates; the separate Global Market Explorer embeds TradingView's public chart widget. Sign-in gates the dashboard UI; it does not make market data private, connect to Pocket Option, or place trades.

## Configure account sign-in

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. In the Supabase project settings, copy the **Project URL** and the public **publishable key** (or legacy `anon` key). Never use a `service_role` or secret key in a browser.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add:
   - `SUPABASE_URL`: the Supabase Project URL.
   - `SUPABASE_ANON_KEY`: the public publishable/anon key.
4. In Supabase **Authentication → URL Configuration**, set the site URL to the GitHub Pages address and add that exact address as a redirect URL. The address is usually `https://<account>.github.io/<repository>/`.
5. Email confirmation is currently disabled in this Supabase project so new members can create an account and sign in without confirmation email delivery. The dashboard includes password reset, but Supabase's default SMTP only delivers to pre-authorized team addresses and is rate-limited. Configure a custom SMTP provider in Supabase Authentication settings for public users; then reset emails can be delivered to members. Email addresses remain unverified unless you enable **Confirm email**. For password recovery, ensure the GitHub Pages URL is allowed as a redirect URL (step 4), and configure custom SMTP under Supabase **Authentication → Emails**. The website requests reset links through Supabase and allows members to choose a new password after following the email link.

The GitHub Pages workflow writes these values into `auth-config.js` during deployment and stops with a clear error if either required secret is missing or the URL is not HTTPS. The publishable/anon key is designed for browser use; access control for any future private database tables must be enforced with Supabase Row Level Security policies. Do not add service-role keys, broker credentials, or other server secrets to this website.

If the GitHub Actions secrets are missing, the Pages deployment fails rather than publishing a site with broken authentication. Configure both secrets, then rerun the workflow.

## Install FOREX001 as an app

FOREX001 is published as an installable Progressive Web App (PWA). On Android or desktop Chrome/Edge, open the GitHub Pages website and choose **Install app** (or the browser's **Install FOREX001** menu item). On iPhone/iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**. The first online visit installs a cached application shell so the dashboard itself can open offline; live prices, sign-in, cTrader, and notifications still require an internet connection and, where applicable, the site to remain open.

Installed copies check for app updates when opened and periodically while running. When an update is ready, FOREX001 shows an **Update now** prompt; accepting it reloads the app with the latest files, while **Later** keeps the current version until the user chooses to update. The app cannot send an update notice while fully closed; users should open it online to check. For each future release, update the service-worker cache version so installed copies can detect the new release.

## Market analysis and alerts
Use the **Overview** and **Global Markets** navigation buttons to switch between the main dashboard and a full-width in-app market explorer. The TradingView chart loads when you open Global Markets and remains embedded in FOREX001.

The Price chart and embedded TradingView chart zoom independently. Use the Price chart's **+**/**-** controls or Ctrl+mouse-wheel over that chart; use TradingView's own **+**/**-** toolbar controls for the OANDA chart. These controls zoom only their respective chart, not the browser page.

The native price chart updates from the selected market feed. Zoom with the **+** and **-** controls or Ctrl+mouse-wheel; the 1x to 8x levels show progressively fewer recent candles, and **Reset** returns to the full chart. Zoom changes only the visible chart window, not indicators or paper-trade calculations.

The Global Market Explorer stays embedded in FOREX001. Its **View [symbol] in app** link scrolls to the selected TradingView chart rather than opening a separate page. The S&P 500 preset uses `OANDA:SPX500USD`, an OANDA CFD, because TradingView restricts the exact `SP:SPX` symbol from embedded charts. The CFD tracks the S&P 500 market but is not the cash index; entering `SP:SPX` shows an explanation and offers the in-app CFD instead.

The dashboard clock shows the device's local date, time, and time-zone abbreviation. It updates every second; automatic seasonal themes are rechecked at local date changes. While the signed-in dashboard is open, the selected BTC chart uses Binance's live stream and watchlist prices refresh every minute. Returning to the tab triggers fresh market data after browser throttling. FX reference rates are published daily on business days; the app cannot force a new rate before the source publishes one. Live data does not refresh while the app/browser is closed, and requires an internet connection.

The holiday greeting banner wishes users well on recognized dates, including Christmas, New Year, Valentine's Day, Halloween, Easter, International Women's Day, and selected Kenyan public holidays, regardless of the selected theme. Choosing a holiday theme manually also displays its greeting on other dates; outside recognized dates, non-holiday themes leave the banner hidden.

The dashboard's BTC/USDT analysis uses Binance spot data on the selected 1m, 5m, 15m, 30m, 1h, 4h, or 1d timeframe. The price chart uses an angular blue line over a darkened mountain photograph (`mountain-chart.jpg`), a right-side price scale, and space ahead of the latest point. The bundled background photo is served locally by GitHub Pages and is covered by the Unsplash License; the chart remains functional if the image is unavailable. SMA20/50, Wilder RSI14, MACD (12, 26, 9), ATR14 from OHLC history, current volume relative to its 20-bar average where volume is supplied, and a simple price/average trend label remain in the analysis panel. cTrader volume is broker-reported trendbar volume (often tick volume), not centralized FX market volume. The chart presents closing prices; ATR and support/resistance use actual high/low data where supplied. Its BUY/SELL setup rules use only price, moving averages, and RSI and describe indicator conditions; they do not predict outcomes or place trades. Plus browser notifications are for the selected timeframe and signal changes, require browser permission, and work only while the dashboard is open. Enabling notifications also displays the current non-WAIT setup, if one is already present. The Paper trade panel has a separate opt-in browser notification for when the cTrader service becomes configured; it polls while the signed-in dashboard is open, requires browser permission, and cannot alert when the site is closed.

The native FOREX001 price chart defaults to its mountain-line presentation and also offers line, area, candlestick, and OHLC-bar styles; every style retains the darkened mountain photograph as its background. Candlesticks/OHLC bars require open/high/low data; closing-price-only ECB reference rates keep the selected preference but display the mountain-line fallback until an OHLC source is selected. Chart style is visual only and does not change indicators or paper-trade calculations. The shared dashboard bar offers Auto, Classic, Christmas, New Year, Valentine's Day, Halloween, Spring, Summer, Autumn, and Winter themes on both dashboards. Auto follows holiday dates and the Northern Hemisphere calendar; manually selected themes remain selected through holidays. Each theme has bundled decorative artwork with gentle animation, disabled when the device requests reduced motion. Christmas also adds slow, click-through snowfall across the app; the snowfall is disabled when reduced motion is requested. All palettes and artwork are included in the app rather than downloaded at runtime, so they remain available offline after the app shell is cached. The preference is stored in the browser.

The separate **Global Market Explorer** embeds TradingView's Advanced Chart widget. Use its built-in symbol search or the preset list to view TradingView-supported stocks, indices, forex, cryptocurrencies, and commodity futures; coverage depends on TradingView's available symbols. The S&P 500 preset is `OANDA:SPX500USD`, an OANDA CFD rather than the cash index, because TradingView restricts `SP:SPX` from embedded charts. The embedded data is not exported to FOREX001 and does not change the dashboard watchlist, indicators, paper-trade prices/P&L, or broker connections. TradingView states that forex and crypto widget data is real-time, stock data is delayed, and other exchange delays vary. The widget is a third-party service and may receive the selected symbol and normal browser request metadata. See [TradingView widget data details](https://www.tradingview.com/widget-docs/faq/data/) and [available markets](https://www.tradingview.com/widget-docs/markets/).

Forex uses daily ECB reference rates until the signed-in member connects a cTrader account. The optional cTrader integration lists authorized live (real-money) and demo (practice) accounts in separate selector groups, identifies the selected account type, and requests historical broker candles for the selected pair/timeframe. It calculates the same indicator set from those candles. Account availability depends on the cTrader authorization and broker; account balances and trading controls are not shown. It uses view-only `accounts` authorization; it never requests `trading` permission or sends broker orders. The on-page connection and Plus setup alerts require the dashboard to stay open and refresh on the dashboard's polling interval. Market data and indicator setups are not guaranteed live execution prices or profitable predictions.

### Deploy the cTrader read-only backend

The source is in `supabase/functions/ctrader/index.ts`; the encrypted-token table is created by the migration in `supabase/migrations/`. GitHub Pages does not deploy Supabase functions or database migrations. Deploy these to the same Supabase project used by FOREX001:

1. Install the Supabase CLI and run `supabase login`, then from the repository run `supabase link --project-ref amphifjvtqlsfrkdluen` and `supabase db push`.
2. In **Supabase → Edge Functions → Secrets**, set `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, and `CTRADER_ENCRYPTION_KEY`. The encryption key must be a new random 32-byte value, base64-encoded; generate it locally and store it only in Supabase. Never paste these values into chat, GitHub, or the website. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.
3. Deploy with `supabase functions deploy ctrader`. `supabase/config.toml` disables the platform JWT gate because the OAuth callback is public; the function itself validates the signed-in Supabase user for every browser action and validates a short-lived HMAC state for the callback.
4. In the cTrader Open API portal, register this exact redirect URI for the app: `https://amphifjvtqlsfrkdluen.supabase.co/functions/v1/ctrader`. This must replace/add to the GitHub Pages URL registered earlier; OAuth redirects to the server callback. Grant only the **accounts / view-only** permission. Do not grant trading permission.
5. Sign in to FOREX001, choose **Connect cTrader**, approve the read-only request, then choose the intended ForexMG demo/live account in the dashboard. Select a forex pair and timeframe to load candle history and indicator analysis.

The callback stores cTrader tokens encrypted at rest in a table inaccessible to `anon` and `authenticated` roles; only the function's service role can access it. Disconnect removes the stored tokens from this app; revoke the app's authorization separately in cTrader if you want to invalidate the grant. cTrader market data is requested when the dashboard loads/refreshes; this is not a continuously running tick stream.

To grant the site owner free Plus access, set the owner's authenticated Supabase user's trusted `app_metadata.role` to `owner` using a secured server-side/admin operation after Supabase is configured. The dashboard recognizes that trusted claim, hides the public payment instructions for that account, and enables alerts plus up to seven symbols. Do not set this claim from browser code or user-editable `user_metadata`. The owner email is not embedded in the public website source.

## Optional M-Pesa subscription

The website describes a free tier (up to four watchlist symbols) and a Plus tier (KES 1,000 per month, up to seven symbols and browser alerts for the selected live BTC or connected cTrader FX setup on the selected timeframe). Forex without a cTrader connection uses daily ECB reference rates and has no live alerts. After manually verifying payment, grant a paid customer Plus by setting that authenticated user's trusted `app_metadata.plus_access` to `true` through a secured server-side/admin operation. The owner role also grants Plus access without payment. Never set either claim from browser code or user-editable `user_metadata`. These client-side checks gate dashboard features only; they are not secure authorization for private data or backend services.

The site publicly displays the owner's manually supplied M-Pesa phone number for Send Money payments. Customers must request access from the owner after payment; **the website does not initiate, receive, or verify payments, and does not automatically grant Plus access**. There are no automatic renewals. Browser alerts only run while the dashboard is open, monitor the selected BTC/USDT or cTrader-connected FX setup, and require the customer to enable browser notifications; they are indicators, not guaranteed profits or personalized financial advice. Forex without cTrader uses daily ECB reference rates, not live broker quotes.

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
