import HeroSection from '@/components/pages/home/HeroSection'
import TerminalTeaserSection from '@/components/pages/home/TerminalTeaserSection'
import MarketCoverageSection from '@/components/pages/home/MarketCoverageSection'
import PricingSection from '@/components/pages/home/PricingSection'
import '@/styles/homepage-v3.css'

export default function HomePage() {
  return (
    <main className="tn-home">
      <HeroSection />
      <TerminalTeaserSection />
      <MarketCoverageSection />
      <PricingSection />
    </main>
  )
}
