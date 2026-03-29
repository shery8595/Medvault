import React, { useEffect, useRef } from "react";

/**
 * Heartbeat background — a glowing red dot traces an EKG-style path,
 * leaving a fading tail behind it.  Pure canvas for silky performance.
 */
export function HeartbeatBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animId: number;
        let w: number;
        let h: number;

        /* ── Build the heartbeat polyline (normalised 0-1) ── */
        const rawPath: [number, number][] = [
            [0, 0.5],
            [0.20, 0.5],
            [0.23, 0.47],
            [0.26, 0.53],
            [0.28, 0.30],
            [0.30, 0.72],
            [0.32, 0.46],
            [0.34, 0.54],
            [0.36, 0.5],
            [0.56, 0.5],
            [0.59, 0.47],
            [0.62, 0.53],
            [0.64, 0.30],
            [0.66, 0.72],
            [0.68, 0.46],
            [0.70, 0.54],
            [0.72, 0.5],
            [1.0, 0.5],
        ];

        /* Compute cumulative arc-length so we can walk along it at
           a constant speed regardless of segment length. */
        function buildSegments() {
            const segs: { x1: number; y1: number; x2: number; y2: number; cumLen: number }[] = [];
            let total = 0;
            for (let i = 1; i < rawPath.length; i++) {
                const [x1, y1] = rawPath[i - 1];
                const [x2, y2] = rawPath[i];
                const dx = (x2 - x1) * w;
                const dy = (y2 - y1) * h;
                total += Math.sqrt(dx * dx + dy * dy);
                segs.push({ x1: x1 * w, y1: y1 * h, x2: x2 * w, y2: y2 * h, cumLen: total });
            }
            return { segs, totalLen: total };
        }

        /* Interpolate a point at a given distance along the polyline */
        function pointAtDist(
            segs: { x1: number; y1: number; x2: number; y2: number; cumLen: number }[],
            totalLen: number,
            dist: number
        ): [number, number] {
            const d = Math.max(0, Math.min(totalLen, dist));
            let prev = 0;
            for (const s of segs) {
                if (d <= s.cumLen) {
                    const segLen = s.cumLen - prev;
                    const t = segLen === 0 ? 0 : (d - prev) / segLen;
                    return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t];
                }
                prev = s.cumLen;
            }
            const last = segs[segs.length - 1];
            return [last.x2, last.y2];
        }

        /* ── Resize handler ── */
        function resize() {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas!.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
            canvas!.width = w * dpr;
            canvas!.height = h * dpr;
            ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener("resize", resize);

        /* ── Animation ── */
        const SPEED = 0.00028;          // progress per ms (full loop ≈ 3.6 s)
        const TAIL_FRAC = 0.22;        // tail length as fraction of total path
        const DOT_R = 5;
        const DOT_COLOR = "#ef4444";
        const GLOW_COLOR = "rgba(239, 68, 68, 0.45)";
        const TRAIL_COLOR_START = "rgba(239, 68, 68, 0.7)";
        const TRAIL_COLOR_END = "rgba(239, 68, 68, 0)";

        let progress = 0;
        let lastTime: number | null = null;

        function draw(ts: number) {
            if (lastTime === null) lastTime = ts;
            const dt = ts - lastTime;
            lastTime = ts;

            progress = (progress + SPEED * dt) % 1;

            const { segs, totalLen } = buildSegments();
            const headDist = progress * totalLen;
            const tailDist = Math.max(0, headDist - TAIL_FRAC * totalLen);

            ctx!.clearRect(0, 0, w, h);

            /* ── Draw the trailing line ── */
            const STEPS = 120;
            for (let i = 0; i < STEPS; i++) {
                const d0 = tailDist + ((headDist - tailDist) * i) / STEPS;
                const d1 = tailDist + ((headDist - tailDist) * (i + 1)) / STEPS;
                const [x0, y0] = pointAtDist(segs, totalLen, d0);
                const [x1, y1] = pointAtDist(segs, totalLen, d1);
                const t = i / STEPS;                    // 0 (tail) → 1 (head)
                const alpha = t * t * 0.75;             // quadratic fade
                ctx!.beginPath();
                ctx!.moveTo(x0, y0);
                ctx!.lineTo(x1, y1);
                ctx!.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
                ctx!.lineWidth = 1.5 + t * 1.5;         // thinner tail → thicker head
                ctx!.lineCap = "round";
                ctx!.stroke();
            }

            /* ── Draw glow behind the dot ── */
            const [hx, hy] = pointAtDist(segs, totalLen, headDist);
            const glow = ctx!.createRadialGradient(hx, hy, 0, hx, hy, 28);
            glow.addColorStop(0, GLOW_COLOR);
            glow.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx!.fillStyle = glow;
            ctx!.beginPath();
            ctx!.arc(hx, hy, 28, 0, Math.PI * 2);
            ctx!.fill();

            /* ── Draw the bright dot ── */
            ctx!.beginPath();
            ctx!.arc(hx, hy, DOT_R, 0, Math.PI * 2);
            ctx!.fillStyle = DOT_COLOR;
            ctx!.shadowColor = DOT_COLOR;
            ctx!.shadowBlur = 16;
            ctx!.fill();
            ctx!.shadowBlur = 0;

            animId = requestAnimationFrame(draw);
        }
        animId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <div className="absolute inset-x-0 top-0 h-[600px] overflow-hidden pointer-events-none z-0">
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ display: "block" }}
            />
        </div>
    );
}
