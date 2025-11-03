import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Sparkles, Heart, TrendingDown, LogIn, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: products = [], isLoading, error } = useProducts();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Find matching product by name
      const matchingProduct = products.find(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (matchingProduct) {
        navigate(`/produkt/${matchingProduct.slug}`);
      }
    }
  };

  // Get featured products (first 2)
  const featuredProducts = products.slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-foreground">Zeivo</h1>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user.email}</span>
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
                  placeholder="Søk etter produkt (prøv 'iPhone' eller 'AirPods')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg rounded-2xl"
                />
                <Button 
                  type="submit" 
                  size="lg"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  Søk
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Decorative gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/5 to-transparent" />
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Populære produkter</h2>
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Kunne ikke laste produkter. Prøv igjen senere.</p>
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Ingen produkter tilgjengelig for øyeblikket.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {featuredProducts.map((product) => {
              const savings = product.new_price_low && product.used_price_high 
                ? product.new_price_low - product.used_price_high 
                : 0;
              const savingsPercent = product.new_price_low && savings
                ? Math.round((savings / product.new_price_low) * 100)
                : 0;
              
              return (
                <Card 
                  key={product.id} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/produkt/${product.slug}`)}
                >
                  <div className="aspect-video overflow-hidden bg-muted">
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle>{product.name}</CardTitle>
                    {savings > 0 && (
                      <CardDescription>
                        Spar {savings.toLocaleString('nb-NO')} kr ({savingsPercent}%)
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      {product.new_price_low && (
                        <div>
                          <p className="text-sm text-muted-foreground">Nytt fra</p>
                          <p className="text-xl font-bold">{product.new_price_low.toLocaleString('nb-NO')} kr</p>
                        </div>
                      )}
                      {product.used_price_low && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Brukt fra</p>
                          <p className="text-xl font-bold text-accent">{product.used_price_low.toLocaleString('nb-NO')} kr</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
          <p className="mt-2">Kontakt: kontakt@zeivo.no</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;