import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Loader2, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const ScrapingManager = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [budget, setBudget] = useState<any>(null);
  const { toast } = useToast();

  const fetchBudget = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('budget-manager', {
        body: { action: 'get' }
      });

      if (error) throw error;

      if (data?.budget) {
        setBudget(data.budget);
      }
    } catch (error: any) {
      console.error('Error fetching budget:', error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke hente budsjettinformasjon",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePrices = async () => {
    setIsUpdating(true);
    try {
      toast({
        title: "Starter prisopdatering",
        description: "Dette kan ta flere minutter...",
      });

      const { data, error } = await supabase.functions.invoke('update-prices');

      if (error) throw error;

      toast({
        title: "Prisopdatering fullført",
        description: `Oppdatert ${data.summary?.variants_updated || 0} varianter fra ${data.summary?.listings_scraped || 0} annonser`,
      });

      await fetchBudget();
    } catch (error: any) {
      console.error('Error updating prices:', error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke oppdatere priser",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetBudget = async () => {
    try {
      const { error } = await supabase.functions.invoke('budget-manager', {
        body: { action: 'reset' }
      });

      if (error) throw error;

      toast({
        title: "Budsjett tilbakestilt",
        description: "Daglig budsjett er tilbakestilt til 100 forespørsler",
      });

      await fetchBudget();
    } catch (error: any) {
      console.error('Error resetting budget:', error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke tilbakestille budsjett",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Scraping Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button 
              onClick={handleUpdatePrices} 
              disabled={isUpdating}
              className="flex-1"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Oppdaterer...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Oppdater priser
                </>
              )}
            </Button>
            <Button 
              onClick={fetchBudget} 
              variant="outline"
            >
              Hent status
            </Button>
          </div>

          {budget && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Daglig budsjett</span>
                <span className="text-sm text-muted-foreground">
                  {budget.budget_used} / {budget.budget_total} brukt
                </span>
              </div>
              <Progress 
                value={(budget.budget_used / budget.budget_total) * 100} 
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{budget.budget_remaining} forespørsler gjenstår</span>
                <span>Dato: {new Date(budget.date).toLocaleDateString('no-NO')}</span>
              </div>
              <Button 
                onClick={handleResetBudget} 
                variant="outline" 
                size="sm"
                className="w-full mt-2"
              >
                Tilbakestill budsjett
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
