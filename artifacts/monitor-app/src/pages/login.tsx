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
import { Activity, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PRODUCT_NAME } from "@/lib/brand";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });
      setLocation("/dashboard");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Invalid email or password";
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
            Sign in to access your dashboard
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-mono text-xl">AUTHENTICATE</CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground">
              Enter your credentials to continue
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
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  required
                  className="font-mono"
                  autoComplete="email"
                  data-testid="input-email"
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                  required
                  className="font-mono"
                  autoComplete="current-password"
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full font-mono font-bold"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? "AUTHENTICATING..." : "SIGN IN"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/forgot-password")}
                  className="text-xs text-muted-foreground hover:text-primary font-mono underline"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/signup")}
                  className="text-xs text-muted-foreground hover:text-primary font-mono underline"
                >
                  Need an account? Create one
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
