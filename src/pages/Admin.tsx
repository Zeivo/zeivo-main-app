import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Store, Tag, ArrowLeft, Shield, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const Admin = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, loading } = useAdmin();
  const { toast } = useToast();
  const [processingJobs, setProcessingJobs] = useState(false);

  const handleProcessJobs = async () => {
    setProcessingJobs(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-worker', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "AI Jobs Processed",
        description: `Processed ${data.processed} of ${data.total} jobs`,
      });
    } catch (error) {
      console.error('Error processing jobs:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process jobs",
        variant: "destructive",
      });
    } finally {
      setProcessingJobs(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Ingen tilgang
            </CardTitle>
            <CardDescription>
              Du har ikke administratortilgang til denne siden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Tilbake til forsiden
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbake
            </Button>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/test-vertex-ai")}>
              Test Vertex AI
            </Button>
            <Button variant="outline" onClick={signOut}>
              Logg ut
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="products">Produkter</TabsTrigger>
            <TabsTrigger value="merchants">Butikker</TabsTrigger>
            <TabsTrigger value="listings">Tilbud</TabsTrigger>
            <TabsTrigger value="ai">AI Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Produktadministrasjon
                </CardTitle>
                <CardDescription>
                  Administrer produkter og varianter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Bruk SQL Editor i Supabase for å administrere produkter.
                </p>
                <Button
                  onClick={() => window.open('https://supabase.com/dashboard/project/yfutdebllhsawqzihysx/sql/new', '_blank')}
                >
                  Åpne SQL Editor
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="merchants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Butikkadministrasjon
                </CardTitle>
                <CardDescription>
                  Administrer butikker og deres informasjon
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Bruk SQL Editor i Supabase for å administrere butikker.
                </p>
                <Button
                  onClick={() => window.open('https://supabase.com/dashboard/project/yfutdebllhsawqzihysx/sql/new', '_blank')}
                >
                  Åpne SQL Editor
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tilbudsadministrasjon
                </CardTitle>
                <CardDescription>
                  Administrer pristilbud fra butikker
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Bruk SQL Editor i Supabase for å administrere tilbud.
                </p>
                <Button
                  onClick={() => window.open('https://supabase.com/dashboard/project/yfutdebllhsawqzihysx/sql/new', '_blank')}
                >
                  Åpne SQL Editor
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Job Processing
                </CardTitle>
                <CardDescription>
                  Process pending AI jobs for price normalization and attribute extraction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Click the button below to manually trigger the AI worker to process all pending jobs.
                  This will use Vertex AI to normalize offers and extract product attributes.
                </p>
                <Button 
                  onClick={handleProcessJobs}
                  disabled={processingJobs}
                  className="w-full sm:w-auto"
                >
                  {processingJobs ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Process AI Jobs'
                  )}
                </Button>
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>Current Status:</strong> 12 pending extract_product_image jobs
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => window.open('https://supabase.com/dashboard/project/yfutdebllhsawqzihysx/functions/ai-worker/logs', '_blank')}
                  >
                    View AI Worker Logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
