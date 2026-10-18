# Inkless

Inkless is a Vite/React drawing app that supports camera calibration, green-LED
pen tracking, and optional index-finger tracking.

## Local development

```bash
cd inkless
npm ci
npm run dev
```

For Supabase authentication, create `inkless/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The file is ignored by Git and must not be committed.

In Supabase Authentication, enable Google and add the app URL to the allowed
redirect URLs.

## GitHub Pages deployment

Pushes to `main` deploy the `inkless` app through
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml).
The published project site is:

```text
https://ele-na2011.github.io/i-want-a-drawing-tablet-but-im-broke/
```

Add these repository Actions secrets before using Google sign-in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

In Supabase, add the Pages URL above to **Authentication > URL Configuration >
Redirect URLs**. Add the same URL to the Google OAuth provider's authorized
redirect configuration if Google requires it.

GitHub Pages serves the production build over HTTPS, which is required by
browsers for camera access. Users only need a browser; they do not need Node.js,
npm, or Supabase installed locally.
