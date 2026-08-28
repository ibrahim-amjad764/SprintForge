// app/pricing/page.tsx
import Pricing from '@/components/billing/Pricing';

export default function PricingPage() {
  return (
    <div className="container mx-auto py-20">
      <h1 className="mb-10 text-4xl font-bold">Pricing</h1>

      <Pricing />
    </div>
  );
}
