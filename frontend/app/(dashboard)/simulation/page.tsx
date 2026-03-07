"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { TrafficSection, type TopologyId } from "@/components/simulation/traffic-section"
import { SignalControlSection } from "@/components/simulation/signal-control-section"
import { SlamSection } from "@/components/simulation/slam-section"
import { FpgaBenchmarkSection } from "@/components/simulation/fpga-benchmark-section"

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export default function SimulationPage() {
  const [topology, setTopology] = useState<TopologyId>("intersection")

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 lg:p-8 space-y-10 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold tracking-tight">Simulation Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time traffic simulation, adaptive signal control, and FPGA-accelerated SLAM
          </p>
        </motion.div>

        <motion.div
          id="traffic"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <TrafficSection topology={topology} onTopologyChange={setTopology} />
        </motion.div>

        <motion.div
          id="signals"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
        >
          <SignalControlSection topology={topology} />
        </motion.div>

        <motion.div
          id="slam"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
        >
          <SlamSection />
        </motion.div>

        <motion.div
          id="fpga"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
        >
          <FpgaBenchmarkSection />
        </motion.div>
      </div>
    </div>
  )
}
