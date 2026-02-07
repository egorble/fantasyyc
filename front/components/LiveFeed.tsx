import React from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';

const LiveFeed: React.FC = () => {
  const events = [
    { text: "Airbnb just hired a new CFO", val: "+2.0%", type: "positive" },
    { text: "Stripe launches crypto payments in EU", val: "+5.4%", type: "positive" },
    { text: "Reddit server outage reports spiking", val: "-1.2%", type: "negative" },
  ];

  return (
    <div className="w-full bg-yc-light-panel dark:bg-yc-dark-panel border border-yc-light-border dark:border-yc-dark-border rounded-xl p-4 mb-8">
      <div className="flex items-center mb-3">
         <Activity className="w-4 h-4 text-yc-orange mr-2" />
         <h3 className="text-xs font-bold text-gray-500 dark:text-[#888888] uppercase tracking-widest">Market Live Feed</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {events.map((event, i) => (
            <div key={i} className="bg-white dark:bg-[#050505] p-3 rounded-lg border border-yc-light-border dark:border-[#2A2A2A] flex items-center justify-between group hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm dark:shadow-none">
                <p className="text-sm text-yc-text-primary dark:text-white font-medium truncate pr-2">{event.text}</p>
                <div className={`text-xs font-mono font-bold flex items-center ${event.type === 'positive' ? 'text-yc-green' : 'text-yc-red'}`}>
                    {event.val}
                    {event.type === 'positive' && <ArrowUpRight className="w-3 h-3 ml-1" />}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default LiveFeed;