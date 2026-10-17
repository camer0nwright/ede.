# Putting ede. online

ede. runs on **Vercel** (hosting) with a **Turso** database, both on free plans,
at **trainwithede.com** (registered with Cloudflare). Keys and tokens are only
ever pasted into Vercel's settings and your own `.env.turso` file, never into
the code.

The server runs in London (`vercel.json`), so put the database in London too:
every page asks the database several things, and the closer they are, the
faster ede. feels.

## 1. Database (Turso)

1. Sign up at **turso.tech** (free plan). Signing in with GitHub is easiest.
2. Create a database called `ede`, in **London** (or the nearest location offered).
3. Open the database and copy its **URL**. It starts with `libsql://`.
4. Create a **token** for it (read and write, no expiry) and copy it.
5. In the project folder, create a file called `.env.turso` (it's never committed) containing:

   ```
   DATABASE_URL=libsql://...your database URL...
   DATABASE_AUTH_TOKEN=...your token...
   ```

6. Check what will happen, then set the database up:

   ```bash
   npm run db:deploy -- --check
   npm run db:deploy
   ```

   It applies every migration and loads the exercise library. Run it again
   whenever a change adds a migration; it only applies what's new, and it
   never deletes accounts. (`npm run db:seed` refuses to run on Turso, because
   it clears every account.)

## 2. Hosting (Vercel)

1. Sign up at **vercel.com** with GitHub (Hobby plan, free; it's meant for
   personal, non-commercial use).
2. **Add New → Project**, and import **camer0nwright/ede.** When GitHub asks,
   give Vercel access to that repository only.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Turso URL (`libsql://...`) |
   | `DATABASE_AUTH_TOKEN` | the Turso token |
   | `PRIVACY_CONTACT_EMAIL` | `hello@trainwithede.com` (once email forwarding works) |

   Leave `ANTHROPIC_API_KEY` out: the AI coach stays off until you choose to pay for it.
4. **Deploy.** When it's done, Vercel gives you an address like
   `ede-xxxx.vercel.app`. Open it on your phone and set up a plan.

From then on, every merge into `main` goes live automatically.

## 3. The domain (trainwithede.com)

1. In Vercel: **Project → Settings → Domains**, add `trainwithede.com`, and
   also `www.trainwithede.com` (set it to redirect to `trainwithede.com`).
2. Vercel shows the DNS records it needs (usually an **A** record for
   `trainwithede.com` and a **CNAME** for `www`). Copy the exact values it shows.
3. In Cloudflare: **trainwithede.com → DNS → Records**, add those records,
   and set **Proxy status** to **DNS only** (grey cloud) so Vercel can issue
   the https certificate.
4. Leave the email records Cloudflare added for Email Routing (MX, TXT) alone.
5. Within a few minutes Vercel shows the domain as valid, and ede. is live at
   https://trainwithede.com.

## Checks after going live

- Set up a plan, create an account, log out, log in.
- Log a workout and a run, then check History.
- Download my data, and check the privacy page shows the contact email.
