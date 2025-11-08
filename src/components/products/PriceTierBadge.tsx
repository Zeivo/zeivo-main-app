import { Badge } from "@/components/ui/badge";

interface PriceTierBadgeProps {
  tier: string;
  count?: number;
}

export const PriceTierBadge = ({ tier, count }: PriceTierBadgeProps) => {
  const tierConfig = {
    excellent: { label: "Som ny", variant: "default" as const, color: "bg-green-500" },
    good: { label: "God stand", variant: "secondary" as const, color: "bg-blue-500" },
    acceptable: { label: "Brukt", variant: "outline" as const, color: "bg-yellow-500" },
    poor: { label: "Slitt", variant: "destructive" as const, color: "bg-red-500" },
  };

  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.acceptable;

  return (
    <Badge variant={config.variant} className="gap-1">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 text-xs opacity-70">({count})</span>
      )}
    </Badge>
  );
};
