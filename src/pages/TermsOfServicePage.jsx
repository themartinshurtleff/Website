import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const sections = [
  {
    title: '1. Introduction',
    body: `Welcome to TradeNet ("we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of our website, Discord community, trading indicators, educational content, and all related services (collectively, the "Services"). By accessing or using our Services, you agree to be bound by these Terms. If you do not agree, please do not use our Services.`,
  },
  {
    title: '2. Eligibility and Conduct',
    body: `You must be at least 18 years of age to use our Services. By using our Services, you represent and warrant that you meet this requirement. You agree to use the Services only for lawful purposes and in a manner that does not infringe the rights of others or restrict their use of the Services. You agree not to share, resell, or redistribute any proprietary content, indicators, or materials provided through the Services.`,
  },
  {
    title: '3. Educational Purpose and No Professional Advice',
    body: `All content, signals, analysis, indicators, educational materials, and communications provided through our Services are for educational and informational purposes only. Nothing on our platform constitutes financial, investment, legal, or tax advice. We are not registered investment advisors, broker-dealers, or financial planners. You should consult a licensed financial professional before making any investment decisions. Your use of our Services and any decisions you make based on them are solely your own responsibility.`,
  },
  {
    title: '4. Performance Statistics and Win-Rate Disclosures',
    body: `Any performance statistics, win-rates, risk/reward ratios, or other quantitative claims presented on our website or within our Services are based on historical backtesting and past performance data. These figures are provided for illustrative purposes only and are not a guarantee, promise, or prediction of future results. Past performance is not indicative of future results. Individual results will vary based on market conditions, position sizing, risk management, and trader execution.`,
  },
  {
    title: '5. Indicator and Analytical Tools',
    body: `Our proprietary indicators and analytical tools, including the Fusion v2 Indicator Suite, are provided "as-is" for use on TradingView and other compatible platforms. These tools are designed to assist in analysis and are not automated trading systems. We make no warranty that the indicators will be error-free or that their signals will result in profitable trades. You are solely responsible for all trading decisions made using these tools.`,
  },
  {
    title: '6. Intellectual-Property Rights and Restricted Use',
    body: `All content, indicators, educational materials, videos, documents, and other materials provided through our Services are the exclusive intellectual property of TradeNet and are protected by applicable copyright, trademark, and trade secret laws. You are granted a limited, non-exclusive, non-transferable license to access and use these materials for your personal, non-commercial use only. You may not copy, reproduce, distribute, modify, create derivative works of, publicly display, or commercially exploit any of our proprietary materials without our express written consent.`,
  },
  {
    title: '7. Payment Processing and Refund Policy',
    body: `Paid subscriptions are processed through Stripe or another payment processor we designate. By purchasing a subscription, you authorize recurring charges for the selected plan until cancellation. All sales are final unless otherwise required by law. We do not offer refunds on digital products, terminal access, indicator access, or educational content once access has been granted. Monthly and annual subscribers may cancel at any time; cancellation will take effect at the end of the current billing period. We reserve the right to modify our pricing at any time with reasonable notice.`,
  },
  {
    title: '8. Disclaimer of Warranties',
    body: `OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING, WITHOUT LIMITATION, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT OUR SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT DEFECTS WILL BE CORRECTED.`,
  },
  {
    title: '9. Risk Statement and Limitation of Liability',
    body: `Trading financial instruments, including cryptocurrency futures and derivatives, involves a substantial risk of loss and is not appropriate for all investors. The following specific risks apply:\n\n(a) You may lose some or all of your invested capital.\n(b) Leverage amplifies both gains and losses.\n(c) Market volatility can result in rapid and significant losses.\n(d) Past performance of any indicator or strategy does not guarantee future results.\n(e) Liquidity risk may prevent you from closing positions at desired prices.\n(f) Technical failures in platforms or connectivity may result in trading losses.\n(g) Regulatory changes may affect the availability or legality of certain instruments.\n(h) Cryptocurrency markets operate 24/7 and are subject to extreme volatility.\n(i) Backtested results may not account for slippage, fees, or real market conditions.\n\nTO THE MAXIMUM EXTENT PERMITTED BY LAW, TRADENET SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OUR SERVICES OR FROM ANY TRADING DECISIONS MADE IN RELIANCE ON OUR CONTENT.`,
  },
  {
    title: '10. Indemnification',
    body: `You agree to indemnify, defend, and hold harmless TradeNet, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or in connection with: (a) your use of our Services; (b) your violation of these Terms; (c) any trading losses you incur; or (d) your violation of any third-party rights.`,
  },
  {
    title: '11. Modifications to the Services and Terms',
    body: `We reserve the right to modify, suspend, or discontinue any aspect of our Services at any time without notice. We may also update these Terms from time to time. Your continued use of our Services following any changes constitutes acceptance of the modified Terms. We encourage you to review these Terms periodically.`,
  },
  {
    title: '12. Governing Law and Dispute Resolution',
    body: `These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles. Any disputes arising from or relating to these Terms or our Services shall first be subject to good-faith negotiation. If unresolved, disputes shall be submitted to binding arbitration in accordance with the rules of the American Arbitration Association.`,
  },
  {
    title: '13. Severability',
    body: `If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it enforceable.`,
  },
  {
    title: '14. Entire Agreement',
    body: `These Terms, together with our Privacy Policy and any other agreements incorporated by reference, constitute the entire agreement between you and TradeNet with respect to the subject matter hereof and supersede all prior and contemporaneous understandings, agreements, representations, and warranties.`,
  },
  {
    title: '15. Contact Information',
    body: `If you have any questions about these Terms of Service, please contact us at:\n\nEmail: support@tradenet.org\nDiscord: discord.gg/tradenet`,
  },
]

export default function TermsOfServicePage() {
  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="section-container flex items-center justify-between h-14">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[#71717A] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <img
            src="https://storage.googleapis.com/hostinger-horizons-assets-prod/3d810307-bbc4-4f21-91d6-f292df1a885d/efe116b9b5047322099b7e584bf45b6a.png"
            alt="TradeNet"
            className="h-6 w-auto"
          />
          <div className="w-24" />
        </div>
      </header>

      <main className="bg-black min-h-screen py-16">
        <div className="section-container max-w-3xl">
          <div className="mb-10">
            <h1 className="text-[clamp(28px,4vw,44px)] font-black tracking-[-0.03em] text-[#FAFAFA] mb-3">
              Terms of Service
            </h1>
            <p className="text-sm text-[#71717A]">Last updated: June 22, 2026</p>
          </div>

          <div className="space-y-8">
            {sections.map((s) => (
              <div key={s.title} className="space-y-3">
                <h2 className="text-[16px] font-bold text-[#FAFAFA]">{s.title}</h2>
                {s.body.split('\n\n').map((para, i) => (
                  <p key={i} className="text-[14px] text-[#A1A1AA] leading-[1.8]">
                    {para}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
