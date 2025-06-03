// Global type declarations for performance measurement functions
interface Window {
  // Privy initialization timing
  privyInitStart: number | null;
  privyInitEnd: number | null;
  markPrivyInitStart: () => void;
  markPrivyInitEnd: () => void;
  
  // Wallet initialization timing
  walletInitStart: number | null;
  walletInitEnd: number | null;
  markWalletInitStart: () => void;
  measureWalletInitTime: () => void;
  
  // Chat panel mount timing
  chatPanelMountTime: number | null;
  markChatPanelMounted: () => void;
}
