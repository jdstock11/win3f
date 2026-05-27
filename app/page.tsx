import OptionAnalyzer from "@/components/OptionAnalyzer";

export default function Home() {
  return (
    <main style={{ padding: "2rem", maxWidth: "1600px", margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 className="gradient-text" style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
          Institutional Derivatives Analytics
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
          Advanced Options Rollover, Calendar Spread Engine & Smart Money Positioning
        </p>
      </header>
      
      <OptionAnalyzer />
    </main>
  );
}
