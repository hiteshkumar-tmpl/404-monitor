import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home, Server, CheckCircle, XCircle, Globe } from "lucide-react";

export default function TestPage() {
  const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Frontend Test Page</span>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              Go to App
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Frontend Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Frontend Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-600 font-medium">
              Frontend is running correctly!
            </p>
            <p className="text-gray-600 mt-1">
              This page is being served by Vercel/CDN successfully.
            </p>
          </CardContent>
        </Card>

        {/* Backend Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Backend Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-600">
                Backend is not reachable
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded border">
              <p className="text-sm font-mono text-gray-700">
                Backend URL: {backendUrl}
              </p>
            </div>

            <p className="text-gray-600 text-sm">
              The backend server is either:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Not running / crashed</li>
              <li>Database connection failed</li>
              <li>Network/firewall blocking connection</li>
            </ul>

            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">To fix this:</p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                <li>Check Railway dashboard for deployment logs</li>
                <li>Verify DATABASE_URL is correct in Railway</li>
                <li>Check Supabase "Allowed IPs" is set to 0.0.0.0/0</li>
                <li>Redeploy Railway after making changes</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Test Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">Backend Health</span>
                <a
                  href={`${backendUrl}/api/healthz`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  {backendUrl}/api/healthz
                </a>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">Backend Test</span>
                <a
                  href={`${backendUrl}/api/test`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  {backendUrl}/api/test
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
