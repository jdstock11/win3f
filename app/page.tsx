import OptionAnalyzer from "@/components/OptionAnalyzer";

export default function Home() {
  return (
    <main style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 className="gradient-text" style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
          Options Flow Analyzer
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
          Upload your NSE Option Chain data to decode market ratios instantly.
        </p>
      </header>
      
      <OptionAnalyzer />
    </main>
  );
}
