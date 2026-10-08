# Trade Desk — getting it running

## On your computer (MySQL)

You need **MySQL running** (XAMPP, WAMP or the MySQL Installer all work; MariaDB is fine too) and **Node.js**.

```sh
npm install        # once: fetches the MySQL driver
node serve.js
```

Open http://localhost:4180 and click **Trade**.

The first start creates a database called `triple7`, builds the tables from `local-db/schema.sql`, and loads the test data. You do not have to create anything in phpMyAdmin first, but you can open it afterwards and see every table.

### Connection settings

`local-db/config.json` holds them. The defaults match a fresh XAMPP install:

```json
{ "host": "localhost", "port": 3306, "user": "root", "password": "", "database": "triple7" }
```

If your MySQL root user has a password, put it there. If the terminal prints **DATABASE NOT CONNECTED**, the line under it says what is wrong (MySQL not started, wrong password, or `npm install` not run yet).

### Test accounts

All use the password **`Triple7-Test!`**

| Sign in as | Email | Lands on |
|---|---|---|
| Admin | `desk+admin@triple7.test` | Dashboard |
| Seller | `seller1@triple7.test` … `seller8@triple7.test` | Seller dashboard |
| Buyer | `buyer1@triple7.test` … `buyer12@triple7.test` | Trade board |

`buyer9` is suspended, to show what that looks like. `seller1` can also buy, to show one account doing both.

### One account, buying and selling

The sign-in page has two tabs. **Sign In** has **Sign In As Buyer** and **Sign In As Seller** buttons. **Create Account** has a **Sign Up As Buyer / Sign Up As Seller** switch: a buyer gives only an email and a password; a seller also gives name, surname, phone, country and (optionally) a company name.

One account can do both. A buyer who presses Sign In As Seller is asked once "Sell with this account?" and, if the account has no name or phone yet, fills those in there. After that they switch between buying and selling from the Account menu or the dashboard. Admins sign in with either button and land on the dashboard.

### Adding and removing users

- **Add:** Create Account on the site.
- **Suspend or delete:** in the admin dashboard, open a seller or buyer. Deleting also removes their lots, documents and enquiries.
- **From the terminal:**

```sh
node local-db/admin.js list
node local-db/admin.js make-admin   yourname+admin@gmail.com
node local-db/admin.js remove-admin yourname+admin@gmail.com
node local-db/admin.js password     someone@example.com NewPassword123
node local-db/admin.js delete-user  someone@example.com
node local-db/admin.js reset        # wipe everything and reload the test data
```

Admins are only ever made in the database, never on the website: create the account on the site, then run `make-admin` on it (or set its `role` to `admin` in the `profiles` table in phpMyAdmin). It signs in on the normal sign-in page and lands on the dashboard.

Do not add users by typing rows into phpMyAdmin: passwords are stored hashed, so a password typed there will not work. Create the account on the site instead.

### Things that differ on your own computer

- **Confirmation email:** no real email is sent. After you create an account, the "check your inbox" screen shows an **Open the confirmation link** link (it is also printed in the terminal).
- **Google sign-in:** hidden. It needs the online database.
- **Forgot password:** use the `password` command above.

---

## When you host it (Vercel + Supabase)

**Vercel cannot run this MySQL setup as it is.** Vercel hosts the pages but does not keep a Node server or a MySQL database running. Two ways forward:

- **Supabase (already built):** follow the steps below. As soon as `js/config.js` has your Supabase keys, the site uses Supabase instead of MySQL, on your computer too. Nothing else changes.
- **Keep MySQL online:** host `serve.js` on a service that runs Node (Render, Railway, a VPS) with a hosted MySQL database, and set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` there. That needs HTTPS and real email sending added first, so ask before going this way.

About 15 minutes, once.

### 1. Create the database (free)

1. Go to https://supabase.com, sign in, and press **New project**. Any name; pick a region close to South Africa. Save the database password somewhere.
2. Wait for the project to finish setting up (a minute or two).

### 2. Build the tables

1. In Supabase open **SQL Editor** (left menu) → **New query**.
2. Open `supabase/01_schema.sql` from this folder, copy everything, paste, press **Run**. It should say "Success".
3. New query again. Copy in `supabase/02_test_data.sql` and **Run**. The result lists 21 accounts, 49 lots, 49 documents, 38 enquiries.

### 3. Connect the site

1. In Supabase open **Project Settings → API** (on newer projects: **API Keys**).
2. Copy the **Project URL** and the **anon / publishable key**.
3. Paste both into `js/config.js`:

   ```js
   window.T7_CONFIG = {
     supabaseUrl: 'https://xxxxxxxx.supabase.co',
     supabaseAnonKey: 'eyJ...'
   };
   ```

   Never paste the **service_role / secret** key anywhere in this folder.

### 4. Tell Supabase where the site lives

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:4180/signin.html`
- **Redirect URLs**, add: `http://localhost:4180/**`

Without this, the link in the confirmation email will not come back to the site.

The same test accounts as above now exist in Supabase.

### Making yourself an admin (Supabase)

There is no admin sign-up and no admin page link anywhere on the site. An admin is a normal account that the database has marked as admin. It signs in on the normal sign-in page and is taken to the dashboard.

1. On the site, **Create account** with an address such as `yourname+admin@gmail.com`. Gmail delivers anything after the `+` to your normal `yourname@gmail.com` inbox, but the site treats it as a separate account.
2. Click the link in the confirmation email.
3. In the Supabase SQL Editor run:

   ```sql
   select public.make_admin('yourname+admin@gmail.com');
   ```

4. Sign out and in again. You land on the dashboard.

That one line is the only way to make an admin (`supabase/03_make_admin.sql` has it ready, plus how to remove one).

### Confirmation emails

Email confirmation is on by default in Supabase, and the site expects it. Supabase's built-in mailer is for testing only: it sends just a few emails per hour. Before real users sign up, add your own mail service under **Authentication → Emails → SMTP Settings** (Resend, Brevo and similar have free tiers).

### Continue with Google

The button is built but hidden for now. To switch it on:

1. In Google Cloud Console create an **OAuth client ID** (type: Web application). As the **Authorised redirect URI** use the callback URL Supabase shows under **Authentication → Sign In / Providers → Google**.
2. Paste the client ID and secret into that same Supabase screen and enable Google.

3. Add `googleSignIn: true` to `js/config.js`. The button stays hidden until you do.


### Putting it on Vercel

1. Deploy the folder as it is (no build step). `supabase/`, `local-db/` and the `.md` files are not uploaded.
2. In Supabase **Authentication → URL Configuration**, change **Site URL** to `https://your-site.vercel.app/signin.html` and add `https://your-site.vercel.app/**` to **Redirect URLs** (keep the localhost one for testing).
3. **Before sharing the link**, run `supabase/99_remove_test_data.sql`. It removes every `@triple7.test` account, including the test admin whose password is written in this file.

### Already set up before buyers could also sell?

If your Supabase project was set up before October 2026, open **SQL Editor → New query**, paste in `supabase/04_buyers_can_sell.sql` and **Run** once. It keeps every account, lot and enquiry and lets accounts hold both sides. (A fresh project that runs the current `01_schema.sql` does not need it.)

### Starting over (Supabase)

Running `01_schema.sql` again wipes the Trade Desk tables and rebuilds them. Then run `02_test_data.sql` again. Do this only while you are still on test data.
