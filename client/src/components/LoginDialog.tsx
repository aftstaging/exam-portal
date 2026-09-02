import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  closeLoginDialog,
  getLoginDialogState,
  subscribeLoginDialog,
} from "@/_core/auth/loginBus";

export function LoginDialog() {
  const [state, setState] = useState(getLoginDialogState());
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function redirectAdminAfterLogin() {
    const me = await utils.auth.me.fetch();
    if (!me) return;
    if (me.role === "admin") navigate("/admin");
    else if (me.role === "instructor") navigate("/instructor");
  }

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      handleClose();
      await redirectAdminAfterLogin();
    },
    onError: handleError,
  });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      handleClose();
      await redirectAdminAfterLogin();
    },
    onError: handleError,
  });

  useEffect(() => {
    return subscribeLoginDialog(setState);
  }, []);

  function handleClose() {
    setErrorMessage(null);
    closeLoginDialog();
  }

  function handleError(error: unknown) {
    if (error instanceof TRPCClientError) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage("Something went wrong. Please try again.");
    }
  }

  function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    loginMutation.mutate({ email, password });
  }

  function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    registerMutation.mutate({ email, password, name: name || undefined });
  }

  const isBusy = loginMutation.isPending || registerMutation.isPending;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "login" ? "Welcome back" : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            {state.mode === "login"
              ? "Sign in to access your products, progress, and feedback."
              : "Set up a learner account to start your exam preparation."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={state.mode} onValueChange={(value) => setState((s) => ({ ...s, mode: value as "login" | "register" }))}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={submitLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isBusy}>
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={submitRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-name">Full name</Label>
                <Input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isBusy}>
                {registerMutation.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
