import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Shield, Loader2 } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
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
            <h1 className="text-2xl font-bold">Min Profil</h1>
          </div>
          <Button variant="outline" onClick={signOut}>
            Logg ut
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Kontoinformasjon
              </CardTitle>
              <CardDescription>
                Grunnleggende informasjon om kontoen din
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input value={user.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Opprettet</Label>
                <Input 
                  value={user.created_at ? new Date(user.created_at).toLocaleDateString('nb-NO') : "Ukjent"} 
                  disabled 
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sikkerhet
              </CardTitle>
              <CardDescription>
                Administrer kontosikkerheten din
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Passord</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  For å endre passordet ditt, vennligst logg ut og bruk "Glemt passordet?" funksjonen på innloggingssiden.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Tofaktorautentisering (MFA)</Label>
                <p className="text-sm text-muted-foreground">
                  MFA er ikke aktivert for denne kontoen ennå. Kontakt support for å aktivere denne funksjonen.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Farlig sone</CardTitle>
              <CardDescription>
                Handlinger som påvirker kontoen din permanent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={signOut}
                className="w-full"
              >
                Logg ut fra alle enheter
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Profile;
