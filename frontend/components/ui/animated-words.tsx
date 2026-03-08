"use client";

import { useState, useEffect } from "react";

const words = [
  "Traffic Simulation",
  "Network Analysis",
  "Urban Mobility",
  "Route Planning",
];

export function AnimatedWords() {
  const [currentWord, setCurrentWord] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative h-[1.1em] w-full overflow-hidden block">
      {words.map((word, index) => (
        <span
          key={word}
          className={`absolute left-0 w-full text-center transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] ${
            index === currentWord
              ? "opacity-100 translate-y-0"
              : index === (currentWord - 1 + words.length) % words.length
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
  );
}
