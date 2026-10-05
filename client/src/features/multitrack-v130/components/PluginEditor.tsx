import React from 'react';
import { ParameterKnob } from './ParameterKnob';
import styles from './PluginEditor.module.css';

interface PluginEditorProps {
  plugin: any | null; // Plugin interface from store
  onParameterChange: (paramName: string, value: number) => void;
  onBypassToggle: () => void;
}

/**
 * Plugin Editor Component
 * Shows selected plugin parameters with knobs/sliders
 * Displays: Plugin name, bypass toggle, parameter controls, metering
 */
export const PluginEditor: React.FC<PluginEditorProps> = ({
  plugin,
  onParameterChange,
  onBypassToggle,
}) => {
  if (!plugin) {
    return (
      <div className={styles.pluginEditor}>
        <div className={styles.empty}>
          <p>Select a plugin to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pluginEditor}>
      <div className={styles.editorHeader}>
        <h3 className={styles.pluginName}>{plugin.name}</h3>
        <button 
          className={`btn ${plugin.bypassed ? 'on' : ''}`}
          onClick={onBypassToggle}
          title="Bypass plugin"
          aria-pressed={plugin.bypassed}
        >
          {plugin.bypassed ? 'BYPASSED' : 'ACTIVE'}
        </button>
      </div>

      <div className={styles.editorParams}>
        {/* R3 Compressor Parameters */}
        {plugin.type === 'compressor' && plugin.params && (
          <>
            <ParameterKnob
              label="Threshold"
              value={plugin.params.threshold || -20}
              min={-60}
              max={0}
              unit=" dB"
              onChange={(v) => onParameterChange('threshold', v)}
            />
            <ParameterKnob
              label="Ratio"
              value={plugin.params.ratio || 4}
              min={1}
              max={20}
              onChange={(v) => onParameterChange('ratio', v)}
            />
            <ParameterKnob
              label="Attack"
              value={plugin.params.attack || 10}
              min={0.1}
              max={1000}
              unit=" ms"
              onChange={(v) => onParameterChange('attack', v)}
            />
            <ParameterKnob
              label="Release"
              value={plugin.params.release || 100}
              min={10}
              max={5000}
              unit=" ms"
              onChange={(v) => onParameterChange('release', v)}
            />
            <ParameterKnob
              label="Makeup Gain"
              value={plugin.params.makeupGain || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('makeupGain', v)}
            />
            <ParameterKnob
              label="Knee"
              value={plugin.params.knee || 0}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => onParameterChange('knee', v)}
            />
          </>
        )}

        {/* R3 EQ Parameters */}
        {plugin.type === 'eq' && plugin.params && (
          <>
            <ParameterKnob
              label="Low"
              value={plugin.params.low || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('low', v)}
            />
            <ParameterKnob
              label="Mid"
              value={plugin.params.mid || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('mid', v)}
            />
            <ParameterKnob
              label="High"
              value={plugin.params.high || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('high', v)}
            />
          </>
        )}
      </div>

      {plugin.metrics && (
        <div className={styles.editorMeters}>
          <div className={styles.meterGroup}>
            <label>Input</label>
            <div className={styles.meterDisplay}>
              {plugin.metrics.input?.toFixed(1) ?? '−∞'} dB
            </div>
          </div>
          <div className={styles.meterGroup}>
            <label>GR</label>
            <div className={styles.meterDisplay}>
              {plugin.metrics.gainReduction?.toFixed(1) ?? '0.0'} dB
            </div>
          </div>
          <div className={styles.meterGroup}>
            <label>Output</label>
            <div className={styles.meterDisplay}>
              {plugin.metrics.output?.toFixed(1) ?? '−∞'} dB
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginEditor;
