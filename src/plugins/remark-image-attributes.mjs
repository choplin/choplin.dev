const WIDTH_ATTRIBUTE = /^\{\s*width\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s}]+))\s*\}/;
const VALID_WIDTH = /^(?:\d+(?:\.\d+)?)(?:px|%|rem|em|vw)?$/;

/**
 * Adds display-width support to Markdown images.
 *
 * Syntax: `![alt](image.png){width=480}`
 * A unitless value is interpreted as pixels.
 */
export default function remarkImageAttributes() {
	return (tree, file) => {
		visit(tree, file);
	};
}

function visit(node, file) {
	if (node.type === 'paragraph' && Array.isArray(node.children)) {
		applyImageWidths(node.children, file);
	}

	if (!Array.isArray(node.children)) return;

	for (const child of node.children) {
		visit(child, file);
	}
}

function applyImageWidths(children, file) {
	for (let index = 0; index < children.length - 1; index += 1) {
		const image = children[index];
		const attributes = children[index + 1];

		if (image.type !== 'image' || attributes.type !== 'text') continue;

		const match = WIDTH_ATTRIBUTE.exec(attributes.value);
		if (!match) continue;

		const value = match[1] ?? match[2] ?? match[3];
		if (!VALID_WIDTH.test(value)) {
			file.message(`Invalid image width: ${value}`, attributes);
			continue;
		}

		const width = /[a-z%]$/i.test(value) ? value : `${value}px`;
		image.data ??= {};
		image.data.hProperties ??= {};
		const currentStyle = image.data.hProperties.style;
		image.data.hProperties.style = `${typeof currentStyle === 'string' ? `${currentStyle};` : ''}width:${width}`;

		attributes.value = attributes.value.slice(match[0].length);
		if (attributes.value.length === 0) {
			children.splice(index + 1, 1);
		}
	}
}
