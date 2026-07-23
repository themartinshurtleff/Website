import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Gauge,
  Github,
  Layers,
  Linkedin,
  Mail,
  Users,
} from 'lucide-react'
import '@/styles/about-page.css'

const reveal = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] },
  }),
}

const founders = [
  {
    number: '01',
    initials: 'MS',
    name: 'Martin Shurtleff',
    role: 'Co-founder, CEO & Lead Developer',
    accent: 'gold',
    bio: 'Martin leads the engineering behind TradeNet. He works across the desktop terminal, market-data behavior, access systems, and launch reliability, turning trading problems into software and staying close to the details until the result is actually usable.',
    focus: [
      'Terminal architecture and engineering',
      'Market data and access systems',
      'Product direction and launch reliability',
    ],
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/martinshurtleff/', icon: Linkedin },
      { label: 'Email', href: 'mailto:martin@tradenet.org', icon: Mail },
    ],
  },
  {
    number: '02',
    initials: 'SB',
    name: 'Constantine "Steen" Beseris',
    role: 'Co-founder, COO & Product Lead',
    accent: 'teal',
    bio: 'Steen has shaped TradeNet from the first feature interviews onward. He reviews implementations, stress tests workflows, co-designs the interface, and keeps the product honest about what traders can actually use when the market is moving.',
    focus: [
      'Trader workflows and feature review',
      'Interface design and product testing',
      'Market research and beta feedback',
    ],
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/constantine-beseris-b624a0291/', icon: Linkedin },
      { label: 'GitHub', href: 'https://github.com/Steen0x', icon: Github },
      { label: 'Email', href: 'mailto:constantine@tradenet.org', icon: Mail },
    ],
  },
]

const buildPhases = [
  {
    number: '01',
    label: 'The beginning',
    title: 'Ask traders what they would actually keep open.',
    body: 'We started with interviews, rough layouts, and blunt conversations about what existing platforms got wrong. The useful answers were specific, so the product stayed specific.',
  },
  {
    number: '02',
    label: 'The rebuild',
    title: 'Turn the workflow into a real desktop terminal.',
    body: 'TradeNet grew into a native Tauri application with multi-pane workspaces, server-backed market data, custom indicators, backtesting, and paper-first execution.',
  },
  {
    number: '03',
    label: 'Right now',
    title: 'Prove it under real use before opening the doors.',
    body: 'The current work is controlled beta testing, stress testing, and reliability. Access is opening in stages because the terminal needs to hold up on a trader\'s desk, not only in a demo.',
  },
]

const principles = [
  {
    icon: Users,
    title: 'Built with traders in the room',
    body: 'Feature decisions start with the workflow. We care about what stays visible, what takes too many clicks, and what becomes useless once the market speeds up.',
  },
  {
    icon: Layers,
    title: 'One connected workspace',
    body: 'Heatmaps, Footprint, DOM, Tape, OI, CVD, scripting, testing, and execution belong in the same market context instead of scattered across subscriptions.',
  },
  {
    icon: Gauge,
    title: 'Data should stay honest',
    body: 'Source labels, explicit loading states, and exact calculations matter. We do not want approximations presented as certainty or a polished screen hiding missing data.',
  },
]

