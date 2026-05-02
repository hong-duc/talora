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

const AVATAR_FALLBACK = '/default_user_profile.png';
const toAvatarUrl = (url?: string | null): string => {
    if (!url?.trim()) return AVATAR_FALLBACK;
    return `https://wsrv.nl/?url=${encodeURIComponent(url.trim())}&w=64&h=64&fit=cover&a=attention&output=webp&q=85`;
};

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
            // avatarUrl is either the wsrv.nl proxy URL (safe) or the local fallback path.
            // Both are guaranteed not to contain unescaped quotes or parentheses.
            node.style.backgroundImage = `url("${avatarUrl}")`;
        }
    });
};

const setAuthState = (signedIn: boolean, signedOutBlocks: Element[], signedInBlocks: Element[]) => {
    signedOutBlocks.forEach((block) => {
        block.classList.toggle('hidden', signedIn);
        if (!signedIn) block.classList.add('flex');
        else block.classList.remove('flex');
    });
    signedInBlocks.forEach((block) => {
        block.classList.toggle('hidden', !signedIn);
        if (signedIn) block.classList.add('flex');
        else block.classList.remove('flex');
    });
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

    // Collect all profile link anchors so we can update their href
    const profileLinkNodes = Array.from(document.querySelectorAll('[data-profile-link]'));
    const networkLinkNodes = Array.from(document.querySelectorAll('[data-network-link]'));

    /** Set the profile avatar link href to /user/<userId> */
    const applyProfileLink = (userId: string) => {
        profileLinkNodes.forEach((node) => {
            if (node instanceof HTMLAnchorElement) {
                node.href = `/user/${encodeURIComponent(userId)}`;
            }
        });
        networkLinkNodes.forEach((node) => {
            if (node instanceof HTMLAnchorElement) {
                node.href = `/user/${encodeURIComponent(userId)}/network`;
            }
        });
    };

    /**
     * Fetch the user's profile from the server and update the store + localStorage.
     * If `forceRefresh` is false (default) and a locally stored profile already
     * exists, the fetch still runs in the background and updates storage if the
     * server returns different data. This keeps the cached profile fresh across
     * devices and after profile edits.
     */
    const fetchSessionProfile = async (forceRefresh = false) => {
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

            // Update the profile link href to point to this user's profile page
            applyProfileLink(session.user.id);

            // Session is valid. Try the locally stored profile first to avoid
            // a blocking round-trip on every page load. We still fire a background
            // refresh to pick up changes made on other devices / after profile edits.
            const storedProfile = loadProfile();
            if (storedProfile && !forceRefresh) {
                store.dispatch(setProfile(storedProfile));
                // Fall through intentionally — background refresh continues below.
            }

            // Fetch fresh profile from server using the access token so the
            // server can verify it via RLS.
            const response = await fetch('/api/auth/session', {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                if (!storedProfile) {
                    store.dispatch(clearProfile());
                    saveProfile(null);
                }
                return;
            }

            const result = await response.json().catch(() => null);
            if (result?.signedIn && result.profile) {
                store.dispatch(setProfile(result.profile));
                saveProfile(result.profile);
            } else if (!storedProfile) {
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

    /**
     * Listen for Supabase auth state changes (sign-in, sign-out, token refresh).
     *
     * Security note: The access token is written to a JS-readable cookie (not
     * HttpOnly) so that SSR pages can forward it to the server. This is an
     * intentional trade-off: the cookie cannot be made HttpOnly from client-side
     * JS. To harden this, the sign-in server endpoint should set the cookie with
     * HttpOnly instead, and this client-side cookie write should be removed.
     *
     * This listener is placed inside whenReady() so it is co-located with the
     * rest of the auth/profile logic and avoids any race with fetchSessionProfile.
     */
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            // Derive max-age from the token's own expiry rather than hardcoding.
            const maxAge = session.expires_at
                ? session.expires_at - Math.floor(Date.now() / 1000)
                : 3600;
            document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Lax; secure`;

            // Re-sync the profile whenever the session changes (e.g. after sign-in
            // or a silent token refresh that might carry updated user metadata).
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                void fetchSessionProfile(true);
            }
        } else {
            // Clear the cookie on sign out
            document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            store.dispatch(clearProfile());
            saveProfile(null);
        }
    });
});
