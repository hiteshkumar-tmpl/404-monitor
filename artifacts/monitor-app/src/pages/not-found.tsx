import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-lg mx-4 shadow-xl">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-red-100 p-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Page Not Found
          </h2>

          <p className="text-gray-600 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </Link>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
