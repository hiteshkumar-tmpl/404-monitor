import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home, Server, CheckCircle, XCircle, Globe } from "lucide-react";

export default function TestPage() {
  const backendUrl =
    "https://workspaceapi-server-production-b33f.up.railway.app";
  const isBackendReachable = false; // Will be checked client-side

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

export default function TestPage() {
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/test");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
      setLastFetch(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Backend Test Page</span>
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
        {/* Status Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <span>API Connection Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {loading ? (
                <Skeleton className="h-10 w-32" />
              ) : error ? (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Connection Failed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Connected</span>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              {lastFetch && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastFetch.toLocaleTimeString()}
                </span>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700 font-mono">{error}</p>
                <p className="text-sm text-red-600 mt-2">
                  Make sure the backend is running and the API URL is configured
                  correctly.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Display */}
        {data && (
          <>
            {/* Stats Overview */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Stats Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {data.data.stats.totalWebsites}
                    </p>
                    <p className="text-sm text-gray-600">Websites</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {data.data.stats.totalUrls}
                    </p>
                    <p className="text-sm text-gray-600">Total URLs</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {data.data.stats.totalBroken}
                    </p>
                    <p className="text-sm text-gray-600">Broken URLs</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sample Websites */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Websites Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.data.websites.map((site) => (
                    <div
                      key={site.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{site.name}</p>
                        <p className="text-sm text-gray-500">
                          {site.totalUrls} total URLs
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {site.brokenUrls > 0 ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded">
                            {site.brokenUrls} broken
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded">
                            All OK
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded border">
                  <p className="text-xs text-gray-500 font-mono">
                    Received at: {new Date(data.timestamp).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
