import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [validationError, setValidationError] = useState("");
  const resetPassword = useResetPassword();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!token) {
      setValidationError("Reset token is missing from the URL");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!token) {
      setValidationError("Reset token is missing");
      return;
    }

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    try {
      await resetPassword.mutateAsync({
        data: { token, newPassword: password },
      });
      setIsSuccess(true);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reset password";
      setValidationError(errorMessage);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Activity className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground">
              404_MONITOR
            </h1>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
                <h2 className="text-xl font-mono font-bold">
                  Invalid Reset Link
                </h2>
                <p className="text-muted-foreground font-mono text-sm">
                  The password reset link is invalid or has expired.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="font-mono mt-4"
                >
                  Return to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Activity className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground">
              404_MONITOR
            </h1>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                </div>
                <h2 className="text-xl font-mono font-bold">Password Reset</h2>
                <p className="text-muted-foreground font-mono text-sm">
                  Your password has been successfully reset. You can now log in
                  with your new password.
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="font-mono mt-4"
                >
                  Go to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Activity className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground">
            404_MONITOR
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono">
            Set your new password
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-mono text-xl">NEW PASSWORD</CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {validationError && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="font-mono text-xs text-muted-foreground uppercase"
                >
                  New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="font-mono"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="font-mono text-xs text-muted-foreground uppercase"
                >
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="font-mono"
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full font-mono font-bold"
                disabled={resetPassword.isPending}
              >
                {resetPassword.isPending ? "RESETTING..." : "RESET PASSWORD"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-xs text-muted-foreground hover:text-primary font-mono underline"
                >
                  Back to Login
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
