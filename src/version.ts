import { createRequire } from 'node:module';

// package.json sits next to dist/ in the published package, so this works from the build and from npx.
const pkg = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

export const PACKAGE_NAME: string = pkg.name;
export const VERSION: string = pkg.version;
