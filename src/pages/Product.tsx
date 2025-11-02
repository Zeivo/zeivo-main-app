import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ArrowLeft, Bell } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Mock data - later can be replaced with API
const mockProducts: Record<string, any> = {
  "iphone-15-pro": {
    name: "iPhone 15 Pro",
    image: "https://images.unsplash.com/photo-1696446702052-1367f6c6d369?w=800&h=600&fit=crop",
    category: "Elektronikk",
    usedMinPrice: 8990,
    usedMaxPrice: 11990,
    finnSearchUrl: "https://www.finn.no/bap/forsale/search.html?q=iphone%2015%20pro",
    offers: [
      { merchant: "Elkjøp", price: 13990, url: "#", logo: "🏪" },
      { merchant: "Komplett", price: 13790, url: "#", logo: "🏪" },
      { merchant: "Power", price: 14490, url: "#", logo: "🏪" },
    ]
  },
  "airpods-pro": {
    name: "AirPods Pro (2. generasjon)",
    image: "https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800&h=600&fit=crop",
    category: "Lyd",
    usedMinPrice: 1990,
    usedMaxPrice: 2490,
    finnSearchUrl: "https://www.finn.no/bap/forsale/search.html?q=airpods%20pro",
    offers: [
      { merchant: "Elkjøp", price: 2990, url: "#", logo: "🏪" },
      { merchant: "NetOnNet", price: 2890, url: "#", logo: "🏪" },
    ]
  }
};

const Product = () => {
  const { slug } = useParams();
  const product = slug ? mockProducts[slug] : null;
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card>
          <CardHeader>
            <CardTitle>Produkt ikke funnet</CardTitle>
            <CardDescription>Produktet du leter etter finnes ikke.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tilbake til forsiden
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Varsel aktivert!",
      description: "Du vil få beskjed når prisen endres.",
    });
    setEmail("");
  };

  const savings = product.offers[0].price - product.usedMaxPrice;
  const savingsPercent = Math.round((savings / product.offers[0].price) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake til søk
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Product Header */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="aspect-square rounded-2xl overflow-hidden bg-muted">
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex flex-col justify-center">
            <Badge className="w-fit mb-4">{product.category}</Badge>
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
            <div className="bg-accent/10 border border-accent rounded-2xl p-6">
              <p className="text-sm text-muted-foreground mb-2">Spar opptil</p>
              <p className="text-4xl font-bold text-accent mb-2">{savings.toLocaleString('nb-NO')} kr</p>
              <p className="text-sm text-muted-foreground">ved å kjøpe brukt ({savingsPercent}% rabatt)</p>
            </div>
          </div>
        </div>

        {/* New Prices */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Nye priser</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {product.offers.map((offer: any, idx: number) => (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl">{offer.logo}</span>
                    <Badge variant="outline" className="text-xs">Reklame</Badge>
                  </div>
                  <CardTitle className="text-lg">{offer.merchant}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold mb-4">{offer.price.toLocaleString('nb-NO')} kr</p>
                  <Button className="w-full" asChild>
                    <a href={offer.url} target="_blank" rel="noopener noreferrer">
                      Se tilbud
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Used Price */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Bruktpris på Finn.no</h2>
          <Card className="bg-accent/5 border-accent">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Priser fra bruktmarkedet</p>
                  <p className="text-3xl font-bold">
                    {product.usedMinPrice.toLocaleString('nb-NO')} - {product.usedMaxPrice.toLocaleString('nb-NO')} kr
                  </p>
                </div>
                <Button size="lg" variant="outline" asChild>
                  <a href={product.finnSearchUrl} target="_blank" rel="noopener noreferrer">
                    Se på Finn.no
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Alert Form */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Få varsel om prisendringer
              </CardTitle>
              <CardDescription>
                Vi sender deg en e-post når prisen faller
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAlertSubmit} className="flex gap-4">
                <Input
                  type="email"
                  placeholder="din@epost.no"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit">Aktiver varsel</Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>

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

export default Product;
