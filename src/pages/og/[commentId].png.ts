import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { generateOgImage } from '../../lib/og-image';
import { ogImageId } from '../../lib/og';

type Props = {
	title: string;
};

export const getStaticPaths = (async () => {
	const posts = await getCollection('blog');

	return posts.map((post) => ({
		params: { commentId: ogImageId(post.data.commentId, post.data.title) },
		props: { title: post.data.title },
	}));
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = async ({ props }) => {
	const image = await generateOgImage(props.title);

	return new Response(new Uint8Array(image), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
