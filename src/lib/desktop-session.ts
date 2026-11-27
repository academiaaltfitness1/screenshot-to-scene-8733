// Liberação em memória: reinicia automaticamente quando a página/PWA é aberta novamente.
let desktopUnlocked = false;

export function unlockDesktopSession() {
  desktopUnlocked = true;
}

export function lockDesktopSession() {
  desktopUnlocked = false;
}

export function isDesktopSessionUnlocked() {
  return desktopUnlocked;
}
