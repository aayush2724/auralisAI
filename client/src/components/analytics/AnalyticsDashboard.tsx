import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Brain, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts';
import { useAnalyticsDashboard } from '../../api/hooks/useAnalytics';
import MetricCard from '../ui/MetricCard';
import ChartCard from '../ui/ChartCard';
import EmptyState from '../ui/EmptyState';
import SectionHeader from '../ui/SectionHeader';
import Dropdown from '../ui/Dropdown';
import SecondaryButton from '../ui/SecondaryButton';

const PIE_COLORS = ['#c7d2fe', '#bae6fd', '#a7f3d0', '#fde68a', '#fbcfe8'];
const BAR_COLORS = ['#c7d2fe', '#bae6fd', '#a7f3d0', '#fde68a', '#fbcfe8', '#ddd6fe'];
const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
];

export default function AnalyticsDashboard() {
  const [refreshMs, setRefreshMs] = useState(0);
  const { data, isPending, isError, isSuccess, isFetching, refetch } = useAnalyticsDashboard(refreshMs || false);

  const objectionData = data ? Object.entries(data.objection_distribution).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    rawName: name,
    value,
  })) : [];

  const personaData = data ? Object.entries(data.persona_distribution).map(([name, value]) => ({
    name,
    value,
  })) : [];

  const isEmpty = !!data && isSuccess && data.total_sessions === 0
    && objectionData.every((entry) => entry.value === 0)
    && personaData.every((entry) => entry.value === 0)
    && data.sentiment_trend.length === 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card rounded-[18px] p-3 shadow-[0_14px_40px_rgba(16,32,51,0.12)]">
          {label && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-muted">{label}</p>}
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm text-theme-primary">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span>{entry.name}: {entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const Header = () => (
    <SectionHeader
      eyebrow="Analytics"
      title="Performance intelligence"
      description="Real-time conversation telemetry with floating metric cards and soft-glow charts."
      action={(
        <div className="flex items-center gap-2">
          <Dropdown
            value={refreshMs}
            onChange={(event) => setRefreshMs(Number(event.target.value))}
            aria-label="Analytics auto refresh interval"
          >
            {REFRESH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>Auto {option.label}</option>
            ))}
          </Dropdown>
          <SecondaryButton
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-full px-4 py-3"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </SecondaryButton>
        </div>
      )}
    />
  );

  if (isPending) {
    return (
      <div className="h-full overflow-y-auto px-4 py-6">
        <Header />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-[144px] animate-pulse rounded-[28px]" />
          ))}
        </div>
        <div className="glass-card mb-4 h-[360px] rounded-[32px] animate-pulse" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card h-[340px] rounded-[32px] animate-pulse" />
          <div className="glass-card h-[340px] rounded-[32px] animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full overflow-y-auto px-4 py-6">
        <Header />
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-3 py-3 text-red-700 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load analytics data. Please make sure the backend is running.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6 bg-transparent">
      <Header />

      <motion.div
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        animate="show"
        className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <MetricCard
          label="Total Sessions"
          value={data.total_sessions}
          icon={Users}
          tone="indigo"
          size="large"
        />
        <MetricCard
          label="Conversion Rate"
          value={(data.conversion_rate * 100).toFixed(1)}
          suffix="%"
          icon={TrendingUp}
          tone="teal"
          size="large"
        />
        <MetricCard
          label="Avg Confidence"
          value={(data.avg_confidence * 100).toFixed(1)}
          suffix="%"
          icon={Brain}
          tone="amber"
          size="large"
        />
      </motion.div>

      {isEmpty && (
        <div className="mb-4">
          <EmptyState
            title="No analytics events yet"
            description="Conversation telemetry will appear here after live chat sessions are recorded."
            action={(
              <div className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-white/60 px-4 py-2 text-sm font-medium text-theme-primary shadow-sm">
                <Sparkles className="h-4 w-4 text-[#4F46E5]" />
                Premium metrics will surface here automatically
              </div>
            )}
          />
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4">
        <ChartCard
          title="Objection Distribution"
          subtitle="Pastel bar chart with rounded columns and minimal grid."
          size="large"
        >
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={objectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {BAR_COLORS.map((color, index) => (
                    <linearGradient id={`bar-gradient-${index}`} key={color} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.45} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="rgba(16,32,51,0.06)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7b8796', fontWeight: 600 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#7b8796', fontWeight: 600 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,70,229,0.04)' }} />
                <Bar dataKey="value" radius={[18, 18, 10, 10]} animationDuration={600} isAnimationActive>
                  {objectionData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#bar-gradient-${index % BAR_COLORS.length})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-12 lg:grid-cols-2">
        <ChartCard title="Persona Distribution" subtitle="Soft-glow donut with pastel palette." size="large">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {PIE_COLORS.map((color, index) => (
                    <linearGradient id={`pie-gradient-${index}`} key={color} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={personaData}
                  cx="50%"
                  cy="45%"
                  innerRadius={66}
                  outerRadius={96}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={200}
                  animationDuration={1000}
                >
                  {personaData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#pie-gradient-${index % PIE_COLORS.length})`} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: '#7b8796', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Sentiment Trend" subtitle="Rounded lines with restrained grid styling." size="large">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sentiment_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <filter id="line-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(16,32,51,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#7b8796', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 10, fill: '#7b8796', fontWeight: 600 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="positive" name="Positive" stroke="#a7f3d0" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} animationDuration={1000} filter="url(#line-glow)" />
                <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#fde68a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} animationDuration={1000} filter="url(#line-glow)" />
                <Line type="monotone" dataKey="negative" name="Negative" stroke="#fbcfe8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} animationDuration={1000} filter="url(#line-glow)" />
                <Legend
                  verticalAlign="bottom"
                  height={20}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 600, color: '#7b8796' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
