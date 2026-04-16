import { useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
import { PRODUCT_NAME } from "@/lib/brand";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { signup } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      await signup(name.trim(), email, password);
      setLocation("/dashboard");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to create your account right now";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Activity className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground">
            {PRODUCT_NAME}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono">
            Create your account and start monitoring your first property
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-mono text-xl">CREATE ACCOUNT</CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground">
              New accounts are created as standard users. You&apos;ll be signed in
              immediately after signup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium text-foreground">
                    What happens after signup
                  </span>
                </div>
                <p>
                  You&apos;ll land in the dashboard as a regular user and can add
                  your first monitored property right away.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="font-mono text-xs text-muted-foreground uppercase"
                >
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setName(e.target.value)
                  }
                  required
                  className="font-mono"
                  autoComplete="name"
                  data-testid="input-signup-name"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="font-mono text-xs text-muted-foreground uppercase"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  required
                  className="font-mono"
                  autoComplete="email"
                  data-testid="input-signup-email"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="font-mono text-xs text-muted-foreground uppercase"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                  required
                  className="font-mono"
                  autoComplete="new-password"
                  data-testid="input-signup-password"
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
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                  required
                  className="font-mono"
                  autoComplete="new-password"
                  data-testid="input-signup-confirm-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full font-mono font-bold"
                disabled={isLoading}
                data-testid="button-signup-submit"
              >
                {isLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
              </Button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-xs text-muted-foreground hover:text-primary font-mono underline"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
