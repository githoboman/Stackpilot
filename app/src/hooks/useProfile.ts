import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '@/lib/stacksWallet';
import { sileo } from 'sileo';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setProfile, setProfileLoading } from '@/store/slices/authSlice';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface UserPreferences {
  analytics_enabled?: boolean;
  notifications_enabled?: boolean;
  personalization_enabled?: boolean;
}

export interface UserProfile {
  email?: string;
  wallet_address: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  preferences?: UserPreferences;
  referral_code?: string;
  referrals_count?: number;
  recently_analyzed?: string[];
  alert_wallets?: string[];
}

export function useProfile() {
  const currentAccount = useCurrentAccount();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.auth.profile);
  const loading = useAppSelector((state) => state.auth.profileLoading);
  const fetched = useAppSelector((state) => state.auth.profileFetched);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!currentAccount?.address) {
      dispatch(setProfile(null));
      return;
    }

    // Profile persistence is a deleted legacy feature — the Stackpilot agent app is
    // wallet-native and needs no user profile. Resolve to null without an API call so
    // we don't hit a removed route.
    dispatch(setProfile(null));
  }, [currentAccount?.address, dispatch]);

  useEffect(() => {
    if (currentAccount?.address && !fetched && !loading) {
      fetchProfile();
    }
  }, [currentAccount?.address, fetched, loading, fetchProfile]);

  const updatePreferences = async (newPrefs: UserPreferences) => {
    if (!currentAccount?.address) return;

    // Optimistic update
    const previousProfile = profile;
    if (profile) {
      dispatch(setProfile({ ...profile, preferences: { ...profile.preferences, ...newPrefs } }));
    }

    try {
      const normalizedAddr = currentAccount.address.toLowerCase();
      const res = await fetch(`${API_BASE}/api/update-user`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: normalizedAddr,
          preferences: newPrefs,
        })
      });

      if (!res.ok) {
        // Revert on failure
        dispatch(setProfile(previousProfile));
        sileo.error({ title: "Update Failed", description: "Failed to update preferences" });
      } else {
        sileo.success({ title: "Success", description: "Preferences updated" });
      }
    } catch (err) {
      dispatch(setProfile(previousProfile));
      sileo.error({ title: "Error", description: "Error updating preferences" });
      console.error(err);
    }
  };

  return {
    profile,
    loading,
    error,
    updatePreferences,
    refetch: fetchProfile
  };
}
