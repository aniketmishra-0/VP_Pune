import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TestRecord } from "../types";

interface StudentChartsProps {
  tests: TestRecord[];
  isDark: boolean;
}

export default function StudentCharts({ tests, isDark }: StudentChartsProps) {
  // Sort tests by date if possible, otherwise keep in spreadsheet order (they are usually chronological)
  const validData = tests
    .map((t, idx) => {
      const score = parseFloat(String(t.score));
      const outOf = parseFloat(String(t.outOf));
      const percentage = !isNaN(score) && !isNaN(outOf) && outOf > 0 ? (score / outOf) * 100 : 0;
      return {
        name: t.name.replace(/(Milestone|City Test|Practice Test|GAT Exam)/i, "").trim() || `Test ${idx + 1}`,
        fullName: t.name,
        Score: isNaN(score) ? 0 : score,
        "Max Marks": isNaN(outOf) ? 0 : outOf,
        "Percentage (%)": parseFloat(percentage.toFixed(2)),
        type: t.type,
      };
    })
    .filter((d) => d.Score > 0 || d["Max Marks"] > 0);

  if (validData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-gray-800 text-slate-400">
        <p className="text-sm font-medium">Not enough numerical score metrics to visualize performance curves.</p>
      </div>
    );
  }

  const gridColor = isDark ? "#1f2937" : "#f1f5f9";
  const axisColor = isDark ? "#9ca3af" : "#dde1e8";
  const tooltipBg = isDark ? "#1f2937" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e2e8f0";
  const textColor = isDark ? "#f3f4f6" : "#1f2937";

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-100 dark:border-gray-800 shadow-sm p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-display">
            Performance Trend Curve
          </h3>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
            Real-time percentage rating mapped across consecutive examinations.
          </p>
        </div>
        <div className="flex gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
            <span className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-500 block"></span>
            Percentage Curve
          </div>
        </div>
      </div>

      <div className="w-full h-[260px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={validData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              stroke={axisColor}
              tick={{ fill: isDark ? "#9ca3af" : "#64748b", fontSize: 10 }}
              tickLine={false}
            />
            <YAxis
              stroke={axisColor}
              domain={[0, 100]}
              tick={{ fill: isDark ? "#9ca3af" : "#64748b", fontSize: 10 }}
              tickLine={false}
              unit="%"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderRadius: "8px",
                color: textColor,
                fontSize: "12px",
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              labelFormatter={(value, name) => {
                if (name && name[0]) {
                  return name[0].payload.fullName;
                }
                return value;
              }}
              formatter={(value, name) => [`${value}%`, name]}
            />
            <Line
              type="monotone"
              dataKey="Percentage (%)"
              stroke={isDark ? "#60a5fa" : "#2563eb"}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 1 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
