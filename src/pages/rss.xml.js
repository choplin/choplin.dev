import rss from '@astrojs/rss';
import { SITE_TITLE } from '../consts';
import { UI, localePath } from '../i18n';
import { localePosts } from '../lib/posts';

export async function GET(context) {
	const posts = await localePosts('en');
	return rss({
		title: SITE_TITLE,
		description: UI.en.blog.description,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: localePath('en', `/blog/${post.slug}/`),
		})),
	});
}
