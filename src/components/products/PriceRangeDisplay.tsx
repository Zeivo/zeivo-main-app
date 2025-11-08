import { Card } from "@/components/ui/card";
import { PriceTierBadge } from "./PriceTierBadge";

interface PriceRange {
  min: number;
  max: number;
  median: number;
}

interface QualityTier {
  min: number;
  max: number;
  count: number;
}

interface PriceRangeDisplayProps {
  priceRange: PriceRange;
  qualityTiers?: { [key: string]: QualityTier };
  condition: "new" | "used";
}

export const PriceRangeDisplay = ({ 
  priceRange, 
  qualityTiers,
  condition 
}: PriceRangeDisplayProps) => {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {condition === "new" ? "Nye produkter" : "Brukte produkter"}
          </p>
          <p className="text-2xl font-bold">
            {Math.round(priceRange.median).toLocaleString('no-NO')} kr
          </p>
          <p className="text-xs text-muted-foreground">
            {Math.round(priceRange.min).toLocaleString('no-NO')} - {Math.round(priceRange.max).toLocaleString('no-NO')} kr
          </p>
        </div>
      </div>

      {qualityTiers && Object.keys(qualityTiers).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Kvalitetsnivåer:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(qualityTiers).map(([tier, data]) => (
              <div key={tier} className="flex flex-col gap-1">
                <PriceTierBadge tier={tier} count={data.count} />
                <p className="text-xs text-muted-foreground text-center">
                  {Math.round(data.min).toLocaleString('no-NO')} - {Math.round(data.max).toLocaleString('no-NO')} kr
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
