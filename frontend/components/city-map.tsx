'use client';
import type { DistrictId } from '@/lib/types';
const regions: { id: DistrictId; name: string; path: string; x: number; y: number }[] = [
  {
    id: 'saryarka',
    name: 'Сарыарка',
    path: 'M44 44 L231 26 L252 92 L227 141 L141 153 L50 113 Z',
    x: 132,
    y: 83,
  },
  {
    id: 'baikonur',
    name: 'Байконур',
    path: 'M242 25 L420 43 L432 126 L343 143 L263 92 Z',
    x: 331,
    y: 83,
  },
  {
    id: 'almaty',
    name: 'Алматы',
    path: 'M345 154 L439 139 L498 212 L472 283 L370 264 L328 209 Z',
    x: 421,
    y: 203,
  },
  {
    id: 'esil',
    name: 'Есиль',
    path: 'M150 168 L232 154 L261 110 L335 158 L313 210 L356 270 L298 306 L181 271 L125 214 Z',
    x: 246,
    y: 218,
  },
  {
    id: 'nura',
    name: 'Нура',
    path: 'M34 130 L136 166 L108 215 L168 281 L286 318 L211 353 L68 310 L22 214 Z',
    x: 91,
    y: 254,
  },
];
export function CityMap({
  selected,
  onSelect,
  hero = false,
}: {
  selected?: DistrictId;
  onSelect?: (id: DistrictId) => void;
  hero?: boolean;
}) {
  return (
    <div className={`city-map ${hero ? 'hero-map' : ''}`}>
      <svg
        viewBox="0 0 530 380"
        role={onSelect ? 'group' : 'img'}
        aria-label="Условная интерактивная схема пяти районов Астаны"
      >
        <defs>
          <pattern
            id={hero ? 'hero-grid' : 'map-grid'}
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path d="M22 0H0V22" fill="none" stroke="currentColor" strokeWidth=".6" />
          </pattern>
          <pattern
            id={hero ? 'hero-lines' : 'map-lines'}
            width="19"
            height="19"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(23)"
          >
            <path d="M0 0V19 M0 10H19" stroke="currentColor" opacity=".1" fill="none" />
          </pattern>
        </defs>
        <rect
          width="530"
          height="380"
          fill={`url(#${hero ? 'hero-grid' : 'map-grid'})`}
          className="map-grid"
        />
        {regions.map((r, i) => (
          <g
            key={r.id}
            className={`map-region ${selected === r.id ? 'selected' : ''} region-${r.id}`}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`${r.name}${selected === r.id ? ', выбран' : ''}`}
            aria-pressed={onSelect ? selected === r.id : undefined}
            onClick={() => onSelect?.(r.id)}
            onKeyDown={(e) => {
              if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelect(r.id);
              }
            }}
          >
            <path d={r.path} className="region-shape" />
            <path
              d={r.path}
              fill={`url(#${hero ? 'hero-lines' : 'map-lines'})`}
              pointerEvents="none"
            />
            <circle cx={r.x} cy={r.y - 17} r="4" className="region-dot" />
            <text x={r.x} y={r.y + 6} textAnchor="middle">
              {r.name}
            </text>
            <text className="map-score" x={r.x} y={r.y + 25} textAnchor="middle">
              {[54.65, 56.63, 57.06, 62.99, 49.18][i].toLocaleString('ru-RU')}
            </text>
          </g>
        ))}
        <path
          d="M-5 136 C95 104 92 181 180 166 S298 126 335 185 S458 237 542 221"
          className="river"
        />
        <path
          d="M-5 136 C95 104 92 181 180 166 S298 126 335 185 S458 237 542 221"
          className="river-highlight"
        />
        <text x="275" y="165" className="river-label" transform="rotate(15 275 165)">
          ЕСИЛЬ
        </text>
        <g className="map-landmark" transform="translate(246 171)">
          <path d="M-4 27 L-2 1 H2 L4 27 M-8 27H8" />
          <circle cy="-6" r="8" />
        </g>
        <g transform="translate(492 35)" className="compass">
          <text y="-9" textAnchor="middle">
            С
          </text>
          <path d="M0 0L-5 17L0 13L5 17Z" />
        </g>
      </svg>
      <span className="map-caption">Схема районов · Исходные оценки</span>
    </div>
  );
}
