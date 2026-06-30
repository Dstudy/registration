import React from 'react';

type EllipseRingsProps = {
  color?: string;
  strokeWidth?: number;
  size?: number;
  className?: string;
};

const EllipseRings: React.FC<EllipseRingsProps> = ({
  color = '#A5B4FC',
  strokeWidth = 1,
  size = 100,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 140"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse
        cx="40" cy="70" rx="25" ry="60"
        stroke={color}
        strokeWidth={strokeWidth}
      />

      <ellipse
        cx="55" cy="70" rx="25" ry="60"
        stroke={color}
        strokeWidth={strokeWidth}
      />

      <ellipse
        cx="70" cy="70" rx="25" ry="60"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

export default EllipseRings;