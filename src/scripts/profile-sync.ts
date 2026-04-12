import { store, setProfile, clearProfile } from '../lib/store';
import { loadProfile, saveProfile } from '../lib/profile-storage';
import { supabase } from '../lib/supabase';

type Profile = ReturnType<typeof store.getState>['auth']['profile'];

const whenReady = (fn: () => void) => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
        return;
    }
    fn();
};

const toAvatarUrl = (url?: string | null) => (url?.trim() ? url.trim() : '/default_user_profile.png');

const applyProfileToNode = (
    profile: Profile,
    nameNodes: Element[],
    avatarNodes: Element[]
) => {
    const displayName = profile?.username?.trim() || 'Seeker';
    const avatarUrl = toAvatarUrl(profile?.avatar_url);

    nameNodes.forEach((node) => {
        if (node instanceof HTMLElement) node.textContent = displayName;
    });

    avatarNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) {
            node.src = avatarUrl;
            node.alt = displayName;
            return;
        }
        if (node instanceof HTMLElement) {
            node.style.backgroundImage = `url("${avatarUrl}")`;
        }
    });
};

const setAuthState = (signedIn: boolean, signedOutBlocks: Element[], signedInBlocks: Element[]) => {
    signedOutBlocks.forEach((block) => block.classList.toggle('hidden', signedIn));
    signedInBlocks.forEach((block) => block.classList.toggle('hidden', !signedIn));
};

whenReady(() => {
    const signedOutBlocks = Array.from(document.querySelectorAll('[data-auth="signed-out"]'));
    const signedInBlocks = Array.from(document.querySelectorAll('[data-auth="signed-in"]'));
    const profileNameNodes = Array.from(document.querySelectorAll('[data-profile-name]'));
    const profileAvatarNodes = Array.from(document.querySelectorAll('[data-profile-avatar]'));

    const syncProfileFromStore = () => {
        const profile = store.getState().auth.profile;
        applyProfileToNode(profile, profileNameNodes, profileAvatarNodes);
        setAuthState(Boolean(profile), signedOutBlocks, signedInBlocks);
    };

    const bootstrapProfile = () => {
        const storedProfile = loadProfile();
        if (storedProfile) {
            store.dispatch(setProfile(storedProfile));
        }
    };

    const fetchSessionProfile = async () => {
        try {
            // Use the client-side Supabase to get the current session.
            // This checks localStorage for a valid (or auto-refreshable) token.
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                // No valid session — user is not authenticated
                store.dispatch(clearProfile());
                saveProfile(null);
                return;
            }

            // Session is valid. Try the locally stored profile first to avoid
            // an extra network round-trip on every page load.
            const storedProfile = loadProfile();
            if (storedProfile) {
                store.dispatch(setProfile(storedProfile));
                return;
            }

            // No stored profile but session is valid — fetch fresh from server
            // using the access token so the server can verify it.
            const response = await fetch('/api/auth/session', {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                store.dispatch(clearProfile());
                saveProfile(null);
                return;
            }

            const result = await response.json().catch(() => null);
            if (result?.signedIn && result.profile) {
                store.dispatch(setProfile(result.profile));
                saveProfile(result.profile);
            } else {
                store.dispatch(clearProfile());
                saveProfile(null);
            }
        } catch {
            // Network error — keep whatever is in localStorage as a fallback
            const fallback = loadProfile();
            if (fallback) {
                store.dispatch(setProfile(fallback));
            } else {
                store.dispatch(clearProfile());
            }
        }
    };

    bootstrapProfile();
    syncProfileFromStore();
    store.subscribe(syncProfileFromStore);
    void fetchSessionProfile();
});
