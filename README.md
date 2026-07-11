# blog

Personal website / blog built with [Astro](https://astro.build), deployed to
**Cloudflare Workers** (Static Assets), with comments powered by
[giscus](https://giscus.app) (GitHub Discussions).

## Stack

- **Astro 7** – official blog template (Markdown / MDX posts, RSS, sitemap)
- **Cloudflare Workers** – static `dist/` served via Workers Static Assets
- **giscus** – comments backed by GitHub Discussions
- **pnpm** + **Nix** devshell – reproducible toolchain (Node 22 + pnpm)

## Getting started

The toolchain is provided by the Nix flake devshell. With
[direnv](https://direnv.net) installed, `direnv allow` loads Node and pnpm
automatically. Otherwise prefix commands with `nix develop --command`.

```sh
pnpm install      # install dependencies
pnpm dev          # start the dev server at http://localhost:4321
pnpm build        # build the static site into ./dist
pnpm preview      # preview the built site via wrangler (workerd)
pnpm deploy       # build and deploy to Cloudflare Workers
```

## Project structure

```
src/
├── components/     # BaseHead, Header, Footer, Comments (giscus), ...
├── content/blog/   # blog posts (.md / .mdx)
├── layouts/        # BlogPost.astro
├── pages/          # routes (index, about, blog/, rss.xml)
├── consts.ts       # site title/description + giscus config
└── content.config.ts
astro.config.mjs    # Astro config (site URL, integrations, fonts)
wrangler.jsonc      # Cloudflare Workers config (static assets)
```

Add a post by dropping a `.md`/`.mdx` file into `src/content/blog/` with the
required frontmatter (`title`, `description`, `pubDate`; optional `heroImage`).

## Configuration to complete

### 1. Site URL

Set `site` in `astro.config.mjs` to your deployed URL (needed for correct RSS
and sitemap links), e.g. `https://blog.<your-subdomain>.workers.dev` or your
custom domain.

### 2. giscus comments

Comments are wired up but disabled until configured. Steps:

1. Push this repo to GitHub as a **public** repository.
2. Enable **Discussions**: repo → Settings → General → Features → Discussions.
3. Install the [giscus GitHub App](https://github.com/apps/giscus) on the repo.
4. Go to [giscus.app](https://giscus.app), enter the repo, and choose a
   Discussion category (e.g. *Announcements*) and mapping (*pathname*).
5. Copy the generated `data-repo-id` and `data-category-id`.
6. Fill them into the `GISCUS` object in `src/consts.ts` and set
   `enabled: true`.

The `Comments.astro` component renders the giscus embed on every blog post once
enabled.

## Deploying to Cloudflare Workers

```sh
pnpm exec wrangler login   # one-time: authenticate with Cloudflare
pnpm deploy                # astro build && wrangler deploy
```

The worker name (`blog`) and static-assets directory (`./dist`) are configured
in `wrangler.jsonc`.
