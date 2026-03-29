import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface Node {
    id: string;
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    position: { x: number; y: number };
    color?: "teal" | "purple" | "blue" | "emerald" | "amber";
}

interface Edge {
    id: string;
    from: string;
    to: string;
    label?: string;
    animated?: boolean;
}

interface AnimatedDiagramProps {
    nodes: Node[];
    edges: Edge[];
    height?: number;
    className?: string;
}

export function AnimatedDiagram({ nodes, edges, height = 400, className }: AnimatedDiagramProps) {

    const colorMap = {
        teal: "from-blue-500 to-emerald-400 shadow-blue-500/20 text-blue-600 dark:text-blue-400",
        purple: "from-purple-500 to-fuchsia-400 shadow-purple-500/20 text-purple-600 dark:text-purple-400",
        blue: "from-blue-500 to-cyan-400 shadow-blue-500/20 text-blue-600 dark:text-blue-400",
        emerald: "from-emerald-500 to-blue-400 shadow-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        amber: "from-amber-500 to-orange-400 shadow-amber-500/20 text-amber-600 dark:text-amber-400",
    };

    const bgMap = {
        teal: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
        purple: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20",
        blue: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
        emerald: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
        amber: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
    }

    // Helper to draw curved lines between nodes
    const createPath = (from: Node, to: Node) => {
        // Assuming node dimensions are roughly 180x80
        const startX = from.position.x + 90;
        const startY = from.position.y + 80; // from bottom
        const endX = to.position.x + 90;
        const endY = to.position.y; // top

        // Simple vertical bezier curve
        return `M ${startX} ${startY} C ${startX} ${startY + 40}, ${endX} ${endY - 40}, ${endX} ${endY}`;
    };

    return (
        <div
            className={cn("relative w-full overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden", className)}
            style={{ height }}
        >
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

            {/* Draw Edges using SVG */}
            <svg className="absolute inset-0 w-full h-full" style={{ minWidth: "800px" }}>
                {edges.map((edge) => {
                    const fromNode = nodes.find(n => n.id === edge.from);
                    const toNode = nodes.find(n => n.id === edge.to);

                    if (!fromNode || !toNode) return null;

                    const pathData = createPath(fromNode, toNode);

                    return (
                        <g key={edge.id}>
                            {/* Base Line */}
                            <path
                                d={pathData}
                                fill="none"
                                className="stroke-slate-300 dark:stroke-slate-700"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                            {/* Animated Overlay Line */}
                            {edge.animated && (
                                <motion.path
                                    d={pathData}
                                    fill="none"
                                    className="stroke-blue-500 drop-shadow-[0_0_8px_rgba(20,184,166,0.8)]"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeDasharray="8 8"
                                    animate={{ strokeDashoffset: [0, -40] }}
                                    transition={{ repeat: Infinity, ease: "linear", duration: 1.5 }}
                                />
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Draw Nodes */}
            <div className="absolute inset-0 w-full h-full min-w-[800px]">
                {nodes.map((node, i) => (
                    <motion.div
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.15, type: "spring" }}
                        className={cn(
                            "absolute w-[180px] p-4 rounded-2xl border shadow-xl flex flex-col items-center text-center gap-2",
                            bgMap[node.color || "blue"]
                        )}
                        style={{ left: node.position.x, top: node.position.y }}
                    >
                        <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-950 shadow-md",
                            colorMap[node.color || "blue"]
                        )}>
                            {node.icon}
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{node.title}</h4>
                            {node.subtitle && <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{node.subtitle}</p>}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
