import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextType {
    toast: (type: ToastType, message: string) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
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

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const toast = useCallback((type: ToastType, message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, type, message }]);

        // Auto remove after 5 seconds
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    }, [removeToast]);

    const success = useCallback((message: string) => toast('success', message), [toast]);
    const error = useCallback((message: string) => toast('error', message), [toast]);
    const info = useCallback((message: string) => toast('info', message), [toast]);

    return (
        <ToastContext.Provider value={{ toast, success, error, info }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`flex items-start gap-3 min-w-[300px] max-w-md p-4 rounded-xl shadow-lg border animate-[slideInRight_0.3s_ease-out] backdrop-blur-md
              ${t.type === 'success' ? 'bg-green-50/90 dark:bg-green-950/80 border-green-200 dark:border-green-800 text-green-800 dark:text-green-100' : ''}
              ${t.type === 'error' ? 'bg-red-50/90 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100' : ''}
              ${t.type === 'info' ? 'bg-blue-50/90 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-100' : ''}
            `}
                    >
                        <div className="shrink-0 mt-0.5">
                            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />}
                            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />}
                            {t.type === 'info' && <Info className="w-5 h-5 text-blue-500 dark:text-blue-400" />}
                        </div>

                        <div className="flex-1">
                            <p className="text-sm font-semibold leading-tight">{t.message}</p>
                        </div>

                        <button
                            onClick={() => removeToast(t.id)}
                            className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
