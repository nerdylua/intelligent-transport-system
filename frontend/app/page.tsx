"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Lenis from "lenis";
import { Box, Terminal, LineChart, Check } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button"

const animatedWords = [
  "Traffic Simulation",
  "Network Analysis",
  "Urban Mobility",
  "Route Planning",
];

export default function Home() {
  const [currentWord, setCurrentWord] = useState(0);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % animatedWords.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 selection:bg-zinc-200 selection:text-zinc-900 font-sans">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.042) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.042) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 72%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 72%)",
        }}
      />

      <nav className="flex h-16 items-center justify-between px-6 lg:px-12 bg-white/94 backdrop-blur-[16px] relative border-b border-zinc-100 sticky top-0 z-40">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2 text-zinc-900">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#18181b]">
              <div className="h-2 w-2 rounded-sm bg-white/20"></div>
            </div>
            <span className="font-bold tracking-tight text-lg ml-1 hidden sm:block">ITS System</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          <Link
            href="#"
            className="text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Capabilities <span className="ml-1 text-[10px] text-zinc-400">v</span>
          </Link>
          <Link
            href="#"
            className="text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Hardware
          </Link>
          <Link
            href="#"
            className="text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Documentation <span className="ml-1 text-[10px] text-zinc-400">v</span>
          </Link>
          <Link
            href="#"
            className="text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Research
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/visualization"
            className="rounded-lg bg-[#09090b] px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-zinc-800"
          >
            Launch Visualizer
          </Link>
        </div>
      </nav>

      <main className="flex-1 relative z-[5]">
        <section className="pt-[88px] pb-16 text-center">
          <div className="mx-auto flex flex-col items-center px-6">
            <p className="mb-7 text-[0.775rem] font-normal text-zinc-500 tracking-[-0.01em]">
              Next-gen <span className="font-semibold text-zinc-900">Intelligent Transport</span> Platform
            </p>
            <h1 className="text-[clamp(2.75rem,5.8vw,4.4rem)] leading-[1.06] tracking-[-0.055em] font-bold text-[#09090b] max-w-[740px] mb-5 flex flex-col items-center">
              <span>FPGA-Accelerated</span>
              <span className="relative h-[1.1em] w-full overflow-hidden block">
                {animatedWords.map((word, index) => (
                  <span
                    key={word}
                    className={`absolute left-0 w-full text-center transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] ${index === currentWord
                      ? "opacity-100 translate-y-0"
                      : index === (currentWord - 1 + animatedWords.length) % animatedWords.length
                        ? "opacity-0 -translate-y-full"
                        : "opacity-0 translate-y-full"
                      }`}
                  >
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500">
                      {word}
                    </span>
                  </span>
                ))}
              </span>
            </h1>
            <p className="mx-auto max-w-[455px] text-[1.025rem] text-[#71717a] leading-[1.65] tracking-[-0.015em] font-normal mb-8">
              Run microscopic vehicle models, test decentralized AI routing, and evaluate smart intersections with ultra-low latency hardware acceleration.
            </p>
            <div className="flex justify-center gap-2.5 items-center mb-14">
              <RainbowButton asChild className="rounded-lg h-auto px-[22px] py-[10px] text-[0.875rem] font-medium tracking-[-0.022em]">
                <Link href="/simulation">
                  Start Simulation
                </Link>
              </RainbowButton>
              <Link
                href="#"
                className="rounded-lg border border-zinc-200 bg-white px-5 py-[10px] text-[0.875rem] font-normal text-zinc-900 tracking-[-0.018em] transition-all hover:border-[#a1a1aa] hover:bg-[#fafafa]"
              >
                Read Paper
              </Link>
            </div>

            <div className="w-full max-w-[1020px] min-h-[500px] lg:min-h-[700px] overflow-hidden rounded-[13px] border border-zinc-300 bg-zinc-50 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.05),0_24px_60px_rgba(0,0,0,0.08)] flex items-center justify-center relative transition-all duration-300 ease-out hover:border-zinc-400 hover:shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_20px_rgba(0,0,0,0.07),0_28px_70px_rgba(0,0,0,0.1)]">
              <div className="flex flex-col items-center justify-center gap-3 text-zinc-400">
                <Box className="w-10 h-10 opacity-50" />
                <span className="text-base font-medium tracking-tight">Model Architecture Image Placeholder</span>
              </div>
            </div>
          </div>
        </section>
        <section className="py-16 text-center">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-[2.5rem] font-bold tracking-tight text-[#09090b]">
              Why choose our ITS Platform?
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              Everything you need to process simulation events at scale, without the complexity.
            </p>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 space-y-32">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="max-w-md">
                <h3 className="text-[2rem] leading-tight font-bold tracking-tight text-[#09090b]">
                  Process events in milliseconds
                </h3>
                <p className="mt-4 text-[17px] text-zinc-500 leading-relaxed mb-8">
                  Our hardware-accelerated infrastructure ensures your simulation telemetry reaches the control center fast. No queues, no delays - just instant stream processing.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#09090b]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-[#09090b]">
                        <path d="M4 12L10 18L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[17px] text-zinc-900 tracking-tight">99.9% processing rate</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#09090b]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-[#09090b]">
                        <path d="M4 12L10 18L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[17px] text-zinc-900 tracking-tight">Automatic retry on stream failures</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#09090b]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-[#09090b]">
                        <path d="M4 12L10 18L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[17px] text-zinc-900 tracking-tight">Real-time telemetry tracking</span>
                  </div>
                </div>
              </div>

              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-orange-400 to-yellow-700 opacity-90 mix-blend-multiply blur-sm scale-110"></div>
                <div className="absolute inset-0 bg-[#e68a35]/40 backdrop-blur-[2px]"></div>

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-12 z-10">
                  <div className="w-full flex justify-between items-center rounded-t-lg bg-white p-3 font-semibold text-xs tracking-tight shadow-md">
                    <span>Live Event Stream</span>
                    <span>99.9% logged</span>
                  </div>
                  <div className="w-full rounded bg-white p-3 flex justify-between items-center shadow-md">
                    <div className="flex gap-3 items-center">
                      <Box className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold tracking-tight text-zinc-900">LiDAR scan frame...</span>
                        <span className="text-[11px] text-zinc-500 tracking-tight">Ego vehicle logged</span>
                      </div>
                    </div>
                    <span className="text-[#3ECF8E] text-[11px] font-medium tracking-tight bg-[#e8f6f0] px-2 py-0.5 rounded-full">Sent</span>
                  </div>
                  <div className="w-full rounded bg-white p-3 flex justify-between items-center shadow-md opacity-90">
                    <div className="flex gap-3 items-center">
                      <Terminal className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold tracking-tight text-zinc-900">Traffic rule output</span>
                        <span className="text-[11px] text-zinc-500 tracking-tight">SUMO generated</span>
                      </div>
                    </div>
                    <span className="text-[#5E6AD2] text-[11px] font-medium tracking-tight bg-[#edf0fc] px-2 py-0.5 rounded-full">Delivered</span>
                  </div>
                  <div className="w-full rounded bg-white p-3 flex justify-between items-center shadow-md opacity-80">
                    <div className="flex gap-3 items-center">
                      <LineChart className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold tracking-tight text-zinc-900">Data viz plotted</span>
                        <span className="text-[11px] text-zinc-500 tracking-tight">dashboard UI updated</span>
                      </div>
                    </div>
                    <span className="text-amber-500 text-[11px] font-medium tracking-tight bg-amber-50 px-2 py-0.5 rounded-full">Opened</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden shadow-sm order-2 lg:order-1 transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg">
                <div className="absolute inset-0 border border-zinc-200/50 bg-[#fafafa]"></div>

                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 w-full h-full">
                  <div className="relative w-full max-w-sm aspect-square bg-[#09090b] rounded-2xl shadow-xl overflow-hidden flex items-center justify-center ring-1 ring-zinc-900/10">
                    <div className="absolute w-full h-12 bg-zinc-800/80 top-1/2 -translate-y-1/2 flex items-center justify-between px-2">
                      <div className="h-2 w-2 rounded-full bg-[#5E6AD2] animate-pulse"></div>
                      <div className="h-2 w-2 rounded-full bg-[#5E6AD2] animate-pulse delay-75"></div>
                      <div className="h-2 w-2 rounded-full bg-[#3ECF8E] animate-pulse delay-150"></div>
                    </div>
                    <div className="absolute h-full w-12 bg-zinc-800/80 left-1/2 -translate-x-1/2 flex flex-col items-center justify-between py-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse delay-300"></div>
                      <div className="h-2 w-2 rounded-full bg-[#5E6AD2] animate-pulse delay-500"></div>
                    </div>

                    <div className="absolute top-4 left-4 bg-zinc-900/90 text-zinc-400 text-[10px] font-mono p-2 rounded border border-zinc-700/50">
                      {`{ loc: [51.5, -0.1], vel: 12.4 }`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-md order-1 lg:order-2">
                <div className="inline-flex items-center rounded-full border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 px-2.5 py-0.5 text-[13px] font-semibold text-[#5E6AD2] mb-4">
                  SUMO Integration
                </div>
                <h3 className="text-[2rem] leading-tight font-bold tracking-tight text-[#09090b]">
                  High fidelity traffic modeling
                </h3>
                <p className="mt-4 text-[17px] text-zinc-500 leading-relaxed mb-8">
                  Import complex road networks and run microscopic traffic simulations. Evaluate intelligent traffic light algorithms in fully reproducible environments.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-[15px] text-zinc-600 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <Check className="h-4 w-4 text-[#09090b]" />
                    Micro-level vehicle decision making
                  </li>
                  <li className="flex items-center gap-3 text-[15px] text-zinc-600 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <Check className="h-4 w-4 text-[#09090b]" />
                    Custom mobility demand generation
                  </li>
                  <li className="flex items-center gap-3 text-[15px] text-zinc-600 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <Check className="h-4 w-4 text-[#09090b]" />
                    V2X communication analysis
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="max-w-md">
                <div className="inline-flex items-center rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-[13px] font-semibold text-pink-600 mb-4">
                  ML execution
                </div>
                <h3 className="text-[2rem] leading-tight font-bold tracking-tight text-[#09090b]">
                  Real-time intelligent pipelines
                </h3>
                <p className="mt-4 text-[17px] text-zinc-500 leading-relaxed mb-8">
                  Route traffic node payloads through custom AI models instantaneously. Generate predictive routing logic before the next simulation step.
                </p>
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 text-[13px] font-mono text-zinc-500">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-200/50">
                    <Terminal className="h-4 w-4 text-zinc-400" />
                    <span>pipeline.yaml</span>
                  </div>
                  <span className="text-pink-500">model</span>: predictive_routing_v3<br />
                  <span className="text-[#3ECF8E]">latency_threshold</span>: 50ms<br />
                  <span className="text-[#5E6AD2]">on_prediction</span>: trigger(&quot;traffic_light_update&quot;)
                </div>
              </div>

              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-tr from-zinc-100 to-zinc-50 border border-zinc-200/50"></div>

                <div className="absolute inset-0 flex flex-col justify-center items-center gap-6 z-10 p-12">
                  <div className="w-full bg-white rounded-lg shadow-sm border border-zinc-200 p-4 flex items-center justify-between">
                    <span className="font-semibold text-[13px]">Sensor Ingestion</span>
                    <div className="px-2 py-0.5 bg-zinc-100 rounded text-[11px] text-zinc-500 font-mono">24,000 req/s</div>
                  </div>

                  <div className="h-6 w-px bg-zinc-300"></div>

                  <div className="flex gap-4 w-full">
                    <div className="w-1/2 bg-white rounded-lg shadow-sm border border-zinc-200 p-3 text-center">
                      <span className="font-semibold text-[13px] text-pink-600 block mb-1">Inference Engine</span>
                      <span className="text-[11px] text-zinc-500">Node JS / Python</span>
                    </div>
                    <div className="w-1/2 bg-white rounded-lg shadow-sm border border-zinc-200 p-3 text-center">
                      <span className="font-semibold text-[13px] text-[#5E6AD2] block mb-1">Metrics Aggregation</span>
                      <span className="text-[11px] text-zinc-500">TimescaleDB</span>
                    </div>
                  </div>

                  <div className="h-6 w-px bg-zinc-300"></div>

                  <div className="w-full bg-[#09090b] text-white rounded-lg shadow-sm p-4 flex items-center justify-between">
                    <span className="font-semibold text-[13px]">Actuation Sent</span>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E]"></div> Active
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden shadow-sm order-2 lg:order-1 transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg">
                <div className="absolute inset-0 border border-zinc-200/50 bg-[#fafafa]"></div>

                <div className="absolute inset-0 bg-[#09090b] opacity-5">
                  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <pattern id="circuit" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 0 20 L 40 20 M 20 0 L 20 40" stroke="currentColor" strokeWidth="1" fill="none" />
                      <circle cx="20" cy="20" r="3" fill="currentColor" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#circuit)" />
                  </svg>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 w-full h-full">
                  <div className="relative w-full max-w-sm aspect-[3/2] bg-[#09090b] rounded-xl shadow-xl overflow-hidden flex flex-col p-5 ring-1 ring-zinc-900/10">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                        <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                        <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono tracking-wider">FPGA_CORE_01</span>
                    </div>

                    <div className="flex-1 border border-zinc-800 rounded bg-zinc-900/50 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-[#3ECF8E] shadow-[0_0_10px_#3ECF8E] animate-[scan_2s_ease-in-out_infinite_alternate]"></div>

                      <div className="flex gap-4 items-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white tracking-tighter">12<span className="text-sm text-zinc-500 ml-0.5">μs</span></div>
                          <div className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Latency</div>
                        </div>
                        <div className="h-8 w-px bg-zinc-800"></div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#3ECF8E] tracking-tighter">1.2<span className="text-sm text-zinc-500 ml-0.5">Tb/s</span></div>
                          <div className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Bandwidth</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-md order-1 lg:order-2">
                <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[13px] font-semibold text-emerald-600 mb-4">
                  Hardware Acceleration
                </div>
                <h3 className="text-[2rem] leading-tight font-bold tracking-tight text-[#09090b]">
                  FPGA-Accelerated Edge Computing
                </h3>
                <p className="mt-4 text-[17px] text-zinc-500 leading-relaxed mb-8">
                  Deploy vision models directly to edge nodes with our optimized FPGA bitstreams. Achieve microsecond latency for mission-critical traffic analytics.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-[15px] text-zinc-600 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <Check className="h-4 w-4 text-[#09090b]" />
                    Ultra-low latency sensor fusion
                  </li>
                  <li className="flex items-center gap-3 text-[15px] text-zinc-600 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <Check className="h-4 w-4 text-[#09090b]" />
                    Parallel processing architecture
                  </li>
                  <li className="flex items-center gap-3 text-[15px] text-zinc-600 rounded-lg px-2 py-1 -mx-2 transition-all duration-200 hover:bg-zinc-50 hover:translate-x-0.5">
                    <Check className="h-4 w-4 text-[#09090b]" />
                    Reduced power consumption at the edge
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="max-w-md">
                <div className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[13px] font-semibold text-orange-600 mb-4">
                  Smart Infrastructure
                </div>
                <h3 className="text-[2rem] leading-tight font-bold tracking-tight text-[#09090b]">
                  Decentralized Traffic Intersections
                </h3>
                <p className="mt-4 text-[17px] text-zinc-500 leading-relaxed mb-8">
                  Enable intersections to negotiate traffic flow autonomously. Our distributed consensus algorithm reduces downtown congestion by up to 35%.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-zinc-300 hover:-translate-y-0.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#09090b]"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M12 5V3M12 21v-2M5 12H3m18 0h-2m-2.121-4.95l1.414-1.414M6.343 17.657l-1.414 1.414m12.728 0l1.414-1.414M6.343 6.343L4.929 4.929" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                    <div>
                      <h4 className="text-[14px] font-bold text-zinc-900 tracking-tight">V2I Discovery Protocol</h4>
                      <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">Vehicles broadcast intentions to RSU nodes instantly upon entering the zone.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-zinc-300 hover:-translate-y-0.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#09090b]"><path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" /><path d="M12 8L12 12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                    <div>
                      <h4 className="text-[14px] font-bold text-zinc-900 tracking-tight">Adaptive Phasing</h4>
                      <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">Signal cycles adjust dynamically based on real-time pedestrian and vehicle density.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-[#09090b]"></div>

                <div className="absolute inset-0 flex items-center justify-center p-8 z-10">
                  <div className="relative w-full h-full">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] z-20">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <span className="text-[10px] font-bold text-black">RSU</span>
                      </div>
                    </div>

                    <div className="absolute top-[20%] left-[20%] w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center z-20">
                      <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
                    </div>
                    <div className="absolute top-[80%] left-[30%] w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center z-20">
                      <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse delay-150"></div>
                    </div>
                    <div className="absolute top-[30%] right-[20%] w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center z-20">
                      <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse delay-300"></div>
                    </div>
                    <div className="absolute bottom-[20%] right-[25%] w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center z-20">
                      <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse delay-500"></div>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Total Agents</span>
                        <span className="text-sm text-white font-medium">4 Active Nodes</span>
                      </div>
                      <div className="w-px h-6 bg-white/20"></div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Consensus</span>
                        <span className="text-sm text-[#3ECF8E] font-medium">Reached (12ms)</span>
                      </div>
                    </div>

                    <svg className="absolute inset-0 w-full h-full z-10" pointerEvents="none">
                      <line x1="25%" y1="25%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                      <line x1="32%" y1="80%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                      <line x1="80%" y1="35%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                      <line x1="75%" y1="80%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>

      <footer className="w-full bg-[#fcfcfc] py-10 border-t border-zinc-100 mt-10 mb-6 rounded-t-[2.5rem] mx-auto max-w-[95%] shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border border-b-0">
        <div className="mx-auto px-6 flex flex-col items-center justify-center text-center">

          <Link href="/" className="flex items-center gap-2 text-zinc-900 mb-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#18181b]">
              <div className="h-2 w-2 rounded-sm bg-white/20"></div>
            </div>
            <span className="font-bold tracking-tight text-base">ITS Platform</span>
          </Link>

          <p className="max-w-xs text-[13px] leading-relaxed tracking-tight text-zinc-500 mb-4">
            Advanced hardware-accelerated infrastructure for traffic networks.
          </p>

          <div className="flex items-center gap-2 mb-8">
            <div className="h-2 w-2 rounded-full bg-[#3ECF8E]"></div>
            <span className="text-[13px] text-zinc-500 cursor-pointer hover:text-zinc-900 transition-colors">All systems operational</span>
          </div>

          <div className="w-full max-w-lg flex flex-col sm:flex-row items-center justify-between border-t border-zinc-200/50 pt-6 gap-4">
            <p className="text-[12px] text-zinc-500">
              © 2026 Intelligent Transport System.
            </p>
            <div className="flex items-center gap-5">
              <Link href="#" className="text-zinc-400 hover:text-zinc-900 group transition-colors">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
              </Link>
              <Link href="#" className="text-zinc-400 hover:text-zinc-900 group transition-colors">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path></svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
