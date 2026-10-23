// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
	markdown: {
		remarkPlugins: [remarkMath],
		rehypePlugins: [rehypeKatex],
	},
	vite: {
		plugins: [tailwindcss()],
	},
	site: process.env.SITE_URL || 'https://zerovisual.hotcode.dev/',
	base: process.env.DOCS_BASE_PATH || (process.env.GITHUB_PAGES ? '/zerovisual' : '/'),
	integrations: [
		starlight({
			title: 'ZeroVisual',
			description: 'Zero-waste, zero-API-key visual regression and automated UI design QA pre-processor for AI Agents.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/hotcode-dev/zerovisual' }
			],
			customCss: [
				'katex/dist/katex.min.css',
				'./src/styles/custom.css'
			],
			components: {
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
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Configuration & CLI Flags', slug: 'reference/configuration' },
						{ label: 'Agent Skills Reference', slug: 'reference/skills' },
						{ label: 'MCP Server Integration', slug: 'reference/mcp-server' },
					],
				},
			],
		}),
	],
});
