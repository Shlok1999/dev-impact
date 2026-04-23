
function detectActivity({ cpu, memory, network_in }) {
  // 🧠 AI / browsing / dev research
  if (memory > 90 && network_in > 5000 && cpu < 50) {
    return "🌐 Research / AI usage (browser-heavy workflow)";
  }

  // ⚙️ Build / compile
  if (cpu > 60 && network_in < 5000) {
    return "⚙️ Build process detected";
  }

  // 📦 Downloads
  if (network_in > 30000) {
    return "📦 Heavy dependency download";
  }

  // ⚠️ Multitasking overload
  if (cpu > 40 && memory > 90 && network_in > 5000) {
    return "⚠️ Heavy multitasking (multiple apps + tabs)";
  }

  // 💤 Idle
  if (cpu < 10 && network_in < 2000) {
    return "💤 System idle";
  }

  return "🟢 Light development activity";
}

function getRecommendation({ cpu, memory, network_in }) {
  if (memory > 95) {
    return "Close unused apps to reduce memory pressure";
  }

  if (cpu > 70) {
    return "High CPU usage—check running processes";
  }

  if (network_in > 30000) {
    return "Large downloads detected—optimize dependencies";
  }

  if (cpu < 10) {
    return "System idle—consider shutting down to save energy";
  }

  return "System running efficiently";
}

module.exports = { detectActivity, getRecommendation };
