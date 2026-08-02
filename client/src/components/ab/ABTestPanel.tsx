
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, AlertCircle, ArrowUpRight, RefreshCw, FlaskConical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { useABTestResults } from '../../api/hooks/useABTest';
import { useCountUp } from '../../hooks/useCountUp';
import Skeleton from '../ui/Skeleton';
import { Button } from '../ui/Button';

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
];

export default function ABTestPanel() {
  const [refreshMs, setRefreshMs] = useState(0);
  const { data, isPending, isError, isSuccess, isFetching, refetch } = useABTestResults(refreshMs || false);

  const staticConversionRate = data?.static_conversion_rate ?? 0;
  const adaptiveConversionRate = data?.adaptive_conversion_rate ?? 0;
  const staticSessionCount = data?.sessions_per_variant.STATIC ?? 0;
  const adaptiveSessionCount = data?.sessions_per_variant.ADAPTIVE ?? 0;
  const staticAvgConfidence = data?.static_avg_confidence ?? 0;
  const adaptiveAvgConfidence = data?.adaptive_avg_confidence ?? 0;
  const improvementTarget = staticConversionRate > 0 
    ? (((adaptiveConversionRate - staticConversionRate) / staticConversionRate) * 100)
    : 0;

  const staticRate = useCountUp(staticConversionRate * 100, 1200, true);
  const adaptiveRate = useCountUp(adaptiveConversionRate * 100, 1200, true);
  const staticSessions = useCountUp(staticSessionCount, 1200, true);
  const adaptiveSessions = useCountUp(adaptiveSessionCount, 1200, true);
  const staticConf = useCountUp(staticAvgConfidence * 100, 1200, true);
  const adaptiveConf = useCountUp(adaptiveAvgConfidence * 100, 1200, true);
  const improvement = useCountUp(improvementTarget, 1200, true);

  const Header = () => (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-display font-normal text-theme-primary tracking-tight">A/B Test Results</h2>
      <div className="flex items-center gap-2">
        <select
          value={refreshMs}
          onChange={(event) => setRefreshMs(Number(event.target.value))}
          className="h-10 rounded-xl border border-theme-border bg-theme-surface-solid px-3 text-xs font-medium text-theme-primary outline-none focus:border-[#dd6668]"
          aria-label="A/B test auto refresh interval"
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
        <div className="grid grid-cols-2 gap-6 mb-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-6 py-8 overflow-y-auto h-full">
        <Header />
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span>Failed to load A/B test data.</span>
        </div>
      </div>
    );
  }

  const adaptiveWins = adaptiveConversionRate > staticConversionRate;
  const totalSessions = staticSessionCount + adaptiveSessionCount;
  const isEmpty = isSuccess && totalSessions === 0;

  const chartData = [
    {
      name: 'Conversion Rate',
      STATIC: parseFloat((staticConversionRate * 100).toFixed(1)),
      ADAPTIVE: parseFloat((adaptiveConversionRate * 100).toFixed(1)),
    }
  ];

  const gridVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-theme-surface-solid border border-theme-border rounded-lg p-3 shadow-lg z-50 relative">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm font-sans font-light text-theme-primary">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span>{entry.name}: {entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="px-6 py-8 overflow-y-auto h-full bg-transparent">
      <Header />

      {isEmpty && (
        <div className="mb-6 rounded-2xl border border-theme-border bg-theme-surface p-8 text-center shadow-lg">
          <FlaskConical className="mx-auto mb-3 h-8 w-8 text-theme-muted" />
          <h3 className="font-display text-lg text-theme-primary">No A/B test sessions yet</h3>
          <p className="mt-1 text-sm font-light text-theme-muted">STATIC and ADAPTIVE performance will populate after conversations are logged.</p>
        </div>
      )}

      {/* Hero Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* STATIC Card */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(221,102,104,0.12)" }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`bg-theme-surface border-2 rounded-2xl p-6 relative ${!adaptiveWins && totalSessions > 0 ? 'border-[#dd6668]' : 'border-theme-border'}`}
          >
            {!adaptiveWins && totalSessions > 0 && <Crown className="absolute top-6 right-6 w-6 h-6 text-[#dd6668]" />}
            <div className="text-xs font-sans font-medium tracking-widest uppercase text-theme-muted mb-2">STATIC</div>
            <div className="flex items-start text-theme-primary mb-6">
              <span className="text-6xl font-display font-normal tracking-tight">{staticRate.toFixed(1)}</span>
              <span className="text-2xl font-sans font-light text-theme-muted mt-1">%</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-theme-border pt-4">
              <div>
                <div className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mb-1">Sessions</div>
                <div className="text-lg font-display font-normal text-theme-primary">{Math.round(staticSessions)}</div>
              </div>
              <div>
                <div className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mb-1">Avg Confidence</div>
                <div className="text-lg font-display font-normal text-theme-primary">{staticConf.toFixed(0)}%</div>
              </div>
            </div>
          </motion.div>

          {/* ADAPTIVE Card */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(221,102,104,0.15)" }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`bg-theme-surface border-2 rounded-2xl p-6 relative ${adaptiveWins ? 'border-[#dd6668] bg-[rgba(221,102,104,0.02)] shadow-[0_12px_40px_rgba(221,102,104,0.15)]' : 'border-theme-border'}`}
          >
            {adaptiveWins && <Crown className="absolute top-6 right-6 w-6 h-6 text-[#dd6668]" />}
            <div className="text-xs font-sans font-medium tracking-widest uppercase text-theme-muted mb-2">ADAPTIVE</div>
            <div className="flex items-start text-theme-primary mb-6">
              <span className="text-6xl font-display font-normal tracking-tight">{adaptiveRate.toFixed(1)}</span>
              <span className="text-2xl font-sans font-light text-theme-muted mt-1">%</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-theme-border pt-4">
              <div>
                <div className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mb-1">Sessions</div>
                <div className="text-lg font-display font-normal text-theme-primary">{Math.round(adaptiveSessions)}</div>
              </div>
              <div>
                <div className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mb-1">Avg Confidence</div>
                <div className="text-lg font-display font-normal text-theme-primary">{adaptiveConf.toFixed(0)}%</div>
              </div>
            </div>
          </motion.div>
      </div>

      {/* Improvement Banner */}
      {data.static_conversion_rate > 0 && adaptiveWins && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
            <div className="mb-6 bg-[rgba(221,102,104,0.05)] border border-theme-border-strong rounded-2xl px-6 py-4 flex items-center justify-center space-x-3 text-[#dd6668] font-medium shadow-md">
              <ArrowUpRight className="w-5 h-5 text-[#dd6668]" />
              <span>Adaptive is outperforming static by {improvement.toFixed(1)}%</span>
            </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-theme-surface border border-theme-border rounded-2xl p-6 shadow-lg flex flex-col"
        >
          <h3 className="text-lg font-display font-normal text-theme-primary mb-6">Conversion Comparison</h3>
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B', fontFamily: 'DM Sans' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B', fontFamily: 'DM Sans' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,23,42,0.02)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#64748B', fontFamily: 'DM Sans', paddingTop: '10px' }} />
                <Bar dataKey="STATIC" fill="rgba(15,23,42,0.1)" radius={[6, 6, 0, 0]} animationDuration={1500}>
                  <LabelList dataKey="STATIC" position="top" fill="#64748B" fontSize={12} formatter={(val: any) => `${val}%`} />
                </Bar>
                <Bar dataKey="ADAPTIVE" fill="#dd6668" radius={[6, 6, 0, 0]} animationDuration={1500}>
                  <LabelList dataKey="ADAPTIVE" position="top" fill="#dd6668" fontSize={12} fontWeight={500} formatter={(val: any) => `${val}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Detailed Grid */}
        <motion.div 
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4"
        >
          {/* STATIC Column */}
          <motion.div variants={itemVariants} className="bg-theme-surface border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mb-1">Static Sessions</p>
            <p className="text-xl font-display font-normal text-theme-primary">{data.sessions_per_variant.STATIC}</p>
          </motion.div>
          
          {/* ADAPTIVE Column */}
          <motion.div variants={itemVariants} className="bg-[rgba(221,102,104,0.02)] border border-[#dd6668]/20 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-[#dd6668] mb-1">Adaptive Sessions</p>
            <p className="text-xl font-display font-normal text-theme-primary">{data.sessions_per_variant.ADAPTIVE}</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-theme-surface border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mb-1">Static Conv.</p>
            <p className="text-xl font-display font-normal text-theme-primary">{staticRate.toFixed(1)}%</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-[rgba(221,102,104,0.02)] border border-[#dd6668]/20 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-[#dd6668] mb-1">Adaptive Conv.</p>
            <p className="text-xl font-display font-normal text-theme-primary">{adaptiveRate.toFixed(1)}%</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-theme-surface border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mb-1">Static Conf.</p>
            <p className="text-xl font-display font-normal text-theme-primary">{(data.static_avg_confidence * 100).toFixed(0)}%</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-[rgba(221,102,104,0.02)] border border-[#dd6668]/20 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-[#dd6668] mb-1">Adaptive Conf.</p>
            <p className="text-xl font-display font-normal text-theme-primary">{(data.adaptive_avg_confidence * 100).toFixed(0)}%</p>
          </motion.div>
        </motion.div>
      </div>

    </div>
  );
}
