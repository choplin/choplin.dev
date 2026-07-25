interface TagDefinition {
	label: string;
	description: string;
}

export const TAGS = {
	postgresql: {
		label: 'PostgreSQL',
		description: 'PostgreSQL本体、拡張、運用、SQL実装に関する記事',
	},
	zig: {
		label: 'Zig',
		description: 'Zig言語やZigによる開発に関する記事',
	},
	wsl: {
		label: 'WSL',
		description: 'WSLの構成、設定、運用に関する記事',
	},
	homelab: {
		label: 'Homelab',
		description: '個人所有環境でのサーバー構築・運用に関する記事',
	},
} as const satisfies Record<string, TagDefinition>;

export type TagId = keyof typeof TAGS;

export function isTagId(value: unknown): value is TagId {
	return typeof value === 'string' && Object.hasOwn(TAGS, value);
}
