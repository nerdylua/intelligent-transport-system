"use client"

interface MetricsPanelProps {
  speed: number
  acceleration: number
  wheelAngle: number
}

export function MetricsPanel({ speed, acceleration, wheelAngle }: MetricsPanelProps) {
  const kmh = speed * 3.6
  const deg = wheelAngle * 57.2958

  return (
    <div className="absolute bottom-20 left-4 rounded-lg bg-black/75 backdrop-blur-xl border border-white/10 text-white z-10 p-3 shadow-2xl min-w-[240px]">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 font-semibold">
        Vehicle
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-xl font-bold tabular-nums leading-none">
            {kmh.toFixed(1)}
          </div>
          <div className="text-[9px] text-zinc-500 mt-1 uppercase tracking-wider">
            km/h
          </div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold tabular-nums leading-none">
            {acceleration.toFixed(2)}
          </div>
          <div className="text-[9px] text-zinc-500 mt-1 uppercase tracking-wider">
            m/s&sup2;
          </div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold tabular-nums leading-none">
            {deg.toFixed(1)}&deg;
          </div>
          <div className="text-[9px] text-zinc-500 mt-1 uppercase tracking-wider">
            Wheel
          </div>
        </div>
      </div>
    </div>
  )
}
