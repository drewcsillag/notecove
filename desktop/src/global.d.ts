/// <reference types="vite/client" />

interface ElectronAPI {
  isElectron: boolean;
  fileSystem: {
    readFile(path: string): Promise<{ success: boolean; content: string; error?: string }>;
    writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }>;
    readDir(path: string): Promise<{ success: boolean; files: string[]; error?: string }>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<{ success: boolean; error?: string }>;
  };
  settings: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
  };
}

interface Window {
  electronAPI?: ElectronAPI;
}
