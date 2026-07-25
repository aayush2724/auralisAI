import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, PlayCircle, BookOpen, ArrowRight } from 'lucide-react';
import PageNavbar from '../components/layout/PageNavbar';

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
  const navigate = useNavigate();

  return (
    <div className="bg-white text-[#0a0a0a] antialiased min-h-screen font-sans">
      <PageNavbar />

      {/* HERO */}
      <section className="pt-36 pb-20 px-6 text-center border-b border-[#f3f4f6]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-sans font-semibold tracking-widest text-[#dd6668] uppercase mb-4 block">
            Resources
          </span>
          <h1 className="font-display text-5xl md:text-6xl text-[#0a0a0a] leading-tight mb-6">
            Level up your sales game.
          </h1>
          <p className="font-sans text-lg text-[#6b7280] max-w-xl mx-auto leading-relaxed">
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
              className="group cursor-pointer rounded-2xl p-8 border border-[#e5e7eb] hover:border-[#dd6668]/30 hover:shadow-lg transition-all duration-300 flex flex-col h-full bg-white"
            >
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center bg-opacity-10"
                  style={{ backgroundColor: `${resource.color}15`, color: resource.color }}
                >
                  {resource.icon}
                </div>
                <span className="text-sm font-sans font-medium text-[#6b7280]">
                  {resource.type}
                </span>
              </div>
              <h3 className="font-logo font-semibold text-xl mb-3 text-[#0a0a0a] group-hover:text-[#dd6668] transition-colors">
                {resource.title}
              </h3>
              <p className="text-sm font-sans text-[#6b7280] leading-relaxed mb-8 flex-grow">
                {resource.description}
              </p>
              <div className="flex items-center gap-2 text-[#dd6668] font-sans font-medium text-sm group-hover:gap-3 transition-all">
                Read more <ArrowRight size={16} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="w-full bg-[#0a0a0a] py-24 px-6 flex flex-col items-center justify-center text-center">
        <h2 className="font-display text-4xl md:text-5xl text-white leading-tight mb-6">
          Put these insights into practice.
        </h2>
        <button
          onClick={() => navigate('/?login=true')}
          className="bg-[#dd6668] text-white font-sans font-medium text-sm px-8 py-4 rounded-full hover:bg-[#c45557] transition-colors duration-300 mt-4"
        >
          Start your free trial
        </button>
      </section>

      {/* FOOTER */}
      <footer className="bg-white py-8 px-6 border-t border-[#f3f4f6]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <span className="text-[#0a0a0a] font-logo font-semibold text-xl">Auralis</span>
          <div className="flex gap-6">
            {['Product', 'Solutions', 'Pricing', 'Resources'].map((l) => (
              <button
                key={l}
                onClick={() => navigate(l === 'Pricing' ? '/pricing' : l === 'Resources' ? '/resources' : '/')}
                className="text-[#6b7280] text-sm font-sans hover:text-[#0a0a0a] transition-colors"
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
