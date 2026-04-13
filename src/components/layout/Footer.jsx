import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-black">
      <div className="section-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="inline-block mb-4">
              <img
                src="https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/6725a03a8625d8a52b24236d4aa8163e.png"
                alt="TradeNet"
                className="h-7 w-auto opacity-70 hover:opacity-100 transition-opacity"
              />
            </Link>
            <p className="text-sm text-[#71717A] leading-relaxed">
              Institutional-grade tools and education for serious traders.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#71717A] mb-4">Product</p>
            <ul className="space-y-2.5">
              <li>
                <Link to="/terminal" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  TradeNet Terminal
                </Link>
              </li>
              <li>
                <Link to="/indicator" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Fusion Indicator
                </Link>
              </li>
              <li>
                <Link to="/#features" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <a
                  href="https://whop.com/checkout/plan_vpZI2qjyG8yxs?d2c=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
                >
                  Try Risk Free
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#71717A] mb-4">Company</p>
            <ul className="space-y-2.5">
              <li>
                <Link to="/about" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/case-studies" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Reviews
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#71717A] mb-4">Resources</p>
            <ul className="space-y-2.5">
              <li>
                <a href="/docs" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="/blog" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <a href="https://discord.gg/tradenet" target="_blank" rel="noopener noreferrer" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#71717A]">© 2026 TradeNet L.L.C.. All rights reserved.</p>
          <p className="text-xs text-[#71717A] text-center sm:text-right max-w-sm">
            Trading involves substantial risk. Past performance is not indicative of future results.
          </p>
        </div>
      </div>
    </footer>
  )
}
