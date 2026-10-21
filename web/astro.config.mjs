// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://hotcode-dev.github.io',
	base: process.env.GITHUB_ACTIONS ? '/zerovisual' : '/',
	integrations: [
		starlight({
			title: 'ZeroVisual',
			description: 'Zero-waste, zero-API-key visual regression and automated UI design QA pre-processor for AI Agents.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/hotcode-dev/zerovisual' }
			],
			customCss: [
				'./src/styles/custom.css'
			],
			components: {
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'Getting Started', slug: 'guides/getting-started' },
						{ label: 'How It Works (Deep Dive)', slug: 'guides/how-it-works' },
						{ label: 'Model Vision Grids & Tokens', slug: 'guides/model-vision-grids' },
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
