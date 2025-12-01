import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  priority_score: number;
  scrape_frequency_hours: number;
}

export const ProductPriorityManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, priority_score, scrape_frequency_hours')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
        toast({ title: 'Error', description: 'Could not fetch products.', variant: 'destructive' });
      } else {
        setProducts(data as Product[]);
      }
      setLoading(false);
    };
    fetchProducts();
  }, [toast]);

  const handleUpdate = (id: string, field: keyof Product, value: string) => {
    const updatedProducts = products.map(p =>
      p.id === id ? { ...p, [field]: parseInt(value, 10) || 0 } : p
    );
    setProducts(updatedProducts);
  };

  const handleSave = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({
        priority_score: product.priority_score,
        scrape_frequency_hours: product.scrape_frequency_hours,
      })
      .eq('id', product.id);

    if (error) {
      toast({ title: 'Error', description: `Failed to update ${product.name}.`, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${product.name} updated.` });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Priority</CardTitle>
        <CardDescription>Manage scraping priority and frequency for each product.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Priority Score</TableHead>
              <TableHead>Scrape Frequency (hours)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(product => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={product.priority_score}
                    onChange={e => handleUpdate(product.id, 'priority_score', e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={product.scrape_frequency_hours}
                    onChange={e => handleUpdate(product.id, 'scrape_frequency_hours', e.target.value)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Button onClick={() => handleSave(product)}>Save</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
