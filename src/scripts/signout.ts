import { store, clearProfile } from '../lib/store';
import { saveProfile } from '../lib/profile-storage';
import { supabase } from '../lib/supabase';

const whenReady = (fn: () => void) => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
        return;
    }
    fn();
};

const showErrorToast = (message: string) => {
    const detail = {
        id: 'signout-toast',
        eyebrow: 'Sign Out Failed',
        title: 'Unable to sign out',
        description: message,
        icon: 'error',
    };

    if (window.arcaneUI?.showToast) {
        window.arcaneUI.showToast('signout-toast', detail);
        return;
    }

    window.dispatchEvent(
        new CustomEvent('arcane-toast:show', { detail })
    );
};

const handleSignOut = async () => {
    const response = await fetch('/api/auth/signout', { method: 'POST' });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showErrorToast(payload?.error ?? 'Unable to sign out.');
        return;
    }

    // Clear the client-side Supabase session (removes tokens from localStorage)
    await supabase.auth.signOut();

    store.dispatch(clearProfile());
    saveProfile(null);
    window.location.href = '/signin';
};

whenReady(() => {
    const button = document.querySelector('[data-signout-button]');
    if (!(button instanceof HTMLButtonElement)) return;

    button.addEventListener('click', (event) => {
        event.preventDefault();
        void handleSignOut();
    });
});
