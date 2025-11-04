import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TestVertexAI = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-vertex-ai', {
        body: {}
      });

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast.success('Vertex AI test successful!');
      } else {
        toast.error('Vertex AI test failed');
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast.error(error.message || 'Failed to test Vertex AI');
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
            <h1 className="text-3xl font-bold">Vertex AI Integration Test</h1>
            <p className="text-muted-foreground">Verify your Vertex AI configuration is working</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>
              This test will verify that the Vertex AI API key is properly configured and the API is responding correctly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>Test Endpoint:</strong> https://api.vertexai.google.com/v1/chat/completions
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Model:</strong> gemini-2.0-flash-exp
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Test Prompt:</strong> Extract product information from: "iPhone 15 128GB Blue"
              </p>
            </div>

            <Button 
              onClick={runTest} 
              disabled={testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Vertex AI...
                </>
              ) : (
                'Run Test'
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
                    Test Successful
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
              {result.success ? (
                <>
                  <div className="space-y-2">
                    <h3 className="font-semibold">Test Prompt:</h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      {result.test_prompt}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">AI Response:</h3>
                    <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(result.parsed, null, 2)}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Raw API Response:</h3>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-60">
                      {JSON.stringify(result.raw_response, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold text-destructive">Error Details:</h3>
                  <pre className="text-sm bg-destructive/10 p-3 rounded overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestVertexAI;
