import { useMemo } from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
    Position,
    type Edge,
    type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ProtocolFlowNode, type ProtocolNodeData } from "./protocol-flow/ProtocolFlowNode";

const nodeTypes = { protocol: ProtocolFlowNode };

const INITIAL_NODES: Node<ProtocolNodeData>[] = [
    {
        id: "patient",
        type: "protocol",
        position: { x: 0, y: 0 },
        data: { title: "Patient", subtitle: "@zama-fhe/sdk encrypt", kind: "client" },
        sourcePosition: Position.Right,
    },
    {
        id: "mvr",
        type: "protocol",
        position: { x: 220, y: 0 },
        data: { title: "MedVaultRegistry", subtitle: "Vault + apply flow", kind: "vault" },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
    },
    {
        id: "apr",
        type: "protocol",
        position: { x: 440, y: 0 },
        data: { title: "AnonymousPatientRegistry", subtitle: "Commitment-keyed FHE", kind: "client" },
        targetPosition: Position.Left,
        sourcePosition: Position.Bottom,
    },
    {
        id: "ee",
        type: "protocol",
        position: { x: 220, y: 160 },
        data: {
            title: "EligibilityEngine",
            subtitle: "Zama FHE scoring · consent",
            kind: "compute",
            hub: true,
        },
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
    },
    {
        id: "sponsor",
        type: "protocol",
        position: { x: 0, y: 300 },
        data: { title: "Sponsor", subtitle: "SponsorRegistry verified", kind: "sponsor" },
        sourcePosition: Position.Right,
    },
    {
        id: "tm",
        type: "protocol",
        position: { x: 220, y: 300 },
        data: { title: "TrialManager", subtitle: "Encrypted criteria", kind: "sponsor" },
        targetPosition: Position.Left,
        sourcePosition: Position.Top,
    },
    {
        id: "consent",
        type: "protocol",
        position: { x: 440, y: 160 },
        data: { title: "ConsentManager", subtitle: "InEbool grant / revoke", kind: "compute" },
        targetPosition: Position.Left,
    },
];

const INITIAL_EDGES: Edge[] = [
    {
        id: "patient-mvr",
        source: "patient",
        target: "mvr",
        sourceHandle: "right",
        targetHandle: "left",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#00685f", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#00685f" },
    },
    {
        id: "mvr-apr",
        source: "mvr",
        target: "apr",
        sourceHandle: "right",
        targetHandle: "left",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#0d9488", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#0d9488" },
    },
    {
        id: "mvr-ee",
        source: "mvr",
        target: "ee",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#2563eb", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#2563eb" },
    },
    {
        id: "apr-ee",
        source: "apr",
        target: "ee",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#0d9488", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#0d9488" },
    },
    {
        id: "sponsor-tm",
        source: "sponsor",
        target: "tm",
        sourceHandle: "right",
        targetHandle: "left",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#d97706", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#d97706" },
    },
    {
        id: "tm-ee",
        source: "tm",
        target: "ee",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#059669", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#059669" },
    },
    {
        id: "ee-consent",
        source: "ee",
        target: "consent",
        sourceHandle: "right",
        targetHandle: "left",
        type: "smoothstep",
        style: { stroke: "#7c3aed", strokeWidth: 1.5, strokeDasharray: "5 4" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#7c3aed" },
    },
];

/** Interactive architecture graph via React Flow (@xyflow/react). */
export function ProtocolFlowDiagram() {
    const nodes = useMemo(() => INITIAL_NODES, []);
    const edges = useMemo(() => INITIAL_EDGES, []);

    return (
        <figure className="not-prose w-full m-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
                    <p className="text-xs font-semibold text-slate-800 m-0">Protocol data flow</p>
                    <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="h-1.5 w-3 rounded-full bg-[#00685f]" />
                            Patient
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-1.5 w-3 rounded-full bg-violet-500" />
                            FHE
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-1.5 w-3 rounded-full bg-amber-500" />
                            Sponsor
                        </span>
                    </div>
                </div>

                <div className="h-[380px] w-full min-h-[320px] [&_.react-flow\_\_attribution]:hidden">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2, maxZoom: 1.05 }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        panOnDrag
                        zoomOnScroll={false}
                        zoomOnPinch
                        minZoom={0.5}
                        maxZoom={1.25}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
                        <Controls
                            showInteractive={false}
                            className="!shadow-sm !border-slate-200 !rounded-lg overflow-hidden"
                        />
                    </ReactFlow>
                </div>
            </div>

            <figcaption className="text-center text-[11px] text-slate-500 mt-2.5 font-medium">
                Fig 1. Patient vault and sponsor trial paths converge on EligibilityEngine; ConsentManager gates
                disclosure.
            </figcaption>
        </figure>
    );
}
