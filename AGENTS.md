## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Writing

Blog posts are mostly work-notes (作業ログ) and technical explanations. A post is a dry record of what was actually done and observed — not a story, a tutorial, or a pitch. These are standing author preferences; hold to them even when they make the draft terser or blunter than a typical blog post.

**Voice — objective and plain.**

- State facts plainly. Avoid lyrical, narrative, or emotive phrasing ("手間取った", "最初の関門だった", "気になって調べたところ", "〜してしまう").
- No throat-clearing or self-deprecation. Don't preface a post with disclaimers about its worth ("役に立つかもしれない程度のもの"). State what it is and get into it.
- No editorializing filler ("〜がポイントである") and no structural forward-references ("これが後で効いてくる"). If a point matters, the fact itself shows it.

**Facts vs inference — never mix them; label confidence precisely.**

- Keep measured/observed facts separate from inference, and present each at its true confidence (実測 / ドキュメント / 推測).
- Anything not stated in a primary source (official docs, the actual config, a measured result) is inference — 推測 — however confident you are. Deducing undocumented behavior from your own measurements is still 推測, not established fact.
- Never state an unverified causal claim as the reason for something. If you have not tested that X causes Y (e.g. that removing a setting actually breaks things), verify it or cut the explanation — do not assert the mechanism.
- Prefer to verify. When a claim is checkable (run a command, toggle a setting and observe), check it and write the observed result rather than what "should" happen.

**Concision — cut what isn't earned.**

- Prefer terse. Remove redundant restatements.
- Drop configuration and detail unrelated to the topic, or later shown to be unnecessary.
- An unverified claim that adds nothing is cut, not hedged.

**Identifiers.** Replace real environment identifiers (host names, user names, tailnet names, internal IPs) with placeholder example values.

Frame the post around what it actually accomplishes; retitle if the real scope drifts from the initial framing.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
