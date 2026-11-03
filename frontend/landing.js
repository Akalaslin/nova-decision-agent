// fade sections in as they scroll into view
try {
  document.documentElement.classList.add("reveal-ready");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
} catch (e) {
  document.documentElement.classList.remove("reveal-ready");
}
// wake the free backend in the background while the visitor reads the landing page
(function () {
  if (["localhost", "127.0.0.1", ""].indexOf(location.hostname) !== -1) return;
  try { fetch("https://nova-decision-agent.onrender.com/health", { mode: "no-cors" }); } catch (e) { /* ignore */ }
})();