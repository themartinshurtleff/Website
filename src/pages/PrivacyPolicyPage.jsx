import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const sections = [
  {
    title: '1. Scope',
    body: `This Privacy Policy explains how TradeNet L.L.C. ("TradeNet," "we," "us," or "our") collects, uses, stores, and shares information when you use tradenet.org, create a TradeNet account, join the waitlist, purchase a subscription, contact support, or use the TradeNet terminal and related services.`,
  },
  {
    title: '2. Information We Collect',
    body: `We may collect account and contact information such as your email address, authentication identifiers, account status, waitlist status, support messages, and preferences.

When you purchase a subscription, Stripe processes your payment information. TradeNet receives billing identifiers, subscription status, plan information, payment status, and limited transaction details. We do not receive or store your full payment-card number.

We may also collect technical and usage information such as device type, operating system, application version, IP-derived security information, authentication events, error reports, feature usage, and website performance data.`,
  },
  {
    title: '3. How We Use Information',
    body: `We use information to create and secure accounts, operate the website and terminal, manage waitlist and subscription eligibility, process billing, provide customer support, prevent fraud and abuse, diagnose reliability problems, improve the Services, communicate service or launch updates, and comply with legal obligations.`,
  },
  {
    title: '4. Service Providers',
    body: `We use service providers for hosting, authentication, database services, payment processing, email delivery, analytics, security, and infrastructure operations. These providers process information on our behalf under their own contractual and security obligations. Our primary service providers include Supabase for authentication and database services, Stripe for payments and billing, Vercel for website hosting and performance analytics, and our configured email-delivery provider.`,
  },
  {
    title: '5. When We Share Information',
    body: `We do not sell personal information. We may share information with service providers as needed to operate the Services, with professional advisors, when required by law or a valid legal process, to investigate fraud or security threats, to protect TradeNet or its users, or as part of a merger, financing, acquisition, or sale of assets.`,
  },
  {
    title: '6. Data Retention',
    body: `We retain information for as long as reasonably necessary to provide the Services, maintain security and billing records, resolve disputes, enforce agreements, and meet legal obligations. Retention periods vary by data type. Billing-event and security records may be retained after account closure when necessary for fraud prevention, accounting, or legal compliance.`,
  },
  {
    title: '7. Security',
    body: `We use technical and organizational safeguards intended to protect information, including authenticated access, server-side authorization, restricted administrative controls, encryption in transit, and access logging. No system can guarantee absolute security, and you are responsible for protecting your account credentials and multi-factor authentication methods.`,
  },
  {
    title: '8. Your Choices and Rights',
    body: `You may update certain account information through TradeNet or the Stripe customer portal. You may unsubscribe from nonessential marketing email using the link included in those messages. Depending on your location, you may have rights to request access, correction, deletion, or restriction of certain personal information. We may need to verify your identity before completing a request.`,
  },
  {
    title: '9. Cookies and Local Storage',
    body: `TradeNet and its service providers may use cookies, local storage, and similar technologies for authentication, security, preferences, website operation, and performance measurement. Blocking these technologies may prevent account or terminal features from working correctly.`,
  },
  {
    title: '10. Children',
    body: `TradeNet is not intended for anyone under 18 years of age. We do not knowingly collect personal information from children. Contact us if you believe a child has provided information to TradeNet.`,
  },
  {
    title: '11. International Processing',
    body: `TradeNet and its service providers may process information in the United States and other countries. Those locations may have data-protection laws that differ from the laws where you live.`,
  },
  {
    title: '12. Changes to This Policy',
    body: `We may update this Privacy Policy as the Services or legal requirements change. We will post the updated policy on this page and revise the date below. Material changes may also be communicated through the website, terminal, or email.`,
  },
  {
    title: '13. Contact',
    body: `Questions or privacy requests may be sent to support@tradenet.org.`,
  },
]

export default function PrivacyPolicyPage() {
  return (
    <>
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="section-container flex items-center justify-between h-14">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[#71717A] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <img src="/assets/text-logo.png" alt="TradeNet" className="h-6 w-auto" />
          <div className="w-24" />
        </div>
      </header>

      <main className="bg-black min-h-screen py-16">
        <div className="section-container max-w-3xl">
          <div className="mb-10">
            <h1 className="text-[clamp(28px,4vw,44px)] font-black text-[#FAFAFA] mb-3">
              Privacy Policy
            </h1>
            <p className="text-sm text-[#71717A]">Last updated: July 28, 2026</p>
          </div>

          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.title} className="space-y-3">
                <h2 className="text-[16px] font-bold text-[#FAFAFA]">
                  {section.title}
                </h2>
                {section.body.split('\n\n').map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[14px] text-[#A1A1AA] leading-[1.8]"
                  >
                    {paragraph}
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
