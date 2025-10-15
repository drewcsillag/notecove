/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: import('./preload').ElectronAPI;
  }
}

export {};
