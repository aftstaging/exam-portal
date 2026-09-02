export type LoginDialogState = {
  open: boolean;
  mode: "login" | "register";
};

type Listener = (state: LoginDialogState) => void;

let current: LoginDialogState = { open: false, mode: "login" };
const listeners: Listener[] = [];

export function getLoginDialogState(): LoginDialogState {
  return current;
}

export function openLoginDialog(mode: "login" | "register" = "login") {
  current = { open: true, mode };
  emit();
}

export function closeLoginDialog() {
  if (!current.open) return;
  current = { ...current, open: false };
  emit();
}

export function subscribeLoginDialog(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

function emit() {
  for (let i = 0; i < listeners.length; i++) {
    listeners[i](current);
  }
}
