// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Astro Blog';
export const SITE_DESCRIPTION = 'Welcome to my website!';

// giscus (GitHub Discussions based comments) configuration.
// Fill these in from https://giscus.app after enabling GitHub Discussions
// and installing the giscus app on the target repository.
// Set `enabled` to true once the values below are populated.
export const GISCUS = {
	enabled: true,
	repo: 'choplin/choplin.dev',
	repoId: 'R_kgDOTVT3wA', // data-repo-id from giscus.app
	category: 'Announcements', // Discussions category name
	categoryId: 'DIC_kwDOTVT3wM4DA-AR', // data-category-id from giscus.app
	mapping: 'pathname', // how posts map to discussions
	reactionsEnabled: '1',
	emitMetadata: '0',
	inputPosition: 'top', // 'top' | 'bottom'
	lang: 'ja',
} as const;
