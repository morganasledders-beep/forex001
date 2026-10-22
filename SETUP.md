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

If the GitHub Actions secrets are missing, the site shows a setup-required screen and does not display the dashboard.

## Publish with GitHub Pages

1. Create a GitHub repository and add `boby_bot.html`, `auth-config.js`, `SETUP.md`, and `.github/workflows/pages.yml`.
2. Add the Supabase Actions secrets above.
3. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
4. Push the files to the repository's `main` branch. The workflow publishes the site and shows its URL in the deployment.

This workspace is not connected to a GitHub repository, so the workflow cannot publish the site until you create or select a repository and push these files.

## Local preview

For a local preview on Windows, open PowerShell in the website folder and run:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000/boby_bot.html`. Authentication needs a configured Supabase project URL and publishable/anon key. Do not put a `service_role` key in `auth-config.js`.
