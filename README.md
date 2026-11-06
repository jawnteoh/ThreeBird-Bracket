# Threebird Amateur Soccer Tournament

A static web page for the Threebird tournament: a 10-team round robin with a live league table, a knockout bracket (quarterfinals, semifinals, final) and a settings page for team names and colors.

No build step. It is plain HTML, CSS and JavaScript, plus an optional free Supabase backend so everyone sees the same live tournament.

- **Visitors** see the table, fixtures and bracket update live. They cannot edit anything.
- **The organizer** signs in with the lock icon (top right of the tab bar) and can then enter scores, names and colors. The Settings tab only appears when signed in.
- Without the backend (leave `config.js` empty) the page still works, but each browser keeps its own private copy and anyone can edit it.

## 1. Set up the backend (Supabase, free)

1. Create an account and a new project at https://supabase.com.
2. Open **SQL Editor > New query**, paste the contents of `supabase/setup.sql`, and click **Run**. This creates the table, makes it readable by everyone, writable only by signed-in users, and turns on live updates.
3. Open **Authentication > Users > Add user > Create new user**. Enter the organizer's email and a password, and tick **Auto Confirm User**.
4. Open **Authentication** settings (Sign In / Providers) and turn **off** "Allow new users to sign up", so nobody else can create an account.
5. Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key into `config.js`:

```js
window.TB_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-PUBLIC-KEY"
};
```

The anon key is meant to be public; the database rules in `setup.sql` are what protect writes. Never put the `service_role` key in this repository.

## 2. Publish on GitHub Pages

1. Create a GitHub repository and push these files to the `main` branch.
2. In the repository open **Settings > Pages**. Under **Build and deployment** set **Source** to **Deploy from a branch**, choose `main` and `/ (root)`, then save.
3. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Files

- `index.html`, `styles.css`, `app.js`: the page.
- `config.js`: your Supabase URL and anon key.
- `supabase/setup.sql`: one-time database setup.
- `assets/`: crest and background texture.
- Fonts (Anton and Barlow) load from Google Fonts.
