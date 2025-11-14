import { useParams, Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useProduct, useProductVariants } from "@/hooks/useProducts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PriceRangeDisplay } from "@/components/products/PriceRangeDisplay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const Product = () => {
  const { slug } = useParams();
  const { data: product, isLoading: productLoading } = useProduct(slug);
  const { data: variants = [], isLoading: variantsLoading } = useProductVariants(product?.id);
  
  const [selectedStorage, setSelectedStorage] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Extract unique options from variants
  const storageOptions = useMemo(() => {
    const options = [...new Set(variants.map(v => v.storage_gb).filter(Boolean))];
    return options.sort((a, b) => a - b);
  }, [variants]);

  const colorOptions = useMemo(() => {
    return [...new Set(variants.map(v => v.color).filter(Boolean))];
  }, [variants]);

  const modelOptions = useMemo(() => {
    return [...new Set(variants.map(v => v.model).filter(Boolean))];
  }, [variants]);

  // Set initial selections when variants load
  useMemo(() => {
    if (variants.length > 0 && !selectedStorage && !selectedColor && !selectedModel) {
      if (storageOptions.length > 0) setSelectedStorage(storageOptions[0].toString());
      if (colorOptions.length > 0) setSelectedColor(colorOptions[0]);
      if (modelOptions.length > 0) setSelectedModel(modelOptions[0]);
    }
  }, [variants, storageOptions, colorOptions, modelOptions, selectedStorage, selectedColor, selectedModel]);

  // Find the matching variant based on selections
  const selectedVariant = useMemo(() => {
    return variants.find(v => {
      const storageMatch = !selectedStorage || v.storage_gb?.toString() === selectedStorage;
      const colorMatch = !selectedColor || v.color === selectedColor;
      const modelMatch = !selectedModel || v.model === selectedModel;
      return storageMatch && colorMatch && modelMatch;
    });
  }, [variants, selectedStorage, selectedColor, selectedModel]);

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
              <div className="space-y-6">
                {/* Variant Selectors */}
                <Card>
                  <CardHeader>
                    <CardTitle>Velg variant</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {storageOptions.length > 0 && (
                      <div className="space-y-2">
                        <Label>Lagringsplass</Label>
                        <Select value={selectedStorage} onValueChange={setSelectedStorage}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Velg lagringsplass" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {storageOptions.map((storage) => (
                              <SelectItem key={storage} value={storage.toString()}>
                                {storage} GB
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {colorOptions.length > 0 && (
                      <div className="space-y-2">
                        <Label>Farge</Label>
                        <Select value={selectedColor} onValueChange={setSelectedColor}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Velg farge" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {colorOptions.map((color) => (
                              <SelectItem key={color} value={color}>
                                {color}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {modelOptions.length > 0 && (
                      <div className="space-y-2">
                        <Label>Modell</Label>
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Velg modell" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {modelOptions.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Selected Variant Display */}
                {selectedVariant && (
                  <VariantCard 
                    variant={selectedVariant} 
                    productName={product.name} 
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Market Insights at bottom */}
        <Alert className="max-w-4xl mx-auto">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Sammenlign alltid priser på tvers av forskjellige selgere og sjekk nøye beskrivelsen av varens tilstand. 
            Vurder om en "god" eller "akseptabel" tilstand er tilstrekkelig for ditt behov for å spare penger. 
            Vær også oppmerksom på lagringsplass og farge, da dette kan påvirke prisen.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

const VariantCard = ({ variant, productName }: { variant: any; productName: string }) => {
  const priceData = variant.price_data;
  const newPriceData = priceData?.new;
  const usedPriceData = priceData?.used;
  
  const hasNewPrice = variant.price_new && variant.price_new > 0;
  const hasUsedPrice = usedPriceData?.price_range && variant.price_used && variant.price_used > 0;

  const finnSearchUrl = `https://www.finn.no/bap/forsale/search.html?q=${encodeURIComponent(
    `${productName} ${variant.storage_gb ? variant.storage_gb + 'GB' : ''} ${variant.color || ''}`
  )}`;

  // Don't render card if no price data at all
  if (!hasNewPrice && !hasUsedPrice) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {variant.storage_gb && `${variant.storage_gb}GB`}
          {variant.color && ` • ${variant.color}`}
          {variant.model && ` • ${variant.model}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          {hasNewPrice && (
            <PriceRangeDisplay
              priceRange={{
                min: variant.price_new,
                max: variant.price_new,
                median: variant.price_new
              }}
              condition="new"
            />
          )}
          {hasUsedPrice && (
            <div className="space-y-3">
              <PriceRangeDisplay
                priceRange={usedPriceData.price_range}
                qualityTiers={Object.keys(usedPriceData.tiers || {}).length > 0 ? usedPriceData.tiers : undefined}
                condition="used"
              />
              <Button asChild variant="outline" className="w-full">
                <a href={finnSearchUrl} target="_blank" rel="noopener noreferrer">
                  Se tilbud på Finn.no
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Product;
