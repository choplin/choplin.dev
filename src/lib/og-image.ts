import unicodeRanges from '@fontsource-variable/noto-sans-jp/unicode.json';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { OG_SITE_NAME } from '../consts';

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_LINE_UNITS = 16.5;
const MAX_LINES = 4;
const FONT_FAMILY = 'Noto Sans JP Variable';
const LOGO_SIZE = 48;
const LOGO_LEFT = 96;
const LOGO_TOP = 532;
const logoPath = resolve(process.cwd(), 'public/icon-dark-bg.png');
const require = createRequire(import.meta.url);

type UnicodeRangeMap = Record<string, string>;

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function characterUnits(character: string): number {
	if (/\s/u.test(character)) return 0.3;
	if (/[A-Z]/u.test(character)) return 0.68;
	if (/[a-z0-9]/u.test(character)) return 0.56;
	if (/[\u0020-\u007e]/u.test(character)) return 0.45;
	return 1;
}

function textUnits(value: string): number {
	return [...value].reduce((total, character) => total + characterUnits(character), 0);
}

function tokenizeTitle(title: string): string[] {
	return title.match(/[A-Za-z0-9][A-Za-z0-9+./'-]*|\s+|./gu) ?? [];
}

function wrapTitle(title: string): string[] {
	const lines: string[] = [];
	let line = '';

	for (const token of tokenizeTitle(title)) {
		const candidate = `${line}${token}`;
		if (line.trim() && textUnits(candidate) > MAX_LINE_UNITS) {
			lines.push(line.trim());
			line = token.trimStart();
		} else {
			line = candidate;
		}
	}

	if (line.trim()) lines.push(line.trim());

	if (lines.length <= MAX_LINES) return lines;

	const visibleLines = lines.slice(0, MAX_LINES);
	visibleLines[MAX_LINES - 1] = `${visibleLines[MAX_LINES - 1].replace(/[.…]+$/u, '')}…`;
	return visibleLines;
}

function parseUnicodeRange(range: string): Array<{ start: number; end: number }> {
	return range
		.slice(2)
		.split(',')
		.map((part) => {
			const [start, end = start] = part.split('-');
			return {
				start: Number.parseInt(start, 16),
				end: Number.parseInt(end, 16),
			};
		});
}

function requiredFontSubsets(text: string): string[] {
	const ranges = unicodeRanges as UnicodeRangeMap;
	const codePoints = new Set([...text].map((character) => character.codePointAt(0)));
	const subsets = new Set<string>();

	for (const [subset, range] of Object.entries(ranges)) {
		const parsedRanges = parseUnicodeRange(range);
		if (
			[...codePoints].some(
				(codePoint) =>
					codePoint !== undefined &&
					parsedRanges.some(({ start, end }) => codePoint >= start && codePoint <= end),
			)
		) {
			subsets.add(subset);
		}
	}

	return [...subsets];
}

async function embeddedFontStyles(text: string): Promise<string> {
	const ranges = unicodeRanges as UnicodeRangeMap;
	const styles = await Promise.all(
		requiredFontSubsets(text).map(async (subset) => {
			const fileSuffix = subset.startsWith('[') ? subset.slice(1, -1) : subset;
			const fontPath = require.resolve(
				`@fontsource-variable/noto-sans-jp/files/noto-sans-jp-${fileSuffix}-wght-normal.woff2`,
			);
			const font = await readFile(fontPath);

			return `
				@font-face {
					font-family: '${FONT_FAMILY}';
					font-style: normal;
					font-weight: 100 900;
					src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');
					unicode-range: ${ranges[subset]};
				}
			`;
		}),
	);

	return styles.join('\n');
}

export async function generateOgImage(title: string): Promise<Buffer> {
	const lines = wrapTitle(title);
	const fontSize = lines.length >= 4 ? 56 : 64;
	const lineHeight = fontSize * 1.35;
	const titleHeight = lineHeight * lines.length;
	const firstBaseline = 270 - titleHeight / 2 + fontSize;
	const fontStyles = await embeddedFontStyles(`${title}${OG_SITE_NAME}`);
	const titleLines = lines
		.map(
			(line, index) =>
				`<tspan x="96" y="${firstBaseline + index * lineHeight}">${escapeXml(line)}</tspan>`,
		)
		.join('');
	const logo = await sharp(await readFile(logoPath))
		.resize(LOGO_SIZE, LOGO_SIZE)
		.png()
		.toBuffer();

	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
			<defs>
				<filter id="card-shadow" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#182033" flood-opacity="0.2" />
				</filter>
			</defs>
			<style>
				${fontStyles}
				.title {
					font-family: '${FONT_FAMILY}', sans-serif;
					font-size: ${fontSize}px;
					font-weight: 700;
					letter-spacing: -0.02em;
				}
				.site-name {
					font-family: '${FONT_FAMILY}', sans-serif;
					font-size: 32px;
					font-weight: 600;
				}
			</style>
			<rect width="${WIDTH}" height="${HEIGHT}" fill="#e9edf4" />
			<rect
				x="32"
				y="24"
				width="1136"
				height="582"
				rx="32"
				fill="#ffffff"
				stroke="#d7dde7"
				stroke-width="2"
				filter="url(#card-shadow)"
			/>
			<text class="title" fill="#0f1219">${titleLines}</text>
			<line x1="96" y1="500" x2="1104" y2="500" stroke="#d4d9e5" stroke-width="2" />
			<text class="site-name" x="164" y="567" fill="#586174">${escapeXml(OG_SITE_NAME)}</text>
		</svg>
	`;

	return sharp(Buffer.from(svg))
		.composite([{ input: logo, left: LOGO_LEFT, top: LOGO_TOP }])
		.png({ compressionLevel: 9 })
		.toBuffer();
}
