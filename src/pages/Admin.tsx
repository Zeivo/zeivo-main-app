import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Store, Tag, ArrowLeft, Shield } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, loading } = useAdmin();

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
            <Button variant="outline" onClick={signOut}>
              Logg ut
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="products">Produkter</TabsTrigger>
            <TabsTrigger value="merchants">Butikker</TabsTrigger>
            <TabsTrigger value="listings">Tilbud</TabsTrigger>
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
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
