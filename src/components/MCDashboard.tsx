import React, { useMemo } from "react";
import { BookOpen, Layers, Users, TrendingUp, Calendar, UserCheck, BarChart2, PieChart as PieIcon, Award, Activity } from "lucide-react";
import { motion } from "motion/react";
import { formatToMmmDdYyyy, isBatchRunning } from "../lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from "recharts";

interface MCDashboardProps {
  courseData: any[];
  mcBatchData: any[];
  employees: any[];
  onTabChange?: (tab: string) => void;
  onCourseClick?: (course: any) => void;
}

export default function MCDashboard({ courseData = [], mcBatchData = [], employees = [], onTabChange, onCourseClick }: MCDashboardProps) {
  // 1. Calculate general statistics
  const stats = useMemo(() => {
    const totalCourses = courseData.length;
    const totalBatches = mcBatchData.length;
    
    // Count representatives
    const totalReps = employees.filter(emp => {
      const tag = String(emp.Tag || "").toLowerCase();
      return tag.includes("mc representatives") || tag.includes("mc representative");
    }).length;

    // Sum enrollments and financial metrics
    const totals = courseData.reduce((acc, row) => {
      const fee = parseFloat(String(row["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
      const enroll = parseInt(String(row.Enrolled || row.Enrollments || "0").replace(/[^0-9.]/g, ""), 10);
      const disc = parseFloat(String(row["Discount"] || "0").replace(/[^0-9.]/g, ""));
      const exp = parseFloat(String(row["Expenses"] || "0").replace(/[^0-9.]/g, ""));
      
      const f = isNaN(fee) ? 0 : fee;
      const e = isNaN(enroll) ? 0 : enroll;
      const d = isNaN(disc) ? 0 : disc;
      const x = isNaN(exp) ? 0 : exp;

      const gross = f * e;
      const netRev = gross - d;
      const profit = netRev - x;

      acc.fee += f;
      acc.enrollments += e;
      acc.gross += gross;
      acc.discount += d;
      acc.netRevenue += netRev;
      acc.expenses += x;
      acc.netProfit += profit;
      
      return acc;
    }, { fee: 0, enrollments: 0, gross: 0, discount: 0, netRevenue: 0, expenses: 0, netProfit: 0 });

    // Count running batches
    const runningBatchesCount = mcBatchData.filter(isBatchRunning).length;

    // Workflow status counts
    const statusCounts = courseData.reduce((acc: Record<string, number>, course: any) => {
      const status = course["Status"] || "N/A";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalCourses,
      totalBatches,
      totalReps,
      totalEnrollments: totals.enrollments,
      totalRevenue: totals.netRevenue,
      totalCourseFee: totals.fee,
      totalGrossRevenue: totals.gross,
      totalDiscount: totals.discount,
      totalExpenses: totals.expenses,
      totalNetProfit: totals.netProfit,
      runningBatchesCount,
      statusCounts
    };
  }, [courseData, mcBatchData, employees]);

  // 2. Prepare chart data: Enrollments & Revenue per Course
  const courseChartData = useMemo(() => {
    return courseData
      .map(row => {
        const enroll = parseInt(String(row.Enrolled || row.Enrollments || "0").replace(/,/g, ""), 10);
        const rev = parseFloat(String(row["Net Revenue"] || row["Revenue"] || row["Total Revenue"] || "0").replace(/[^0-9.]/g, ""));
        return {
          name: String(row["Course Code"] || "Unknown"),
          title: String(row["Course Title"] || ""),
          Enrollments: isNaN(enroll) ? 0 : enroll,
          Revenue: isNaN(rev) ? 0 : rev
        };
      })
      .filter(item => item.Enrollments > 0 || item.Revenue > 0)
      .slice(0, 8); // top 8 courses for readability
  }, [courseData]);

  // 3. Prepare pie chart data: Status breakdown of Courses
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    courseData.forEach(row => {
      const status = String(row.Status || "Proposed").trim();
      counts[status] = (counts[status] || 0) + 1;
    });

    const colors = ["#0d9488", "#0ea5e9", "#f59e0b", "#10b981", "#6366f1", "#ef4444"];
    return Object.entries(counts).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  }, [courseData]);

  // 4. List recent batches with course title helper
  const recentBatches = useMemo(() => {
    return [...mcBatchData]
      .sort((a, b) => {
        const dateA = new Date(a["Start Date"] || 0).getTime();
        const dateB = new Date(b["Start Date"] || 0).getTime();
        return dateB - dateA; // newest first
      })
      .slice(0, 5)
      .map(batch => {
        const course = courseData.find(c => String(c["Course Code"]).trim() === String(batch["Course Code"]).trim());
        return {
          ...batch,
          courseTitle: course ? course["Course Title"] : "Micro-Credential Course"
        };
      });
  }, [mcBatchData, courseData]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-600" />
            Micro-Credentials Analytics
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Real-time insights and monitoring for courses, batches, and representatives.
          </p>
        </div>
      </div>

      {/* KPI stats section */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5"
      >
        {/* KPI Card 1: Total Courses */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => onTabChange?.("course")}
          className="lg:col-span-2 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-teal-500/40 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] group"
        >
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Total Course</span>
            <span className="text-lg font-bold text-gray-900">{stats.totalCourses}</span>
          </div>
        </motion.div>

        {/* KPI Card 2: Total Batches */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => onTabChange?.("batch")}
          className="lg:col-span-2 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-sky-500/40 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] group"
        >
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600 group-hover:scale-110 transition-transform">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Total Batch</span>
            <span className="text-lg font-bold text-gray-900">{stats.totalBatches}</span>
          </div>
        </motion.div>

        {/* KPI Card 3: Running Batches */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => onTabChange?.("batch")}
          className="lg:col-span-2 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-emerald-500/40 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] group"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform relative">
            <Activity className="w-4 h-4" />
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Running Batch</span>
            <span className="text-lg font-bold text-emerald-600">{stats.runningBatchesCount}</span>
          </div>
        </motion.div>

        {/* KPI Card 4: Workflow Summary (Wider) */}
        <motion.div 
          variants={itemVariants} 
          className="lg:col-span-6 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center"
        >
          <div className="flex items-center gap-1.5 mb-2 ml-1">
            <BarChart2 className="w-3 h-3 text-gray-400" />
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Workflow Stages</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[
              { label: "Prop", key: "Proposed", color: "bg-indigo-50/50 text-indigo-700 border-indigo-100/30" },
              { label: "Dev", key: "Developed", color: "bg-amber-50/50 text-amber-700 border-amber-100/30" },
              { label: "Rev", key: "Reviewed", color: "bg-sky-50/50 text-sky-700 border-sky-100/30" },
              { label: "Approved", key: "Approved", color: "bg-emerald-50/50 text-emerald-700 border-emerald-100/30" },
              { label: "Published", key: "Published", color: "bg-teal-50/50 text-teal-700 border-teal-100/30" },
              { label: "Active", key: "Active", color: "bg-green-100/30 text-green-800 border-green-200/30" }
            ].map((stage) => (
              <div key={stage.key} className={`py-1.5 px-1 rounded-lg border ${stage.color} flex flex-col items-center justify-center text-center`}>
                <span className="text-xs font-bold leading-none">{stats.statusCounts[stage.key] || 0}</span>
                <span className="text-[7px] font-bold uppercase tracking-tighter opacity-70 mt-0.5">{stage.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* KPI Card 5: Enrolled */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-emerald-500/30 transition-all group">
          <div className="p-2.5 rounded-lg bg-emerald-50/50 text-emerald-600 group-hover:scale-110 transition-transform">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Enrolled</span>
            <span className="text-lg font-bold text-gray-900">{stats.totalEnrollments.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* KPI Card 6: Total Course Fee */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-blue-500/30 transition-all group">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Course Fee</span>
            <span className="text-lg font-bold text-gray-900">৳{stats.totalCourseFee.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* KPI Card 7: Gross Revenue */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-teal-500/30 transition-all group">
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Gross Revenue</span>
            <span className="text-lg font-bold text-gray-900">৳{stats.totalGrossRevenue.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* KPI Card 8: Discount */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-rose-500/30 transition-all group">
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Discount</span>
            <span className="text-lg font-bold text-gray-900">৳{stats.totalDiscount.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* KPI Card 9: Net Revenue */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-amber-500/30 transition-all group">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Net Revenue</span>
            <span className="text-lg font-bold text-gray-900">৳{stats.totalRevenue.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* KPI Card 10: Expenses */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-orange-500/30 transition-all group">
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Expense</span>
            <span className="text-lg font-bold text-gray-900">৳{stats.totalExpenses.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* KPI Card 11: Net Profit */}
        <motion.div variants={itemVariants} className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-emerald-600/30 transition-all group">
          <div className="p-2.5 rounded-lg bg-emerald-100/50 text-emerald-700 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Net Profit</span>
            <span className="text-lg font-bold text-gray-900">৳{stats.totalNetProfit.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* KPI Card 12: MC Representatives */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => onTabChange?.("representatives")}
          className="lg:col-span-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3.5 hover:border-indigo-500/40 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] group"
        >
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block truncate">Representatives</span>
            <span className="text-lg font-bold text-gray-900">{stats.totalReps}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Charts bento section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Enrollment / Revenue Bar Chart */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Top Course Metrics</h3>
            </div>
            <span className="text-[10px] text-gray-400">Enrollment count by Course Code</span>
          </div>
          <div className="h-64 w-full text-xs font-mono">
            {courseChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#94a3b8" />
                  <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff" }}
                    itemStyle={{ color: "#2dd4bf" }}
                    labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                    formatter={(value: any, name: string) => {
                      if (name === "Revenue") return [`৳${Number(value).toLocaleString()}`, "Net Revenue"];
                      return [value, "Enrolled"];
                    }}
                  />
                  <Bar 
                    dataKey="Enrollments" 
                    fill="#0d9488" 
                    radius={[4, 4, 0, 0]} 
                    barSize={24} 
                    name="Enrolled" 
                    onClick={(data) => {
                      if (data && onCourseClick) {
                        const course = courseData.find(c => String(c["Course Code"]).trim() === String(data.name).trim());
                        if (course) onCourseClick(course);
                      }
                    }}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                No course enrollment data available.
              </div>
            )}
          </div>
        </div>

        {/* Status Breakdown Circle Ring */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
              <PieIcon className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Course Status Ratio</h3>
            </div>
            <div className="h-44 w-full flex items-center justify-center relative mt-3">
              {statusChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-bold text-gray-900">{stats.totalCourses}</span>
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Total Courses</span>
                  </div>
                </>
              ) : (
                <div className="text-gray-400 text-xs italic">No data.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-gray-50 text-[10px]">
            {statusChartData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-gray-500 truncate">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline of recent batches & info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Batches timeline */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Recent Batches Timeline</h3>
            </div>
            <span className="text-[10px] text-gray-400">Newly scheduled batch releases</span>
          </div>

          <div className="flow-root">
            {recentBatches.length > 0 ? (
              <ul className="-mb-8">
                {recentBatches.map((batch, batchIdx) => (
                  <li key={batchIdx}>
                    <div className="relative pb-8">
                      {batchIdx !== recentBatches.length - 1 ? (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-100" aria-hidden="true" />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center ring-8 ring-white font-mono text-[10px] font-bold">
                            #{batch["Batch Number"] || "0"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <div 
                              className="cursor-pointer hover:text-teal-600 transition-colors group/item"
                              onClick={() => {
                                const course = courseData.find(c => String(c["Course Code"]).trim() === String(batch["Course Code"]).trim());
                                if (course && onCourseClick) {
                                  onCourseClick(course);
                                }
                              }}
                            >
                              <p className="text-xs font-bold text-gray-800 group-hover/item:text-teal-600 transition-colors">
                                {batch["Course Code"]} — {batch.courseTitle}
                              </p>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                              <span>Instructor: <span className="font-semibold text-gray-700">{batch["Instractor"] || "N/A"}</span></span>
                              <span>•</span>
                              <span>Students: <span className="font-semibold text-teal-600">{batch["Student"] || "—"}</span></span>
                            </p>
                          </div>
                          <div className="text-right text-[10px] whitespace-nowrap text-gray-400 font-mono">
                            {batch["Start Date"] ? formatToMmmDdYyyy(batch["Start Date"]) : "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6 text-gray-400 text-xs italic">
                No scheduled batches found. Go to the Batch tab to add one!
              </div>
            )}
          </div>
        </div>

        {/* Quick Help / Micro-Credentials Card */}
        <div className="bg-gradient-to-br from-teal-900 to-teal-950 p-6 rounded-xl border border-teal-800 shadow-lg text-white space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800/60 flex items-center justify-center text-teal-300 shadow-inner">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold tracking-tight uppercase">Micro-Credentials Core</h3>
            <p className="text-[11px] leading-relaxed text-teal-100/80">
              Micro-credential training offers modular, job-focused skillset validations designed for modern organizational excellence.
            </p>
            <div className="space-y-2 pt-2">
              <div className="flex items-start gap-2 text-[10px] text-teal-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1 shrink-0" />
                <p><strong>Strict Course Alignments:</strong> Every batch is directly tied to a mapped curriculum code database.</p>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-teal-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1 shrink-0" />
                <p><strong>Workforce Synergy:</strong> Instructors and representatives are dynamically resolved from internal employee registers.</p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-teal-800/60 text-[9px] font-mono text-teal-400 flex justify-between items-center">
            <span>MC ENGINE ACTIVE</span>
            <span>v1.2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
