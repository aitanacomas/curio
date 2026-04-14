import { useState, useEffect } from 'react';
import { getBlockedUsers, getBlockersOfUser } from '../lib/supabase';

/**
 * Returns the combined set of:
 * - users this user has blocked
 * - users who have blocked this user
 * Any user in this set should be invisible to the current user (and vice versa).
 */
export function useBlockedUsers(userId: string | undefined): Set<string> {
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    Promise.all([getBlockedUsers(userId), getBlockersOfUser(userId)]).then(
      ([blocked, blockers]) => setBlockedSet(new Set([...blocked, ...blockers]))
    );
  }, [userId]);

  return blockedSet;
}
