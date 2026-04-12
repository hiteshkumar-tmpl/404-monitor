import { useState } from "react";
import { useLocation } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const forgotPassword = useForgotPassword();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await forgotPassword.mutateAsync({ data: { email } });
      setIsSubmitted(true);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send reset email";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (isSubmitted) {
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
                <h2 className="text-xl font-mono font-bold">
                  Check Your Email
                </h2>
                <p className="text-muted-foreground font-mono text-sm">
                  If an account exists with that email, we sent a password reset
                  link. Please check your inbox and spam folder.
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
            Reset your password
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-mono text-xl">FORGOT PASSWORD</CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground">
              Enter your email address and we'll send you a reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="font-mono"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full font-mono font-bold"
                disabled={forgotPassword.isPending}
              >
                {forgotPassword.isPending ? "SENDING..." : "SEND RESET LINK"}
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
