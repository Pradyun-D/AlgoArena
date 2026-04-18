import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

export default function SparkleEffect({ trigger }) {
  const [sparkles, setSparkles] = useState([]);

  useEffect(() => {
    if (!trigger) return;

    const newSparkles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 200 - 100,
      y: Math.random() * -80 - 40,
      delay: i * 40,
    }));

    setSparkles(newSparkles);

    setTimeout(() => setSparkles([]), 1200);
  }, [trigger]);

  return (
    <AnimatePresence>
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          className="sparkle"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1.6, 1],
            y: [0, s.y],
            x: [0, s.x],
            opacity: [0, 1, 0]
          }}
          transition={{ duration: 0.9, delay: s.delay / 1000 }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            color: "#6bfe9c",
            fontSize: "2rem",
            zIndex: 100
          }}
        >
          ✨
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
