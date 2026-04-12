import type { Profile } from './store';

const STORAGE_KEY = 'talora.profile';

export const loadProfile = (): Profile | null => {
    if (typeof localStorage === 'undefined') return null;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as Profile;
    } catch {
        return null;
    }
};

export const saveProfile = (profile: Profile | null) => {
    if (typeof localStorage === 'undefined') return;
    if (!profile) {
        localStorage.removeItem(STORAGE_KEY);
        return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
};
