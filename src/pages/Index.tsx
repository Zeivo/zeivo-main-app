import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, Heart, TrendingDown, LogIn, Shield, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";

const Index = () => {
  const { data: products = [], isLoading } = useProducts();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Du må være innlogget for å søke", {
        description: "Registrer deg gratis for å bruke Zeivo"
      });
      navigate('/auth');
      return;
    }

    if (searchQuery.trim()) {
      const matchingProduct = products.find(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (matchingProduct) {
        navigate(`/produkt/${matchingProduct.slug}`);
      } else {
        toast.error("Fant ikke produktet", {
          description: "Prøv et annet søkeord"
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-foreground">Zeivo</h1>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
                <User className="h-4 w-4 mr-2" />
                Profil
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button variant="outline" onClick={() => signOut()}>
                Logg ut
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => navigate('/auth')}>
              <LogIn className="h-4 w-4 mr-2" />
              Logg inn
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Nytt eller brukt?
            </h1>
            <p className="text-xl md:text-2xl font-semibold mb-4 text-accent">
              Zeivo — kjøp smart, spar bærekraftig
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Sammenlign priser fra norske butikker og finn ut om det lønner seg å kjøpe nytt eller brukt.
              Zeivo viser deg beste prisen, miljøgevinsten og lar deg velge med samvittighet.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={user ? "Søk etter produkt" : "Logg inn for å søke"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg rounded-2xl"
                  disabled={!user}
                />
                <Button 
                  type="submit" 
                  size="lg"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  disabled={!user}
                >
                  Søk
                </Button>
              </div>
            </form>
            {!user && (
              <p className="text-sm text-muted-foreground mt-4">
                <Link to="/auth" className="text-accent hover:underline">Registrer deg gratis</Link> for å søke og sammenligne priser
              </p>
            )}
          </div>
        </div>

        {/* Decorative gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/5 to-transparent" />
      </section>

      {/* Products Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Produkter</h2>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Laster produkter...</p>
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Ingen produkter tilgjengelig ennå. Produkter vil bli lagt til snart.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link key={product.id} to={`/produkt/${product.slug}`}>
                <Card className="hover:shadow-lg transition-shadow h-full">
                  <CardHeader>
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-48 object-contain rounded-md mb-4"
                      />
                    )}
                    <Badge className="w-fit mb-2">{product.category}</Badge>
                    <CardTitle>{product.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Klikk for å se varianter og priser
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How it Works */}
      <section className="container mx-auto px-4 py-16 bg-muted/30 rounded-3xl my-16">
        <h2 className="text-3xl font-bold mb-12 text-center">Hvordan fungerer det?</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="border-none shadow-none bg-transparent">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>1. Søk etter produktet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Finn det du vurderer å kjøpe – vi henter priser fra norske butikker.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-none bg-transparent">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <TrendingDown className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>2. Se nytt vs. brukt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Sammenlign direkte med brukte priser fra Finn.no og se hvor mye du sparer.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-none bg-transparent">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Heart className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>3. Kjøp smart, spar bærekraftig</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Velg den løsningen som passer både lommeboken og miljøet.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-accent/10 to-accent/5 rounded-3xl p-12">
          <Sparkles className="h-12 w-12 text-accent mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Klar til å spare penger?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Søk etter produktet ditt og se hvor mye du kan spare ved å handle smart.
          </p>
          <Button size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Prøv Zeivo gratis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Zeivo — kjøp smart, spar bærekraftig</p>
          <p className="mt-2">Laget i Norge 🇳🇴</p>
          <div className="mt-4 flex justify-center gap-6">
            <button 
              onClick={() => navigate('/support')} 
              className="hover:text-foreground transition-colors"
            >
              Support & FAQ
            </button>
            <a 
              href="mailto:kontakt@zeivo.no" 
              className="hover:text-foreground transition-colors"
            >
              Kontakt
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
