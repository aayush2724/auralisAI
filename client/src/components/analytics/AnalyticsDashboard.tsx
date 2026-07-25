
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Brain, AlertCircle, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts';
import { useAnalyticsDashboard } from '../../api/hooks/useAnalytics';
import MetricCard from './MetricCard';
import Skeleton from '../ui/Skeleton';
import { Button } from '../ui/Button';

const OBJECTION_COLORS: Record<string, string> = {
  price: '#ef4444',
  trust: '#f97316',
  timing: '#eab308',
  competitor: '#22c55e',
  fit: '#3b82f6',
  buying_signal: '#a855f7',
  neutral: '#6b7280',
};

const PIE_COLORS = ['#0a0a0a', '#dd6668', '#5A635A', '#a3b1a3', '#d0d8d0'];
const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
];

export default function AnalyticsDashboard() {
  const [refreshMs, setRefreshMs] = useState(0);
  const { data, isPending, isError, isSuccess, isFetching, refetch } = useAnalyticsDashboard(refreshMs || false);

  const Header = () => (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-display font-normal text-[#0a0a0a] tracking-tight">Analytics</h2>
      <div className="flex items-center gap-2">
        <select
          value={refreshMs}
          onChange={(event) => setRefreshMs(Number(event.target.value))}
          className="h-10 rounded-xl border border-[#f9fafb] bg-white px-3 text-xs font-medium text-[#0a0a0a] outline-none focus:border-[#dd6668]"
          aria-label="Analytics auto refresh interval"
        >
          {REFRESH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>Auto {option.label}</option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );

  if (isPending) {
    return (
      <div className="px-6 py-8 overflow-y-auto h-full">
        <Header />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[130px]" />
          ))}
        </div>
        <Skeleton className="h-[320px] mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-6 py-8 overflow-y-auto h-full">
        <Header />
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load analytics data. Please make sure the backend is running.</span>
        </div>
      </div>
    );
  }

  const objectionData = Object.entries(data.objection_distribution).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    rawName: name,
    value,
  }));

  const personaData = Object.entries(data.persona_distribution).map(([name, value]) => ({
    name,
    value,
  }));
  const isEmpty = isSuccess && data.total_sessions === 0
    && objectionData.every((entry) => entry.value === 0)
    && personaData.every((entry) => entry.value === 0)
    && data.sentiment_trend.length === 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#f9fafb] rounded-lg p-3 shadow-md z-50 relative">
          {label && <p className="text-xs font-sans font-medium tracking-widest uppercase text-[#6b7280] mb-1">{label}</p>}
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm font-sans font-light text-[#0a0a0a]">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span>{entry.name}: {entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="px-6 py-8 overflow-y-auto h-full bg-[#FAFBF9]">
      <Header />

      <motion.div 
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
      >
        <MetricCard 
          label="Total Sessions" 
          value={data.total_sessions} 
          icon={Users} 
          color="[#dd6668]" 
        />
        <MetricCard 
          label="Conversion Rate" 
          value={(data.conversion_rate * 100).toFixed(1)} 
          suffix="%" 
          icon={TrendingUp} 
          color="green" 
        />
        <MetricCard 
          label="Avg Confidence" 
          value={(data.avg_confidence * 100).toFixed(1)} 
          suffix="%"
          icon={Brain} 
          color="purple" 
        />
      </motion.div>

      {isEmpty && (
        <div className="mb-6 rounded-2xl border border-[#f9fafb] bg-white p-8 text-center shadow-sm">
          <Brain className="mx-auto mb-3 h-8 w-8 text-[#6b7280]" />
          <h3 className="font-display text-lg text-[#0a0a0a]">No analytics events yet</h3>
          <p className="mt-1 text-sm font-light text-[#6b7280]">Conversation telemetry will appear here after live chat sessions are recorded.</p>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white border border-[#f9fafb] rounded-2xl p-6 mb-6 shadow-sm"
      >
        <h3 className="text-lg font-display font-normal text-[#0a0a0a] mb-4">Objection Distribution</h3>
        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={objectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5A635A', fontFamily: 'DM Sans' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#5A635A', fontFamily: 'DM Sans' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F3F1' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={600} isAnimationActive={true}>
                {objectionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={OBJECTION_COLORS[entry.rawName] || OBJECTION_COLORS['neutral']} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white border border-[#f9fafb] rounded-2xl p-6 shadow-sm"
        >
          <h3 className="text-lg font-display font-normal text-[#0a0a0a] mb-4">Persona Distribution</h3>
          <div className="w-full h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={personaData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  animationBegin={200}
                  animationDuration={1000}
                >
                  {personaData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#5A635A', fontFamily: 'DM Sans' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white border border-[#f9fafb] rounded-2xl p-6 shadow-sm"
        >
          <h3 className="text-lg font-display font-normal text-[#0a0a0a] mb-4">Sentiment Trend</h3>
          <div className="w-full h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sentiment_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F1" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: '#5A635A', fontFamily: 'DM Sans' }} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth()+1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 10, fill: '#5A635A', fontFamily: 'DM Sans' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="positive" name="Positive" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={1000} />
                <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={1000} />
                <Line type="monotone" dataKey="negative" name="Negative" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={1000} />
                <Legend verticalAlign="bottom" height={20} iconType="rect" wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontFamily: 'DM Sans' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
