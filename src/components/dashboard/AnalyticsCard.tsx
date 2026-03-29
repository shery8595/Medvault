import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface AnalyticsCardProps {
  title: string;
  type: 'bar' | 'pie';
  data: any[];
  centerLabel?: {
    value: string | number;
    label: string;
  };
}

const COLORS = ['#14B8A6', '#6366F1', '#F43F5E', '#F59E0B', '#8B5CF6'];

export function AnalyticsCard({ title, type, data, centerLabel }: AnalyticsCardProps) {
  return (
    <Card className="min-h-[420px] relative overflow-hidden bg-white/5 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-500 ease-out hover:border-blue-500/30 hover:shadow-blue-500/5 hover:-translate-y-1 group">
      {/* Morphing Background Layer */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-in-out pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[100px] animate-pulse bg-blue-500/10" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full blur-[100px] animate-pulse bg-indigo-500/10 delay-700" />
      </div>

      <CardHeader className="pb-2 relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(20,184,166,0.6)] animate-pulse" />
          <CardTitle className="text-sm font-black uppercase tracking-[0.25em] text-slate-500 group-hover:text-slate-400 transition-colors">
            {title}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        <div className="h-[320px] w-full relative flex items-center justify-center pt-4">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  fontWeight="bold"
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  fontWeight="bold"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 8 }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="url(#barGradient)"
                  radius={[8, 8, 0, 0]}
                  barSize={32}
                  animationDuration={1500}
                />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14B8A6" />
                    <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={85}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  animationBegin={200}
                  animationDuration={1800}
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
              </PieChart>
            )}
          </ResponsiveContainer>

          {type === 'pie' && centerLabel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-5xl font-black text-white tracking-tighter transition-all duration-500 group-hover:scale-110">
                {centerLabel.value}
              </span>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">
                {centerLabel.label}
              </p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Inner Glow Border */}
      <div className="absolute inset-[1px] rounded-[inherit] pointer-events-none border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}
