
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TestScraper = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-prices', {
        body: { force: true } // Force the function to run
      });

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast.success('Scraping test successful!');
      } else {
        toast.error('Scraping test failed or completed with errors.');
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast.error(error.message || 'Failed to run the scraper function.');
      setResult({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>You need admin privileges to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Price Scraper Test</h1>
            <p className="text-muted-foreground">Manually trigger the price update function.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Scraper</CardTitle>
            <CardDescription>
              This will invoke the 'update-prices' Edge Function. This process can take several minutes to complete. 
              The function will run in "force" mode, ignoring the usual schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={runTest} 
              disabled={testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Scraper...
                </>
              ) : (
                'Invoke "update-prices"'
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className={result.success ? 'border-green-500' : 'border-destructive'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Test Completed
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    Test Failed
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">Function Response:</h3>
                  <pre className="text-sm bg-muted p-3 rounded overflow-x-auto max-h-[600px]">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestScraper;
