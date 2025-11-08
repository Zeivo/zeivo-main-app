import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MarketInsightsProps {
  insights?: {
    summary: string;
    price_trend: string;
    best_value_tier: string;
    recommendation: string;
  };
}

export const MarketInsights = ({ insights }: MarketInsightsProps) => {
  if (!insights) return null;

  const getTrendIcon = () => {
    if (insights.price_trend.toLowerCase().includes('opp') || 
        insights.price_trend.toLowerCase().includes('stig')) {
      return <TrendingUp className="h-4 w-4 text-destructive" />;
    }
    if (insights.price_trend.toLowerCase().includes('ned') || 
        insights.price_trend.toLowerCase().includes('fall')) {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    }
    return <Info className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Info className="h-5 w-5" />
        Markedsinnsikt
      </h3>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sammendrag</p>
          <p className="text-sm">{insights.summary}</p>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">Pristrend:</p>
          {getTrendIcon()}
          <p className="text-sm">{insights.price_trend}</p>
        </div>

        {insights.best_value_tier && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Best verdi</p>
            <p className="text-sm">{insights.best_value_tier}</p>
          </div>
        )}

        {insights.recommendation && (
          <Alert>
            <AlertDescription className="text-sm">
              {insights.recommendation}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
};
