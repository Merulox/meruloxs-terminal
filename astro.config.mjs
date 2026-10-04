// @ts-check
import { defineConfig } from 'astro/config';

/** Injects the visit beacon (merulox.com) and dev-only visits tab (dev.merulox.com) on every page. */
const visits = {
	name: 'merulox-visits',
	hooks: {
		/** @param {{ injectScript: (stage: 'page', content: string) => void }} options */
		'astro:config:setup': ({ injectScript }) => {
			injectScript('page', 'import "/src/scripts/visits-client.ts";');
		},
	},
};

// https://astro.build/config
export default defineConfig({
	site: 'https://merulox.com',
	integrations: [visits],
});
