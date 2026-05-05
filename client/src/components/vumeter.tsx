interface VUMeterProps {
  level?: number;
  className?: string;
}

export const VUMeter = ({ level = 0, className = '' }: VUMeterProps) => {
  return (
    <div className={`vu-meter ${className}`}>
      <div 
        className="vu-meter-bar"
        style={{ height: `${level * 100}%` }}
      />
    </div>
  );
};