import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X, ChevronDown, ChevronUp } from 'lucide-react';
import { parseTransactionError } from '../lib/errorParser';

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    details?: string;
}

interface ToastContextType {
    toast: (type: ToastType, message: string, details?: string) => void;
    success: (message: string) => void;
    error: (message: string, details?: string) => void;
    info: (message: string) => void;
    /** Parse a blockchain/contract error and show a user-friendly toast */
    txError: (err: any) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, []);

    const toast = useCallback((type: ToastType, message: string, details?: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, type, message, details }]);
        setTimeout(() => removeToast(id), details ? 10000 : 5000);
    }, [removeToast]);

    const success = useCallback((message: string) => toast('success', message), [toast]);
    const error = useCallback((message: string, details?: string) => toast('error', message, details), [toast]);
    const info = useCallback((message: string) => toast('info', message), [toast]);

    const txError = useCallback((err: any) => {
        const parsed = parseTransactionError(err);
        // "Transaction cancelled" — show as info, not error
        if (parsed.message === 'Transaction cancelled') {
            toast('info', parsed.message);
        } else {
            toast('error', parsed.message, parsed.details);
        }
    }, [toast]);

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    return (
        <ToastContext.Provider value={{ toast, success, error, info, txError }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-md">
                {toasts.map((t) => {
                    const isExpanded = expandedIds.has(t.id);
                    return (
                        <div
                            key={t.id}
                            className={`flex flex-col min-w-[300px] max-w-md rounded-xl shadow-lg border animate-[slideInRight_0.3s_ease-out] backdrop-blur-md
                ${t.type === 'success' ? 'bg-green-50/90 dark:bg-green-950/80 border-green-200 dark:border-green-800 text-green-800 dark:text-green-100' : ''}
                ${t.type === 'error' ? 'bg-red-50/90 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100' : ''}
                ${t.type === 'info' ? 'bg-blue-50/90 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-100' : ''}
              `}
                        >
                            <div className="flex items-start gap-3 p-4">
                                <div className="shrink-0 mt-0.5">
                                    {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />}
                                    {t.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />}
                                    {t.type === 'info' && <Info className="w-5 h-5 text-blue-500 dark:text-blue-400" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-tight">{t.message}</p>
                                    {t.details && (
                                        <button
                                            onClick={() => toggleExpand(t.id)}
                                            className="flex items-center gap-1 mt-1.5 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            {isExpanded ? 'Hide log' : 'Show log'}
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={() => removeToast(t.id)}
                                    className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {t.details && isExpanded && (
                                <div className="px-4 pb-3">
                                    <pre className="text-[10px] leading-tight opacity-60 bg-black/10 dark:bg-white/5 rounded-lg p-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono">
                                        {t.details}
                                    </pre>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
