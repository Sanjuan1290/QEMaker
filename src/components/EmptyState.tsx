import React from 'react';

interface Props {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center text-center rounded-[18px] border-2 border-dashed border-white/7 bg-white/1.5 p-6 py-16 animate-fade-up">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/15 bg-yellow-500/7 text-3xl">
          {icon}
        </div>
      )}
      <h3 className="mb-1.5 font-serif text-[1.1rem] text-[#d1d1d1]">{title}</h3>
      {description && (
        <p className="max-w-[280px] text-sm leading-relaxed text-[#b3b3b3]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}