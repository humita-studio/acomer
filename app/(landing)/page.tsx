import { MarketingHeader } from '@/features/marketing/components/MarketingHeader';
import { MarketingHero } from '@/features/marketing/components/MarketingHero';
import { MarketingFeatures } from '@/features/marketing/components/MarketingFeatures';
import { MarketingShowcase } from '@/features/marketing/components/MarketingShowcase';
import { MarketingSteps } from '@/features/marketing/components/MarketingSteps';
import { MarketingPricing } from '@/features/marketing/components/MarketingPricing';
import { MarketingCta } from '@/features/marketing/components/MarketingCta';
import { MarketingFooter } from '@/features/marketing/components/MarketingFooter';

/**
 * Landing de marketing del producto acomer (homepage pública en `/`). Shell delgado:
 * compone las secciones del feature `marketing`. Server Component; sólo el header
 * tiene interactividad (menú mobile).
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">
        <MarketingHero />
        <MarketingFeatures />
        <MarketingShowcase />
        <MarketingSteps />
        <MarketingPricing />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
