import { createHash } from 'node:crypto';
import { OG_IMAGE_VERSION, OG_SITE_NAME } from '../consts';

export function ogImageId(commentId: string, title: string): string {
	const titleHash = createHash('sha256')
		.update(`${OG_IMAGE_VERSION}\0${OG_SITE_NAME}\0${title}`)
		.digest('hex')
		.slice(0, 10);
	return `${commentId}-${titleHash}`;
}

export function ogImagePath(commentId: string, title: string): string {
	return `/og/${ogImageId(commentId, title)}.png`;
}
