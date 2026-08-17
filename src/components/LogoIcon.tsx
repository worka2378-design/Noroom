import React from 'react';

interface LogoIconProps {
  className?: string;
}

export const LogoIcon: React.FC<LogoIconProps> = ({ className = 'w-6 h-6' }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 318 333"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        fillRule: 'evenodd',
        clipRule: 'evenodd',
        strokeLinejoin: 'round',
        strokeMiterlimit: 2,
      }}
      aria-hidden="true"
    >
      <g transform="matrix(1,0,0,1,-788.602414,-166.23302)">
        <path
          d="M828.218,166.233L884.451,166.233L1009.53,350L1009.53,166.233L1106.286,166.233L1106.286,449.64C1104.157,449.244 1101.962,449.037 1099.719,449.037C1079.991,449.037 1063.973,465.054 1063.973,484.783C1063.973,489.61 1064.932,494.216 1066.67,498.418L1009.53,498.418L885.131,316.011L885.131,498.418L788.602,498.418L788.602,215.011C790.731,215.407 792.926,215.614 795.169,215.614C814.898,215.614 830.915,199.597 830.915,179.868C830.915,175.041 829.956,170.436 828.218,166.233Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
};
