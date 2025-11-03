import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ArrowLeft, Bell, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useProduct, useProductOffers } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Product = () => {
  const { slug } = useParams();
  const { data: product, isLoading: productLoading } = useProduct(slug);
  const { data: offers = [], isLoading: offersLoading } = useProductOffers(product?.id);
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  if (productLoading || offersLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  const handleAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const price = parseInt(targetPrice);
      if (isNaN(price) || price <= 0) {
        toast({
          title: "Ugyldig pris",
          description: "Vennligst oppgi en gyldig målpris.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("price_alerts").insert({
        user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        product_id: product.id,
        email,
        target_price: price,
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "Varsel aktivert!",
        description: "Du vil få beskjed når prisen faller under din målpris.",
      });
      setEmail("");
      setTargetPrice("");
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke aktivere varsel.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const newOffers = offers.filter(o => o.condition === "new");
  const lowestNewPrice = newOffers.length > 0 ? newOffers[0].price : product.new_price_low;
  const savings = lowestNewPrice && product.used_price_high 
    ? lowestNewPrice - product.used_price_high 
    : 0;
  const savingsPercent = lowestNewPrice && savings 
    ? Math.round((savings / lowestNewPrice) * 100) 
    : 0;

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
          <div className="aspect-square rounded-2xl overflow-hidden bg-muted relative">
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              Photo by <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">Unsplash</a>
            </div>
          </div>
          
          <div className="flex flex-col justify-center">
            <Badge className="w-fit mb-4">{product.category}</Badge>
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
            {savings > 0 && (
              <div className="bg-accent/10 border border-accent rounded-2xl p-6">
                <p className="text-sm text-muted-foreground mb-2">Spar opptil</p>
                <p className="text-4xl font-bold text-accent mb-2">{savings.toLocaleString('nb-NO')} kr</p>
                <p className="text-sm text-muted-foreground">ved å kjøpe brukt ({savingsPercent}% rabatt)</p>
              </div>
            )}
          </div>
        </div>

        {/* New Prices */}
        {newOffers.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Nye priser</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {newOffers.map((offer) => {
                // Clean URL by removing 'reklame' parameter
                const cleanUrl = offer.url 
                  ? offer.url.replace(/[?&]reklame[^&]*/, '').replace(/\?&/, '?').replace(/\?$/, '')
                  : "#";
                
                return (
                  <Card key={offer.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl">🏪</span>
                      </div>
                      <CardTitle className="text-lg">{offer.merchant_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold mb-4">{offer.price.toLocaleString('nb-NO')} kr</p>
                      <Button className="w-full" asChild disabled={!offer.url}>
                        <a href={cleanUrl} target="_blank" rel="noopener noreferrer">
                          Se tilbud
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Used Price */}
        {product.used_price_low && product.used_price_high && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Bruktpris på Finn.no</h2>
            <Card className="bg-accent/5 border-accent">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Priser fra bruktmarkedet</p>
                    <p className="text-3xl font-bold">
                      {product.used_price_low.toLocaleString('nb-NO')} - {product.used_price_high.toLocaleString('nb-NO')} kr
                    </p>
                  </div>
                  <Button size="lg" variant="outline" asChild>
                    <a href={`https://www.finn.no/bap/forsale/search.html?q=${encodeURIComponent(product.name)}`} target="_blank" rel="noopener noreferrer">
                      Se på Finn.no
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Alert Form */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Få varsel om prisendringer
              </CardTitle>
              <CardDescription>
                Vi sender deg en e-post når prisen faller under din målpris
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAlertSubmit} className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    type="email"
                    placeholder="din@epost.no"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Målpris (kr)"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    required
                    className="w-40"
                  />
                </div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aktiverer...
                    </>
                  ) : (
                    "Aktiver varsel"
                  )}
                </Button>
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