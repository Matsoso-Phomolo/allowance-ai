import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
              return "charts";
            }
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor";
            }
            return "vendor";
          }
          if (id.includes("AdminDashboard")) {
            return "admin";
          }
          if (id.includes("MonthlyReport")) {
            return "reports";
          }
          if (
            id.includes("MonthlyInsights") ||
            id.includes("MonthlyPlanner") ||
            id.includes("ShoppingListEvaluator") ||
            id.includes("SpendingTimetable")
          ) {
            return "planner";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
