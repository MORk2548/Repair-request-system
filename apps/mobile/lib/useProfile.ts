import { getProfile, type Profile } from '@repair/api';
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from './supabase';

// userId comes from the session at once; profile is undefined while loading and null when it could not be read
type Me = { userId: string | null; profile: Profile | null | undefined };

const ProfileContext = createContext<Me>({ userId: null, profile: undefined });

export function ProfileProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    setProfile(undefined);
    if (!userId) return;
    let live = true;
    getProfile(db, userId).then(
      (p) => live && setProfile(p),
      () => live && setProfile(null),
    );
    return () => {
      live = false;
    };
  }, [userId]);
  return createElement(ProfileContext.Provider, { value: { userId, profile } }, children);
}

export const useProfile = (): Me => useContext(ProfileContext);
