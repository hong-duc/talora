/**
 * Browser environment detection utility.
 * Replaces $app/environment for non-SvelteKit projects.
 */

/**
 * Whether the code is running in a browser environment (client-side).
 * In SSR (server-side rendering), this will be false.
 */
export const browser = typeof window !== 'undefined';