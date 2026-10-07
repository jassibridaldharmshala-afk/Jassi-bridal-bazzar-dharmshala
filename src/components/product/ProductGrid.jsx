import { Card, CardContent, CardTitle } from '../ui';
import ProductCard from './ProductCard';

export default function ProductGrid({ products, navigate, className = '', gridClassName = '', onBeforeProductOpen, priorityCount = 0 }) {
  if (!products.length) {
    return (
      <Card className={className ? `text-center ${className}` : 'text-center'}>
        <CardContent className="p-6 md:p-10">
          <CardTitle className="text-xl">No products found</CardTitle>
          <p className="body-text mt-2 text-slate-500">Try changing filters or search terms.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div data-mobile-product-grid className={`grid grid-cols-2 gap-x-2.5 gap-y-[18px] md:grid-cols-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 ${gridClassName}`}>
      {products.map((product, index) => <ProductCard key={product.id || product._id || product.slug} product={product} navigate={navigate} onBeforeOpen={onBeforeProductOpen} imagePriority={index < priorityCount} />)}
    </div>
  );
}
