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

## Vercel deployment

The repository includes a root
[`vercel.json`](../vercel.json) that builds the `inkless` app and publishes its
Vite output from `inkless/dist`.

In Vercel:

1. Import this GitHub repository.
2. Leave the project root set to the repository root.
3. Add these Environment Variables for Production, Preview, and Development:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

Vercel provides HTTPS, which browsers require for camera access. Users only
need a browser; they do not need Node.js, npm, or Supabase installed locally.

After deployment, add the Vercel domain (for example,
`https://your-project.vercel.app`) to Supabase **Authentication > URL
Configuration > Redirect URLs** and to the Google OAuth provider's authorized
redirect configuration.

## GitHub Pages deployment

If GitHub Pages is enabled for this repository, configure the same
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values as repository Actions
secrets. Add the published Pages URL to Supabase **Authentication > URL
Configuration > Redirect URLs** and to the Google OAuth provider's authorized
redirect configuration.
