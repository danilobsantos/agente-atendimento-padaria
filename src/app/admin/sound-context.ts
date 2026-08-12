"use client";

import { createContext, useContext } from "react";

interface SoundContextValue {
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const SoundContext = createContext<SoundContextValue>({
  soundEnabled: true,
  toggleSound: () => {},
});

export const useSound = () => useContext(SoundContext);