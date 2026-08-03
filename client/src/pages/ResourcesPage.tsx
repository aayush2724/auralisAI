import { motion } from 'framer-motion';
import { FileText, PlayCircle, BookOpen, ArrowRight } from 'lucide-react';
import PublicShell from '../components/layout/PublicShell';
import Footer from '../components/layout/Footer';

const resources = [
  {
    title: 'The AI-Powered Sales Playbook',
    type: 'Guide',
    icon: <BookOpen size={20} />,
    description: 'Learn how top teams are using Auralis to classify objections and close deals faster.',
    color: '#dd6668'
  },
  {
    title: 'Handling Price Objections in 2026',
    type: 'Article',
    icon: <FileText size={20} />,
    description: 'A deep dive into the psychology of price objections and how AI can help navigate them.',
    color: '#10b981'
  },
  {
    title: 'Auralis Product Tour',
    type: 'Video',
    icon: <PlayCircle size={20} />,
    description: 'A 5-minute walkthrough of the Auralis platform, from setup to first AI conversation.',
    color: '#8b5cf6'
  },
  {
    title: 'Buyer Persona Cheatsheet',
    type: 'Download',
    icon: <FileText size={20} />,
    description: 'Quick reference guide for identifying and adapting to the 4 main buyer personas.',
    color: '#f59e0b'
  },
  {
    title: 'Setting up Smart Handoffs',
    type: 'Tutorial',
    icon: <PlayCircle size={20} />,
    description: 'Configure routing rules to bring human reps into the loop at exactly the right moment.',
    color: '#8b5cf6'
  },
  {
    title: 'State of Sales AI Report',
    type: 'Report',
    icon: <BookOpen size={20} />,
    description: 'Data from over 1M sales conversations on what separates top performers from the rest.',
    color: '#dd6668'
  }
];

export default function ResourcesPage() {

  return (
    <PublicShell>
      {/* HERO */}
      <section className="pt-36 pb-20 px-6 text-center border-b border-theme-border">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="section-label mb-4 block">
            Resources
          </span>
          <h1 className="text-5xl font-semibold tracking-tight text-theme-primary md:text-6xl leading-tight mb-6">
            Level up your sales game.
          </h1>
          <p className="body-text text-lg max-w-xl mx-auto">
            Guides, research, and best practices for modern sales teams using AI.
          </p>
        </motion.div>
      </section>

      {/* GRID */}
      <section className="px-6 py-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {resources.map((resource, i) => (
            <motion.div
              key={resource.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group cursor-pointer rounded-[28px] p-8 border border-theme-border hover:border-[#4F46E5]/30 hover:shadow-[0_24px_70px_rgba(16,32,51,0.12)] transition-all duration-200 flex flex-col h-full glass-card"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="icon-badge icon-badge--secondary h-10 w-10">
                  {resource.icon}
                </div>
                <span className="text-sm font-medium text-theme-secondary">
                  {resource.type}
                </span>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-theme-primary mb-3 group-hover:text-[#4F46E5] transition-colors">
                {resource.title}
              </h3>
              <p className="body-text mb-8 flex-grow">
                {resource.description}
              </p>
              <div className="flex items-center gap-2 text-[#4F46E5] font-medium text-sm group-hover:gap-3 transition-all">
                Read more <ArrowRight size={16} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </PublicShell>
  );
}
