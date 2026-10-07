import { Button } from '../ui';
import ProductGrid from '../product/ProductGrid';

export default function FeaturedProducts({ title = 'Featured Products', subtitle = 'Handpicked by Jassi stylists', products, navigate }) {
  return (
    <section className="container-page bg-white py-5 md:bg-transparent md:py-8">
      <div className="mb-4 flex items-end justify-between gap-3 md:mb-5">
        <div className="min-w-0">
          <p className="small-text font-bold uppercase tracking-[0.14em] text-wine md:text-xs md:tracking-[0.2em]">{subtitle}</p>
          <h2 className="section-title mt-1 md:mt-2 md:text-3xl">{title}</h2>
        </div>
        <Button onClick={() => navigate('/products')} variant="outline" className="hidden rounded-full md:inline-flex">
          View all
        </Button>
      </div>
      <ProductGrid products={products} navigate={navigate} />
    </section>
  );
}
