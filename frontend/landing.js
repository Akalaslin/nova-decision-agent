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