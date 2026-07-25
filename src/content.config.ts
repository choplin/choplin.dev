import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { isTagId, type TagId } from './data/tags';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Immutable, unique-per-post key for giscus comments
			// (data-term with mapping="specific"). Keeps comments attached
			// even if the post's URL/slug changes. NEVER change it once published.
			commentId: z.string(),
			// Optional: shared key linking the same post across locales
			// (en/ja) for cross-language switch links + hreflang.
			translationKey: z.string().optional(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z
				.array(
					z.custom<TagId>(isTagId, {
						message: 'Tag must be defined in src/data/tags.ts',
					}),
				)
				.max(3)
				.default([]),
		}),
});

export const collections = { blog };
