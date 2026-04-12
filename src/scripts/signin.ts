import { store, setProfile } from '../lib/store';
import { saveProfile } from '../lib/profile-storage';
import { supabase } from '../lib/supabase';

type NullableInput = HTMLInputElement | null;

const whenReady = (fn: () => void) => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
        return;
    }
    fn();
};

const ensureInput = (node: Element | null): NullableInput =>
    node instanceof HTMLInputElement ? node : null;

const setFieldError = (form: HTMLFormElement | null, message: string) => {
    if (!form) return;
    const existing = document.getElementById('signin-error');
    if (existing) {
        existing.textContent = message;
        existing.classList.remove('hidden');
        return;
    }
    const error = document.createElement('p');
    error.id = 'signin-error';
    error.className =
        'mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300';
    error.textContent = message;
    form.appendChild(error);
};

const signInAndLoadProfile = async (
    form: HTMLFormElement | null,
    emailInput: NullableInput,
    passwordInput: NullableInput
) => {
    if (!emailInput || !passwordInput) {
        setFieldError(form, 'Sign in form is missing required fields.');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        setFieldError(form, 'Please enter your credentials to summon entry.');
        return;
    }

    const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setFieldError(form, payload?.error ?? 'Unable to sign in. Please try again.');
        return;
    }

    const payload = await response.json().catch(() => ({}));
    // createApiResponse wraps data in a `data` key: { success: true, data: { profile, session } }
    const profile = payload?.data?.profile ?? null;
    const session = payload?.data?.session ?? null;

    // Persist the Supabase session in the browser so it survives page refreshes.
    // This stores the access_token & refresh_token in localStorage via the
    // Supabase client, enabling automatic token refresh.
    if (session?.access_token && session?.refresh_token) {
        await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });
    }

    store.dispatch(setProfile(profile));
    saveProfile(profile);

    window.location.href = '/archive';
};

whenReady(() => {
    const form = document.getElementById('signin-form') as HTMLFormElement | null;
    const emailInput = ensureInput(document.getElementById('signin-email'));
    const passwordInput = ensureInput(document.getElementById('signin-password'));

    form?.addEventListener('submit', (event) => {
        event.preventDefault();
        void signInAndLoadProfile(form, emailInput, passwordInput);
    });
});
