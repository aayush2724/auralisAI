import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Zap, Building2, ChevronDown } from 'lucide-react';
import PageNavbar from '../components/layout/PageNavbar';

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'Perfect for small teams getting started with AI-assisted sales.',
    icon: <Zap size={20} />,
    accent: '#6b7280',
    features: [
      '100 AI conversations / month',
      'Objection classification',
      'Buyer persona detection',
      '2 team seats',
      'Email support',
      '7-day conversation history',
    ],
    cta: 'Get started free',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$49',
    period: '/ seat / mo',
    description: 'For growing sales teams that need real-time intelligence at scale.',
    icon: <Zap size={20} />,
    accent: '#dd6668',
    features: [
      'Unlimited AI conversations',
      'Objection classification',
      'Buyer persona detection',
      'Smart human handoff',
      'Real-time response (<2s)',
      'Analytics dashboard',
      'Knowledge base upload',
      'Unlimited team seats',
      'Priority support',
      '90-day history',
    ],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large orgs with custom compliance, security, and integration needs.',
    icon: <Building2 size={20} />,
    accent: '#0a0a0a',
    features: [
      'Everything in Growth',
      'SSO / SAML',
      'Custom model fine-tuning',
      'Dedicated infrastructure',
      'SLA guarantee (99.9%)',
      'Custom integrations (CRM/Slack)',
      'Audit logs',
      'Dedicated success manager',
      'On-prem deployment option',
    ],
    cta: 'Talk to sales',
    highlighted: false,
  },
];

const faqs = [
  {
    q: 'Is there a free trial on paid plans?',
    a: 'Yes — all Growth plans come with a 14-day free trial, no credit card required. You can start using every feature immediately.',
  },
  {
    q: 'How does per-seat pricing work?',
    a: 'A seat is any individual user who logs in to Auralis. You only pay for the seats you use, and you can add or remove seats any time from your settings.',
  },
  {
    q: 'Can I upgrade or downgrade anytime?',
    a: 'Absolutely. You can switch plans at any time. Upgrades are effective immediately; downgrades take effect at the end of your billing cycle.',
  },
  {
    q: 'What counts as an AI conversation?',
    a: 'An AI conversation is a single continuous chat session with a prospect. Multiple messages within the same session count as one conversation.',
  },
  {
    q: 'Do you offer discounts for annual billing?',
    a: 'Yes — pay annually and get 2 months free (equivalent to ~17% off the monthly rate).',
  },
  {
    q: 'Is my data kept private?',
    a: 'Your data is never used to train shared models. All conversation data is encrypted at rest and in transit, and you own it fully.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#f3f4f6]">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        onClick={() => setOpen(!open)}
      >
        <span className="font-sans font-medium text-[#0a0a0a] text-base">{q}</span>
        <ChevronDown
          size={18}
          className={`text-[#6b7280] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <p className="pb-5 font-sans text-[#6b7280] text-sm leading-relaxed">{a}</p>
      </motion.div>
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-white text-[#0a0a0a] antialiased min-h-screen font-sans">
      <PageNavbar />

      {/* HERO */}
      <section className="pt-36 pb-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-sans font-semibold tracking-widest text-[#dd6668] uppercase mb-4 block">
            Pricing
          </span>
          <h1 className="font-display text-5xl md:text-6xl text-[#0a0a0a] leading-tight mb-6">
            Simple, transparent pricing.
          </h1>
          <p className="font-sans text-lg text-[#6b7280] max-w-xl mx-auto leading-relaxed">
            No hidden fees. No usage surprises. Start free and scale when your team is ready.
          </p>
        </motion.div>
      </section>

      {/* PLANS */}
      <section className="px-6 pb-28">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={`rounded-2xl p-8 flex flex-col border ${
                plan.highlighted
                  ? 'bg-[#0a0a0a] border-[#0a0a0a] shadow-2xl scale-[1.03]'
                  : 'bg-white border-[#e5e7eb]'
              }`}
            >
              {plan.highlighted && (
                <div className="mb-4">
                  <span className="text-xs font-sans font-semibold tracking-widest uppercase text-[#dd6668]">
                    Most Popular
                  </span>
                </div>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-5 ${plan.highlighted ? 'bg-[#dd6668]/20 text-[#dd6668]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                {plan.icon}
              </div>
              <h2 className={`font-logo font-semibold text-2xl mb-1 ${plan.highlighted ? 'text-white' : 'text-[#0a0a0a]'}`}>
                {plan.name}
              </h2>
              <p className={`text-sm font-sans mb-6 leading-relaxed ${plan.highlighted ? 'text-white/50' : 'text-[#6b7280]'}`}>
                {plan.description}
              </p>
              <div className="mb-8">
                <span className={`font-display text-5xl ${plan.highlighted ? 'text-white' : 'text-[#0a0a0a]'}`}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span className={`text-sm font-sans ml-1 ${plan.highlighted ? 'text-white/50' : 'text-[#6b7280]'}`}>
                    {plan.period}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/?login=true')}
                className={`w-full py-3.5 rounded-full font-sans font-medium text-sm mb-8 transition-colors duration-200 ${
                  plan.highlighted
                    ? 'bg-[#dd6668] text-white hover:bg-[#c45557]'
                    : 'bg-[#f3f4f6] text-[#0a0a0a] hover:bg-[#e5e7eb]'
                }`}
              >
                {plan.cta}
              </button>
              <ul className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm font-sans">
                    <Check size={15} className={`mt-0.5 shrink-0 ${plan.highlighted ? 'text-[#dd6668]' : 'text-[#10b981]'}`} />
                    <span className={plan.highlighted ? 'text-white/70' : 'text-[#4b5563]'}>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#fafafa] px-6 py-24 border-t border-[#f3f4f6]">
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-sans font-semibold tracking-widest uppercase text-[#dd6668] mb-4 block">
            FAQ
          </span>
          <h2 className="font-display text-4xl text-[#0a0a0a] mb-12">
            Questions we hear a lot.
          </h2>
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <section className="w-full bg-[#dd6668] py-24 px-6 flex flex-col items-center justify-center text-center">
        <h2 className="font-display text-4xl md:text-5xl text-white leading-tight mb-6">
          Ready to close more deals?
        </h2>
        <p className="font-sans text-white/70 text-lg max-w-xl mx-auto mb-10">
          Join sales teams already using Auralis to handle objections, read the room, and never miss a close.
        </p>
        <button
          onClick={() => navigate('/?login=true')}
          className="bg-white text-[#dd6668] font-sans font-medium text-sm px-8 py-4 rounded-full hover:bg-[#0a0a0a] hover:text-white transition-colors duration-300"
        >
          Try it now
        </button>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0a0a0a] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <span className="text-white font-logo font-semibold text-xl">Auralis</span>
          <div className="flex gap-6">
            {['Product', 'Solutions', 'Pricing', 'Resources'].map((l) => (
              <button
                key={l}
                onClick={() => navigate(l === 'Pricing' ? '/pricing' : l === 'Resources' ? '/resources' : '/')}
                className="text-[#6b7280] text-sm font-sans hover:text-white transition-colors"
              >
                {l}
              </button>
            ))}
          </div>
          <span className="text-[#6b7280] text-xs font-sans">© 2026 Auralis. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
