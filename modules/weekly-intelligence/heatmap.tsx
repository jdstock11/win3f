import React from "react";
import { OptionChainRow } from "./types";
import { formatNumber } from "./utils";

interface HeatmapProps {
  chain: OptionChainRow[];
}

export const StrikeHeatmap: React.FC<HeatmapProps> = ({ chain }) => {
  // Find max OI for intensity mapping
  let maxCeOi = 0;
  let maxPeOi = 0;
  
  chain.forEach(row => {
    if (row.CE && row.CE.openInterest > maxCeOi) maxCeOi = row.CE.openInterest;
    if (row.PE && row.PE.openInterest > maxPeOi) maxPeOi = row.PE.openInterest;
  });

  const getIntensityColor = (val: number, max: number, type: "CE" | "PE") => {
    if (max === 0 || val === 0) return "transparent";
    const intensity = Math.min(val / max, 1);
    // CE = Red hue, PE = Green hue
    return type === "CE" 
      ? `rgba(239, 68, 68, ${intensity * 0.8})` 
      : `rgba(34, 197, 94, ${intensity * 0.8})`;
  };

  // Only show strikes that have some meaningful data to avoid massive empty grids
  const displayChain = chain.filter(r => (r.CE?.openInterest || 0) > 0 || (r.PE?.openInterest || 0) > 0);

  return (
    <div style={{ backgroundColor: '#1e2130', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2d3142', marginTop: '1.5rem' }}>
      <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>Strike Open Interest Heatmap</h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', color: '#9ca3af', borderBottom: '1px solid #2d3142' }}>Call OI</th>
              <th style={{ padding: '0.75rem', color: '#fff', borderBottom: '1px solid #2d3142', backgroundColor: '#161925' }}>Strike</th>
              <th style={{ padding: '0.75rem', color: '#9ca3af', borderBottom: '1px solid #2d3142' }}>Put OI</th>
            </tr>
          </thead>
          <tbody>
            {displayChain.map(row => {
              const ceOi = row.CE?.openInterest || 0;
              const peOi = row.PE?.openInterest || 0;
              
              return (
                <tr key={row.strikePrice}>
                  <td style={{ 
                    padding: '0.5rem', 
                    backgroundColor: getIntensityColor(ceOi, maxCeOi, "CE"),
                    color: ceOi > maxCeOi * 0.5 ? '#fff' : '#9ca3af',
                    transition: 'all 0.2s'
                  }}>
                    {formatNumber(ceOi)}
                  </td>
                  <td style={{ 
                    padding: '0.5rem', 
                    fontWeight: 'bold', 
                    color: '#fff',
                    backgroundColor: '#161925',
                    borderLeft: '1px solid #2d3142',
                    borderRight: '1px solid #2d3142'
                  }}>
                    {row.strikePrice}
                  </td>
                  <td style={{ 
                    padding: '0.5rem', 
                    backgroundColor: getIntensityColor(peOi, maxPeOi, "PE"),
                    color: peOi > maxPeOi * 0.5 ? '#fff' : '#9ca3af',
                    transition: 'all 0.2s'
                  }}>
                    {formatNumber(peOi)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
