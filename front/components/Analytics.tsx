import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', value: 4000 },
  { name: 'Tue', value: 3000 },
  { name: 'Wed', value: 5000 },
  { name: 'Thu', value: 2780 },
  { name: 'Fri', value: 1890 },
  { name: 'Sat', value: 2390 },
  { name: 'Sun', value: 3490 },
];

const Analytics: React.FC = () => {
  return (
    <div className="animate-[fadeInUp_0.5s_ease-out]">
        <h2 className="text-3xl font-black text-yc-text-primary dark:text-white uppercase tracking-tight mb-8">Analytics</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl p-6">
                <h3 className="font-bold text-yc-text-primary dark:text-white mb-6">Portfolio Performance</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F26522" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#F26522" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#121212', border: '1px solid #333', borderRadius: '8px'}}
                                itemStyle={{color: '#fff'}}
                            />
                            <Area type="monotone" dataKey="value" stroke="#F26522" fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                 <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl p-6 flex items-center justify-between">
                     <div>
                         <p className="text-gray-500 text-xs uppercase font-bold">Best Performer</p>
                         <h4 className="text-xl font-bold text-yc-text-primary dark:text-white mt-1">OpenAI</h4>
                     </div>
                     <span className="text-yc-green font-mono font-bold text-xl">+120%</span>
                 </div>
                 <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl p-6 flex items-center justify-between">
                     <div>
                         <p className="text-gray-500 text-xs uppercase font-bold">Worst Performer</p>
                         <h4 className="text-xl font-bold text-yc-text-primary dark:text-white mt-1">WeWork</h4>
                     </div>
                     <span className="text-yc-red font-mono font-bold text-xl">-98%</span>
                 </div>
                 <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl p-6 flex items-center justify-between">
                     <div>
                         <p className="text-gray-500 text-xs uppercase font-bold">Dividends Earned</p>
                         <h4 className="text-xl font-bold text-yc-text-primary dark:text-white mt-1">450 XTZ</h4>
                     </div>
                     <span className="text-gray-400 font-mono text-sm">Lifetime</span>
                 </div>
            </div>
        </div>
    </div>
  );
};

export default Analytics;