'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useV130Analyzer } from '@/hooks/useV130Analyzer';

interface MasterAnalyzerProps {
  audioGraphRef: React.RefObject<any>;
  className?: string;
  style?: React.CSSProperties;
}

export const MasterAnalyzer: React.FC<MasterAnalyzerProps> = ({
  audioGraphRef,
  className = '',
  style = {},
}) => {
  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasMRef = useRef<HTMLCanvasElement>(null);
  const analyzer = useV130Analyzer(audioGraphRef);

  const [readouts, setReadouts] = useState({
    LUFS: '–',
    TP: '–',
    RMS: '–',
    Phase: '–',
    Stereo: '–',
    GR: '–',
  });

  const [masterPeak, setMasterPeak] = useState<string>('–∞');

  useEffect(() => {
    if (canvasARef.current) {
      analyzer.attachCanvasA(canvasARef.current);
    }
  }, [analyzer]);

  useEffect(() => {
    if (canvasMRef.current) {
      analyzer.attachCanvasM(canvasMRef.current);
    }
  }, [analyzer]);

  useEffect(() => {
    const interval = setInterval(() => {
      const vals = analyzer.readouts?.getValues?.();
      if (vals) {
        setReadouts(vals);
        const met = analyzer.MET;
        if (met && met.L !== undefined && met.R !== undefined) {
          const peak = Math.max(met.L, met.R);
          if (peak > 1e-6) {
            const peakDb = 20 * Math.log10(peak);
            setMasterPeak(peakDb.toFixed(1));
          } else {
            setMasterPeak('–∞');
          }
        }
      }
    }, 16);

    return () => clearInterval(interval);
  }, [analyzer]);

  return (
    <section
      className={`master-analyzer pn ${className}`}
      id="ana"
      data-m="master"
      style={style}
    >
      <div className="ph">
        <span className="pt">Master analyzer</span>
        <span className="sp"></span>
        <span
          id="aHint"
          style={{
            color: 'var(--dm)',
            fontWeight: 400,
            fontSize: '11px',
          }}
        >
          Post-limiter
        </span>
      </div>

      <div className="anb">
        <div>
          <div className="seg" id="aTabs">
            {(
              [
                ['spec', 'Spectrum'],
                ['lufs', 'LUFS'],
                ['phase', 'Phase'],
                ['wid', 'Stereo'],
                ['rms', 'RMS'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                data-k={key}
                aria-pressed={analyzer.activeTab === key}
                onClick={() => analyzer.setActiveTab(key)}
                style={{
                  padding: '4px 8px',
                  margin: '0 2px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid var(--ln)',
                  borderRadius: '3px',
                  background:
                    analyzer.activeTab === key ? 'var(--ac)' : 'transparent',
                  color:
                    analyzer.activeTab === key ? 'var(--bg)' : 'var(--tx)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <canvas
            ref={canvasARef}
            id="cvA"
            width={300}
            height={286}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              background: '#060b0e',
              borderRadius: '3px',
              marginTop: '4px',
            }}
          />

          <div
            className="ast num"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginTop: '8px',
              padding: '8px',
              background: 'var(--p)',
              borderRadius: '3px',
              fontSize: '11px',
            }}
          >
            {[
              { label: 'LUFS-I', id: 'sL', key: 'LUFS' },
              {
                label: 'dBTP',
                id: 'sT',
                key: 'TP',
                title: 'True peak, 4× interpolated',
              },
              { label: 'RMS', id: 'sR', key: 'RMS' },
              { label: 'Phase', id: 'sP', key: 'Phase' },
              { label: 'Stereo', id: 'sW', key: 'Stereo' },
              {
                label: 'GR dB',
                id: 'sG',
                key: 'GR',
                title: 'Gain reduction: compressor + limiter',
              },
            ].map(({ label, id, key, title }) => (
              <div
                key={id}
                id={id}
                title={title}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  padding: '4px',
                  background: 'var(--p2)',
                  borderRadius: '2px',
                }}
              >
                <span style={{ fontSize: '9px', color: 'var(--dm)' }}>
                  {label}
                </span>
                <b
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--ac)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {readouts[key as keyof typeof readouts]}
                </b>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mm"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            background: 'var(--p)',
            borderRadius: '3px',
            marginTop: '8px',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--tx)',
            }}
          >
            Master
          </span>

          <canvas
            ref={canvasMRef}
            id="cvM"
            width={56}
            height={300}
            style={{
              display: 'block',
              background: '#060b0e',
              borderRadius: '2px',
              border: '1px solid var(--ln)',
            }}
          />

          <b
            id="mOut"
            className="num"
            style={{
              fontSize: '11px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--ac)',
            }}
          >
            {masterPeak}
          </b>

          <span style={{ fontSize: '9px', color: 'var(--dm)' }}>dB peak</span>
        </div>
      </div>

      <style>{`
        .master-analyzer {
          background: linear-gradient(180deg, var(--p2), var(--p));
          border: 1px solid var(--ln);
          border-radius: 7px;
          position: relative;
          overflow: hidden;
          transition: box-shadow 0.2s;
        }

        .master-analyzer .ph {
          height: 28px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border-bottom: 1px solid var(--ln);
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #b9ced3;
        }

        .master-analyzer .ph .pt {
          flex: 0 0 auto;
        }

        .master-analyzer .ph .sp {
          flex: 1;
        }

        .master-analyzer .anb {
          display: flex;
          gap: 8px;
          padding: 8px;
        }

        .master-analyzer .anb > div:first-child {
          flex: 1;
          min-width: 0;
        }

        .master-analyzer #aTabs {
          display: flex;
          gap: 4px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }

        .master-analyzer #aTabs button {
          flex: 1;
          min-width: 60px;
        }

        .master-analyzer .ast {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 8px;
          background: var(--p2);
          border-radius: 3px;
        }

        .master-analyzer .ast > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px;
          background: var(--p3);
          border-radius: 2px;
          border: 1px solid var(--ln2);
        }

        .master-analyzer .ast span {
          font-size: 9px;
          color: var(--dm);
          font-weight: 500;
        }

        .master-analyzer .ast b {
          font-size: 13px;
          font-weight: 700;
          color: var(--ac);
          font-variant-numeric: tabular-nums;
        }

        .master-analyzer .mm {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px;
          background: var(--p2);
          border-radius: 3px;
          width: 80px;
          align-items: center;
        }

        .master-analyzer .mm span {
          font-size: 10px;
          color: var(--dm);
          text-align: center;
        }

        .master-analyzer .mm b {
          font-size: 11px;
          color: var(--ac);
          font-variant-numeric: tabular-nums;
        }

        .master-analyzer #cvA {
          width: 100%;
          height: auto;
          max-width: 100%;
          display: block;
        }

        .master-analyzer #cvM {
          width: 100%;
          max-width: 56px;
          height: 300px;
        }
      `}</style>
    </section>
  );
};

export default MasterAnalyzer;
