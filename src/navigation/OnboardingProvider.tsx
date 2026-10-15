import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import { useLocalProfile } from '@/navigation/LocalProfileProvider';
import { createProfileForm, type ProfileForm } from '@/navigation/profileSetup';

const Context = createContext<{ form: ProfileForm; setForm: Dispatch<SetStateAction<ProfileForm>> } | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const { profile } = useLocalProfile();
  const [form, setForm] = useState(() => createProfileForm(profile));
  return <Context.Provider value={{ form, setForm }}>{children}</Context.Provider>;
}

export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error('Onboarding draft provider is missing.');
  return value;
}
