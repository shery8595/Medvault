import { ReactNode } from "react";
import { Info, AlertTriangle, Lightbulb, ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";

type CalloutType = "info" | "warning" | "success" | "danger" | "tip" | "note";

interface CalloutProps {
    type?: CalloutType;
    title?: string;
    children: ReactNode;
    className?: string;
}

const config: Record<CalloutType, { icon: React.ComponentType<{ className?: string }>, classes: string, iconColor: string }> = {
    info: {
        icon: Info,
        classes: "bg-blue-50/50 text-blue-900 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-900/50",
        iconColor: "text-blue-500 dark:text-blue-400"
    },
    note: {
        icon: Info,
        classes: "bg-blue-50/50 text-blue-900 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-900/50",
        iconColor: "text-blue-500 dark:text-blue-400"
    },
    warning: {
        icon: AlertTriangle,
        classes: "bg-amber-50/50 text-amber-900 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-900/50",
        iconColor: "text-amber-500 dark:text-amber-400"
    },
    success: {
        icon: Info,
        classes: "bg-emerald-50/50 text-emerald-900 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-900/50",
        iconColor: "text-emerald-500 dark:text-emerald-400"
    },
    danger: {
        icon: ShieldAlert,
        classes: "bg-rose-50/50 text-rose-900 border-rose-200/50 dark:bg-rose-950/20 dark:text-rose-200 dark:border-rose-900/50",
        iconColor: "text-rose-500 dark:text-rose-400"
    },
    tip: {
        icon: Lightbulb,
        classes: "bg-blue-50/50 text-blue-900 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-900/50",
        iconColor: "text-blue-500 dark:text-blue-400"
    }
};

export function Callout({ type = "info", title, children, className }: CalloutProps) {
    // Fallback to "info" if an unknown type is passed — prevents crashing
    const { icon: Icon, classes, iconColor } = config[type] ?? config["info"];

    return (
        <div className={cn(
            "my-6 flex gap-4 rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:shadow-md",
            classes,
            className
        )}>
            <div className="mt-0.5 flex-shrink-0">
                <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
            <div className="flex-1 space-y-1">
                {title && <h5 className="font-bold tracking-tight">{title}</h5>}
                <div className="prose-sm dark:prose-invert max-w-none opacity-90 prose-p:leading-relaxed">
                    {children}
                </div>
            </div>
        </div>
    );
}
