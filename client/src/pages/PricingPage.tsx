import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Zap, Building2, ChevronDown } from 'lucide-react';
import PublicShell from '../components/layout/PublicShell';
import { Button } from '../components/ui/Button';
import Footer from '../components/layout/Footer';

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
    <div className="border-b border-theme-border/70">
      <button
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-base font-medium text-theme-primary">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-theme-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-sm leading-relaxed text-theme-secondary">{a}</p>
      </motion.div>
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <PublicShell>
      {/* HERO */}
      <section className="pt-36 pb-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="section-label mb-4 block">
            Pricing
          </span>
          <h1 className="text-5xl font-semibold tracking-tight text-theme-primary md:text-6xl leading-tight mb-6">
            Simple, transparent pricing.
          </h1>
          <p className="body-text text-lg max-w-xl mx-auto">
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
              className={`rounded-[28px] p-8 flex flex-col border transition-all duration-200 ${
                plan.highlighted
                  ? 'bg-theme-primary border-theme-primary shadow-[0_24px_70px_rgba(16,32,51,0.18)] scale-[1.02]'
                  : 'glass-card border-theme-border'
              }`}
            >
              {plan.highlighted && (
                <div className="mb-4">
                  <span className="section-label text-[#4f46e5]">
                    Most Popular
                  </span>
                </div>
              )}
              <div className={`icon-badge mb-5 ${plan.highlighted ? 'icon-badge--primary' : 'icon-badge--secondary'}`}>
                {plan.icon}
              </div>
              <h2 className={`text-2xl font-semibold tracking-tight mb-1 ${plan.highlighted ? 'text-white' : 'text-theme-primary'}`}>
                {plan.name}
              </h2>
              <p className={`text-sm mb-6 leading-relaxed ${plan.highlighted ? 'text-white/65' : 'text-theme-secondary'}`}>
                {plan.description}
              </p>
              <div className="mb-8">
                <span className={`text-5xl font-semibold tracking-tight ${plan.highlighted ? 'text-white' : 'text-theme-primary'}`}>
                  {plan.price}
                </span>
                {plan.period && (
          <span className={`text-sm ml-1 ${plan.highlighted ? 'text-white/65' : 'text-theme-secondary'}`}>
                    {plan.period}
                  </span>
                )}
              </div>
              <Button
                onClick={() => navigate('/?login=true')}
                variant={plan.highlighted ? 'primary' : 'secondary'}
                className="w-full py-3.5 rounded-full text-sm mb-8"
              >
                {plan.cta}
              </Button>
              <ul className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check size={15} className={`mt-0.5 shrink-0 ${plan.highlighted ? 'text-white' : 'text-[#0d9488]'}`} />
                    <span className={plan.highlighted ? 'text-white/75' : 'text-theme-secondary'}>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white/40 px-6 py-24 border-t border-theme-border">
        <div className="max-w-3xl mx-auto">
          <span className="section-label mb-4 block">
            FAQ
          </span>
          <h2 className="text-4xl font-semibold tracking-tight text-theme-primary mb-12">
            Questions we hear a lot.
          </h2>
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      <Footer />
    </PublicShell>
  );
}
