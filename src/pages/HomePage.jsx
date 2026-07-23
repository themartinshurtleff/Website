import HeroSection from '@/components/pages/home/HeroSection'
import TerminalTeaserSection from '@/components/pages/home/TerminalTeaserSection'
import FeaturesSection from '@/components/pages/home/FeaturesSection'
import PricingSection from '@/components/pages/home/PricingSection'
import '@/styles/homepage-v3.css'

export default function HomePage() {
  return (
    <main className="tn-home">
      <HeroSection />
      <TerminalTeaserSection />
      <FeaturesSection />
      <PricingSection />
    </main>
  )
}
