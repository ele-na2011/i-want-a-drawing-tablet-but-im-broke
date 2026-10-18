# i-want-a-drawing-tablet-but-im-broke
web app that allows pen writing to translate directly into typing, helping lots and lots of ppl!

## Supabase setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` to the Supabase project URL.
3. Set `VITE_SUPABASE_ANON_KEY` to the project anon/publishable key.
4. In Supabase Authentication, enable Google and add the app URL to the allowed redirect URLs.

Install dependencies and start the app with:

```sh
npm install
npm run dev
```
