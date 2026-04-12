import { store, setProfile, clearProfile } from '../lib/store';
import { loadProfile, saveProfile } from '../lib/profile-storage';

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
            const response = await fetch('/api/auth/session', {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || response.statusText);
            }
            const result = await response.json().catch(() => null);
            if (result?.signedIn && result.profile) {
                store.dispatch(setProfile(result.profile));
                saveProfile(result.profile);
                return;
            }
            store.dispatch(clearProfile());
            saveProfile(null);
        } catch {
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
