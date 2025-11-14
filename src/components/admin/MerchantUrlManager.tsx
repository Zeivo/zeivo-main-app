import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface MerchantUrl {
  id: string;
  category: string;
  merchant_name: string;
  url: string;
  url_type: string;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
}

export const MerchantUrlManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState({
    category: "",
    merchant_name: "",
    url: "",
    url_type: "category" as "category" | "product",
  });

  // Fetch unique categories
  const { data: categories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category")
        .order("category");
      if (error) throw error;
      // Get unique categories
      const uniqueCategories = [...new Set(data.map(p => p.category))];
      return uniqueCategories;
    },
  });

  // Fetch merchant URLs
  const { data: merchantUrls, isLoading } = useQuery({
    queryKey: ["merchant-urls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_urls")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MerchantUrl[];
    },
  });

  // Add merchant URL
  const addMutation = useMutation({
    mutationFn: async (url: typeof newUrl) => {
      console.log('Inserting URL:', url);
      const { data, error } = await supabase
        .from("merchant_urls")
        .insert([url])
        .select();
      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      console.log('Insert success:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-urls"] });
      toast({ title: "Merchant URL added successfully" });
      setIsAddDialogOpen(false);
      setNewUrl({ category: "", merchant_name: "", url: "", url_type: "category" });
    },
    onError: (error) => {
      toast({
        title: "Error adding merchant URL",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Delete merchant URL
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_urls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-urls"] });
      toast({ title: "Merchant URL deleted" });
    },
    onError: (error) => {
      toast({
        title: "Error deleting merchant URL",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("merchant_urls")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-urls"] });
    },
  });


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Merchant URLs</CardTitle>
            <CardDescription>
              Manage crawl URLs for retailers by category. One URL can serve multiple products in the same category.
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add URL
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Merchant URL</DialogTitle>
                <DialogDescription>
                  Add a category or product URL to crawl
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={newUrl.category}
                    onValueChange={(value) =>
                      setNewUrl({ ...newUrl, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Merchant</Label>
                  <Select
                    value={newUrl.merchant_name}
                    onValueChange={(value) =>
                      setNewUrl({ ...newUrl, merchant_name: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select merchant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Komplett">Komplett</SelectItem>
                      <SelectItem value="Netonnet">Netonnet</SelectItem>
                      <SelectItem value="Proshop">Proshop</SelectItem>
                      <SelectItem value="Power">Power</SelectItem>
                      <SelectItem value="Elkjøp">Elkjøp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>URL Type</Label>
                  <Select
                    value={newUrl.url_type}
                    onValueChange={(value: "category" | "product") =>
                      setNewUrl({ ...newUrl, url_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category (Crawls multiple products)</SelectItem>
                      <SelectItem value="product">Single Product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    placeholder="https://www.komplett.no/category/mobiltelefoner"
                    value={newUrl.url}
                    onChange={(e) => setNewUrl({ ...newUrl, url: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => addMutation.mutate(newUrl)}
                  disabled={
                    !newUrl.category ||
                    !newUrl.merchant_name ||
                    !newUrl.url ||
                    addMutation.isPending
                  }
                >
                  Add URL
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : merchantUrls && merchantUrls.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Last Scraped</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchantUrls.map((url) => (
                <TableRow key={url.id}>
                  <TableCell className="font-medium">
                    {url.category}
                  </TableCell>
                  <TableCell>{url.merchant_name}</TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-1 bg-secondary rounded">
                      {url.url_type}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    <a
                      href={url.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {url.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={url.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({
                          id: url.id,
                          is_active: checked,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {url.last_scraped_at
                      ? new Date(url.last_scraped_at).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(url.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No merchant URLs configured. Add one to start crawling.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
