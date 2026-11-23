// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const site = process.env.SITE_URL || 'https://zerovisual.hotcode.dev/';
const base = process.env.DOCS_BASE_PATH || (process.env.GITHUB_PAGES ? '/zerovisual' : '/');
const normalizedBase = base.endsWith('/') ? base : `${base}/`;
const ogImageUrl = new URL(`${normalizedBase}og-image.png`, site).href;
const ogImageAlt =
	'ZeroVisual — Zero-waste visual regression and automated UI design QA pre-processor for AI Agents';

// https://astro.build/config
export default defineConfig({
	markdown: {
		remarkPlugins: [remarkMath],
		rehypePlugins: [rehypeKatex],
	},
	vite: {
		plugins: [tailwindcss()],
	},
	site,
	base,
	integrations: [
		starlight({
			title: 'ZeroVisual',
			description: 'Zero-waste, zero-API-key visual regression and automated UI design QA pre-processor for AI Agents.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/hotcode-dev/zerovisual' },
				{ icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/zerovisual' },
			],
			head: [
				{
					tag: 'meta',
					attrs: { name: 'theme-color', content: '#090c12' },
				},
				{
					tag: 'meta',
					attrs: { name: 'author', content: 'Hotcode' },
				},
				{
					tag: 'meta',
					attrs: { name: 'image', property: 'og:image', content: ogImageUrl },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image:secure_url', content: ogImageUrl },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image:type', content: 'image/png' },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image:width', content: '1200' },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image:height', content: '630' },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image:alt', content: ogImageAlt },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:image', content: ogImageUrl },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:image:alt', content: ogImageAlt },
				},
			],
			customCss: [
				'katex/dist/katex.min.css',
				'./src/styles/custom.css'
			],
			components: {
				Head: './src/components/Head.astro',
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
				SocialIcons: './src/components/SocialIcons.astro',
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'Getting Started', slug: 'guides/getting-started' },
						{ label: 'How It Works (Deep Dive)', slug: 'guides/how-it-works' },
						{ label: 'Model Vision Grids & Tokens', slug: 'guides/model-vision-grids' },
						{ label: 'Empirical LLM Benchmarks', slug: 'guides/benchmarks' },
						{ label: 'Using with Impeccable', slug: 'guides/with-impeccable' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Configuration & CLI Flags', slug: 'reference/configuration' },
						{ label: 'Agent Skills Reference', slug: 'reference/skills' },
					],
				},
			],
		}),
	],
});
