# MyCoffee

Find coffee shops near you with live ratings from Google, on a real Google Map, with the card design from the mockup. This is the simple build: one Google key, no server to run.

## How it works (the short version)

The app runs entirely in the browser. It uses one Google key for everything: the map on the Map tab, and the nearby and search lookups that fill the cards. There is no separate backend to deploy. You lock the key to your own website so no one else can use it.

That is the easy, normal setup for a personal app. The only thing to know: the key sits inside the app rather than hidden on a server. The website restriction is what protects it. If this ever grows into a real product with lots of users, you would move the lookups behind a server, but you do not need that now.

## What you need

- Node 18 or newer (check with `node -v`).
- A Google account, and a Google Cloud project with billing turned on. Google gives a monthly free allowance, but it still asks for a card.
- A free Netlify or Cloudflare Pages account, for when you want it live on your phone.

## Step 1: Get your Google key

1. Go to the Google Cloud Console and create a project (or pick one). Make sure billing is on for it.
2. Open "APIs and Services", then "Library". Search for and Enable both of these:
   - Maps JavaScript API
   - Places API (New)
3. Open "APIs and Services", then "Credentials". Click "Create credentials", then "API key". Copy the key it gives you.
4. Click the key to edit it, and set two restrictions:
   - Application restrictions: choose "Websites". Add `http://localhost:5173/*` for now. You will add your live site later.
   - API restrictions: choose "Restrict key", and tick both "Maps JavaScript API" and "Places API (New)".
5. Save.

That one key is your `VITE_MAPS_BROWSER_KEY`.

## Step 2: Run it on your computer

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and paste your key:

```
VITE_MAPS_BROWSER_KEY=the_key_you_copied
```

Then start it:

```bash
npm run dev
```

Open the localhost link it prints. Tap "Use my location" and allow the prompt. You should see real shops near you on the Discover list, the sort tabs working, live Search, the Map tab with pins and a card at the bottom, and Saved keeping your hearts after a refresh.

Note: location only works on secure pages. localhost counts as secure, so your computer is fine. Your live site will be https, which is also fine.

## Step 3: Put it on your phone

First publish it. The built site is the `dist` folder.

Easiest with Netlify:
1. Run `npm run build`.
2. Create a new site on Netlify and drag the `dist` folder onto it (or connect the repo with build command `npm run build` and publish directory `dist`).
3. In the Netlify site settings, add an environment variable `VITE_MAPS_BROWSER_KEY` with your key, then trigger a redeploy so it picks it up.

Or with Cloudflare Pages:
```bash
npm run build
npx wrangler pages deploy dist --project-name mycoffee
```
Then add the same `VITE_MAPS_BROWSER_KEY` variable in the Pages project settings and redeploy.

Once it is live:
1. Copy your live URL (for example `https://mycoffee.pages.dev`).
2. Go back to your Google key and add that URL to the Websites restriction, as `https://your-site.example/*`. This is what lets the key work on your real site and nowhere else.
3. Open the live URL on your phone. Tap Share, then "Add to Home Screen". It installs with its own icon and opens full screen like a normal app.

## One thing you must swap before sharing it

`public/google-on-white.png` is a placeholder I put in, not Google's real logo. Google requires their official logo to appear on the screens that show shop data without the map (your Discover, Search, and Saved lists). To fix it: search "Google Maps Platform attribution logo download", get the white background version, and save it over `public/google-on-white.png` keeping the same name. Rebuild and you are set. For your own testing it is fine as is.

## Good to know

- Photos are off on purpose. The colored tiles next to each shop are the intended look from the mockup. The shops, ratings, distance, and open status are all real.
- Open or Closed comes from Google's hours. If Google has no hours for a shop, the app just shows no label rather than guessing.
- Saved looks up fresh details for each shop every time you open the tab. That is required: the rules let you store which shops you saved, but not their ratings, so it refreshes them live.
- The name "Jordan Ellis" and the Reviews and Visited numbers on the Profile tab are leftover placeholders from the mockup. Accounts are a later project.
- Costs: Google bills per request above the free monthly allowance. For personal use you will likely stay free. If you share it around, set a budget alert in Google Cloud so there are no surprises.

## Files

```
mycoffee/
  index.html            the app shell and fonts
  src/
    main.js             ties it together: state, navigation, loading data
    render.js           all six screens (the look)
    model.js            turns Google results into the card fields
    api.js              the nearby / search / details lookups
    map.js              loads Google and draws the map pins
    geo.js              your location and distance math
    storage.js          remembers your saved shops
    config.js           reads your key
  public/               icons and the logo placeholder
  .env.example
```
