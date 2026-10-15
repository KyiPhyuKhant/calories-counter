import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useRepositories } from '@/data/DatabaseProvider';
import type { Profile } from '@/data/repositories';
import { completedProfileInput } from '@/navigation/profileSetup';

type ProfileState = { status: 'loading' | 'ready' | 'error'; profile: Profile | null };
const Context = createContext<(ProfileState & { completed: boolean; reload: () => Promise<void> }) | null>(null);

export function LocalProfileProvider({ children }: PropsWithChildren) {
  const repositories = useRepositories();
  const [state, setState] = useState<ProfileState>({ status: 'loading', profile: null });
  const active = useRef(false); const request = useRef(0);
  const reload = useCallback(async () => {
    const current = ++request.current;
    try {
      const profile = await repositories.profiles.get();
      if (active.current && current === request.current) setState({ status: 'ready', profile });
    } catch (error) {
      if (active.current && current === request.current) setState((previous) => ({ ...previous, status: 'error' }));
      throw error;
    }
  }, [repositories]);

  useEffect(() => {
    active.current = true;
    const unsubscribe = repositories.subscribe(() => { void reload().catch(() => {}); });
    void Promise.resolve().then(() => { if (active.current) void reload().catch(() => {}); });
    return () => {
      active.current = false;
      // Invalidate pending reads; this is a request sequence, not a rendered node ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      request.current++;
      unsubscribe();
    };
  }, [repositories, reload]);

  return <Context.Provider value={{ ...state, completed: completedProfileInput(state.profile) !== null, reload }}>{children}</Context.Provider>;
}

export function useLocalProfile() {
  const value = useContext(Context);
  if (!value) throw new Error('Local profile navigation provider is missing.');
  return value;
}
