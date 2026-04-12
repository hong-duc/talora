export {};

declare global {
    interface Window {
        arcaneUI?: {
            showToast?: (id: string, detail?: Record<string, unknown>) => void;
            hideToast?: (id: string) => void;
        };
    }
}
