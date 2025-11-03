import { useParams, Link } from "react-router-dom";
import { useProduct, useProductVariants, useVariantListings } from "@/hooks/useProducts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ExternalLink } from "lucide-react";

const Product = () => {
  const { slug } = useParams();
  const { data: product, isLoading: productLoading } = useProduct(slug);
  const { data: variants = [], isLoading: variantsLoading } = useProductVariants(product?.id);

  if (productLoading || variantsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laster produkt...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Produktet ble ikke funnet</h1>
          <Link to="/">
            <Button>Gå tilbake</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbake til oversikt
        </Link>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="w-full rounded-lg shadow-lg"
              />
            )}
          </div>

          <div>
            <Badge className="mb-2">{product.category}</Badge>
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
            
            {variants.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">
                    Ingen varianter tilgjengelig for dette produktet ennå.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Tilgjengelige varianter</h2>
                {variants.map((variant) => (
                  <VariantCard key={variant.id} variant={variant} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const VariantCard = ({ variant }: { variant: any }) => {
  const { data: listings = [] } = useVariantListings(variant.id);

  const newListings = listings.filter(l => l.condition === 'new');
  const usedListings = listings.filter(l => l.condition === 'used');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {variant.storage_gb && `${variant.storage_gb}GB`}
          {variant.color && ` • ${variant.color}`}
          {variant.model && ` • ${variant.model}`}
        </CardTitle>
        {variant.confidence > 0 && (
          <Badge variant="outline" className="w-fit">
            Confidence: {(variant.confidence * 100).toFixed(0)}%
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">
              Ny ({newListings.length})
            </TabsTrigger>
            <TabsTrigger value="used">
              Brukt ({usedListings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            {variant.price_new && (
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Gjennomsnittspris</p>
                <p className="text-3xl font-bold text-primary">{variant.price_new.toLocaleString('no-NO')} kr</p>
              </div>
            )}
            <Separator />
            {newListings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ingen nye tilbud tilgjengelig
              </p>
            ) : (
              <div className="space-y-3">
                {newListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="used" className="space-y-4 mt-4">
            {variant.price_used && (
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Gjennomsnittspris</p>
                <p className="text-3xl font-bold text-primary">{variant.price_used.toLocaleString('no-NO')} kr</p>
              </div>
            )}
            <Separator />
            {usedListings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ingen brukte tilbud tilgjengelig
              </p>
            ) : (
              <div className="space-y-3">
                {usedListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const ListingCard = ({ listing }: { listing: any }) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {listing.url && (
              <img 
                src={`https://www.google.com/s2/favicons?domain=${new URL(listing.url).hostname}&sz=64`}
                alt={`${listing.merchant_name} favicon`}
                className="h-6 w-6"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div>
              <p className="font-semibold">{listing.merchant_name}</p>
              {listing.confidence > 0 && (
                <p className="text-xs text-muted-foreground">
                  Confidence: {(listing.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xl font-bold">{listing.price.toLocaleString('no-NO')} kr</p>
            {listing.url && (
              <Button asChild variant="outline" size="sm">
                <a href={listing.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Product;