function FounderProfile({ founder, index }) {
  return (
    <motion.article
      className={`about-founder about-founder-${founder.accent}`}
      variants={reveal}
      custom={index * 0.08}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
    >
      <div className="about-founder-topline">
        <span>{founder.number}</span>
        <span>TradeNet founder</span>
      </div>

      <div className="about-founder-identity">
        <div className="about-founder-monogram" aria-hidden="true">{founder.initials}</div>
        <div>
          <h3>{founder.name}</h3>
          <p>{founder.role}</p>
        </div>
      </div>

      <p className="about-founder-bio">{founder.bio}</p>

      <ul className="about-founder-focus">
        {founder.focus.map((item) => <li key={item}>{item}</li>)}
      </ul>

      <div className="about-founder-links">
        {founder.links.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            <Icon size={14} />
            {label}
          </a>
        ))}
      </div>
    </motion.article>
  )
}

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <img
          src="/hero.png"
          alt="TradeNet Terminal running a multi-pane orderflow workspace"
          className="about-hero-media"
        />
        <div className="about-hero-overlay" />

        <div className="about-shell about-hero-content">
          <motion.p className="about-kicker" variants={reveal} custom={0.06} initial="hidden" animate="visible">
            About TradeNet
          </motion.p>
          <motion.h1 id="about-title" variants={reveal} custom={0.12} initial="hidden" animate="visible">
            <span>TradeNet.</span>
            Built by two traders who needed better tools.
          </motion.h1>
          <motion.p className="about-hero-copy" variants={reveal} custom={0.2} initial="hidden" animate="visible">
            We are building the crypto orderflow terminal we wanted on our own desks. One place for market structure, research, testing, and execution, without losing the context of the trade.
          </motion.p>
          <motion.dl className="about-hero-facts" variants={reveal} custom={0.28} initial="hidden" animate="visible">
            <div>
              <dt>Founders</dt>
              <dd>Martin + Steen</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>Native desktop terminal</dd>
            </div>
            <div>
              <dt>Current stage</dt>
              <dd>Controlled beta</dd>
            </div>
          </motion.dl>
        </div>
      </section>

      <section className="about-origin">
        <div className="about-shell about-origin-grid">
          <motion.div
            className="about-section-heading"
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <p className="about-kicker">How it started</p>
            <h2>It began with a list of things traders actually wanted.</h2>
          </motion.div>

          <motion.div
            className="about-origin-copy"
            variants={reveal}
            custom={0.08}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <p>
              Before there was a terminal, we asked friends and other traders what they wished they could keep in one workspace. Better heatmaps. A Footprint they could trust. DOM and Tape without jumping between apps. Layouts that came back exactly where they left them.
            </p>
            <p>
              That list kept growing. OI, CVD, volume profiles, scripting, backtesting, and eventually execution all became part of the same problem. TradeNet grew out of solving that problem one piece at a time.
            </p>
            <p className="about-origin-emphasis">
              The terminal has been rebuilt, broken, stress tested, and rebuilt again. That is the work. The goal is still simple: ship the tool we wanted ourselves and make it dependable enough to put on someone else&apos;s desk.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="about-founders">
        <div className="about-shell">
          <div className="about-founders-heading">
            <div>
              <p className="about-kicker">The founders</p>
              <h2>Two sides of the same product.</h2>
            </div>
            <p>
              Engineering and trading stay in the same conversation. That has been the operating model from the first interview through the current beta build.
            </p>
          </div>

          <div className="about-founder-grid">
            {founders.map((founder, index) => (
              <FounderProfile key={founder.name} founder={founder} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="about-build">
        <div className="about-shell">
          <div className="about-build-heading">
            <p className="about-kicker">The build</p>
            <h2>From conversations to a terminal people can test.</h2>
          </div>

          <div className="about-build-phases">
            {buildPhases.map((phase, index) => (
              <motion.article
                key={phase.number}
                variants={reveal}
                custom={index * 0.08}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
              >
                <div className="about-phase-number">{phase.number}</div>
                <p className="about-phase-label">{phase.label}</p>
                <h3>{phase.title}</h3>
                <p className="about-phase-copy">{phase.body}</p>
              </motion.article>
            ))}
          </div>

          <motion.figure
            className="about-product-figure"
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <img src="/tradinghero.png" alt="TradeNet terminal charting and paper execution workspace" loading="lazy" />
            <figcaption>
              <span>Current terminal build</span>
              <span>Orderflow / research / paper-first execution</span>
            </figcaption>
          </motion.figure>
        </div>
      </section>

      <section className="about-principles">
        <div className="about-shell about-principles-grid">
          <div className="about-principles-heading">
            <p className="about-kicker">What stays true</p>
            <h2>The product has changed a lot. These parts have not.</h2>
          </div>

          <div className="about-principle-list">
            {principles.map(({ icon: Icon, title, body }, index) => (
              <motion.article
                key={title}
                variants={reveal}
                custom={index * 0.06}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
              >
                <Icon size={19} />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="about-shell about-cta-inner">
          <div>
            <p className="about-kicker">Launching in stages</p>
            <h2>TradeNet is getting close.</h2>
            <p>Accounts and the beta waitlist are open while we finish proving the current build.</p>
          </div>
          <div className="about-cta-actions">
            <Link to="/terminal" className="about-primary-action">
              Join the beta waitlist
              <ArrowRight size={16} />
            </Link>
            <a href="mailto:contact@tradenet.org" className="about-secondary-action">
              Contact the founders
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
