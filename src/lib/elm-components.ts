/**
 * Elm component utilities for integrating Elm with Astro
 */

// Types for Elm program initialization
export interface ElmApp<T = any> {
    ports?: {
        [key: string]: {
            subscribe?: (callback: (data: any) => void) => void;
            send?: (data: any) => void;
            unsubscribes?: (() => void)[];
        };
    };
}

/**
 * Mount an Elm component to a DOM element
 * @param elmModule - The Elm module (imported from .elm file)
 * @param targetElement - The DOM element to mount the Elm app to
 * @param flags - Initial flags to pass to the Elm app (optional)
 * @returns The mounted Elm app instance
 */
export function mountElmApp<T = any>(
    elmModule: { Elm: { [key: string]: { init: (options: { node: HTMLElement; flags?: T }) => ElmApp<T> } } },
    targetElement: HTMLElement,
    flags?: T
): ElmApp<T> {
    if (!targetElement) {
        throw new Error('Target element not found for Elm app');
    }

    // Get the module name from the Elm module
    const moduleName = Object.keys(elmModule.Elm)[0];

    if (!moduleName) {
        throw new Error('No Elm module found in the imported module');
    }

    // Initialize the Elm app
    const app = elmModule.Elm[moduleName].init({
        node: targetElement,
        flags
    });

    return app;
}

/**
 * Create a wrapper component that mounts an Elm app when the DOM is ready
 * This function can be used in Astro pages or Svelte components
 * @param elmModule - The Elm module (imported from .elm file)
 * @param elementId - The ID of the DOM element to mount the Elm app to
 * @param flags - Initial flags to pass to the Elm app (optional)
 * @returns A cleanup function to unmount the Elm app (if needed)
 */
export function createElmComponent<T = any>(
    elmModule: { Elm: { [key: string]: { init: (options: { node: HTMLElement; flags?: T }) => ElmApp<T> } } },
    elementId: string,
    flags?: T
): () => void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
        return () => { };
    }

    let app: ElmApp<T> | null = null;

    const mountApp = () => {
        const targetElement = document.getElementById(elementId);
        if (targetElement && !app) {
            try {
                app = mountElmApp(elmModule, targetElement, flags);
            } catch (error) {
                console.error(`Failed to mount Elm app to element #${elementId}:`, error);
            }
        }
    };

    // Mount when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountApp);
    } else {
        mountApp();
    }

    // Return cleanup function
    return () => {
        // Cleanup ports if they exist
        if (app?.ports) {
            Object.values(app.ports).forEach(port => {
                if (port?.unsubscribes) {
                    port.unsubscribes.forEach(unsub => unsub());
                }
            });
        }
        app = null;
    };
}

/**
 * Helper to dynamically import Elm modules with error handling
 * @param modulePath - Path to the Elm module (e.g., './HelloWorld.elm')
 * @returns Promise resolving to the Elm module
 */
export async function importElmModule(modulePath: string): Promise<{ Elm: any }> {
    try {
        // Using dynamic import for Elm modules compiled by vite-plugin-elm
        const module = await import(/* @vite-ignore */ modulePath);
        return module;
    } catch (error) {
        console.error(`Failed to import Elm module: ${modulePath}`, error);
        throw error;
    }
}

/**
 * Create a lazy-loaded Elm component that loads the Elm module on demand
 * @param modulePath - Path to the Elm module (e.g., './HelloWorld.elm')
 * @param elementId - The ID of the DOM element to mount the Elm app to
 * @param flags - Initial flags to pass to the Elm app (optional)
 * @returns Object with mount and unmount functions
 */
export function createLazyElmComponent<T = any>(
    modulePath: string,
    elementId: string,
    flags?: T
) {
    let cleanup: (() => void) | null = null;
    let isMounted = false;

    const mount = async () => {
        if (isMounted) return;

        try {
            const elmModule = await importElmModule(modulePath);
            cleanup = createElmComponent(elmModule, elementId, flags);
            isMounted = true;
        } catch (error) {
            console.error(`Failed to load Elm component: ${modulePath}`, error);
        }
    };

    const unmount = () => {
        if (cleanup) {
            cleanup();
            cleanup = null;
        }
        isMounted = false;
    };

    return {
        mount,
        unmount,
        isMounted: () => isMounted
    };
}