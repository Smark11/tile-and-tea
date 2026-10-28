import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type NavIconName = 'learn' | 'train' | 'play' | 'progress' | 'settings';

type NavIconProps = {
  name: NavIconName;
  color: string;
  size?: number;
  /** Active tabs get a soft tint inside the outline. */
  filled?: boolean;
};

/**
 * Line icons on a 24pt grid, drawn to match the tiles' hand-made feel. They're
 * decorative: the tab or button holding one carries the accessible label.
 */
export function NavIcon({ name, color, size = 26, filled = false }: NavIconProps) {
  // SVG shapes fill black by default, so every shape states its fill.
  const line = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const tinted = { ...line, fill: filled ? color : 'none', fillOpacity: 0.2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'learn' && (
        // An open book.
        <>
          <Path
            d="M12 6.6C10 5.1 7.2 4.6 3.8 5v13.4c3.4-.4 6.2.1 8.2 1.6 2-1.5 4.8-2 8.2-1.6V5c-3.4-.4-6.2.1-8.2 1.6Z"
            {...tinted}
          />
          <Path d="M12 6.6V20" {...line} />
        </>
      )}
      {name === 'train' && (
        // A target: each drill aims at one decision.
        <>
          <Circle cx={12} cy={12} r={8.6} {...tinted} />
          <Circle cx={12} cy={12} r={4.6} {...line} />
          <Circle cx={12} cy={12} r={1.5} fill={color} />
        </>
      )}
      {name === 'play' && (
        // Two tiles, one standing behind the other.
        <>
          <Rect x={9.4} y={3} width={10.6} height={14.6} rx={2.2} {...line} />
          <Rect x={4} y={6.4} width={10.6} height={14.6} rx={2.2} {...tinted} />
          <Circle cx={9.3} cy={13.7} r={2.2} {...line} />
        </>
      )}
      {name === 'progress' && (
        // Rising bars.
        <>
          <Rect x={3.6} y={12.4} width={4.2} height={7.6} rx={1.2} {...tinted} />
          <Rect x={9.9} y={8.2} width={4.2} height={11.8} rx={1.2} {...tinted} />
          <Rect x={16.2} y={4} width={4.2} height={16} rx={1.2} {...tinted} />
        </>
      )}
      {name === 'settings' && (
        // Sliders read as "adjust" more plainly than a gear.
        <>
          <Path d="M4 7.5h2.4M11.6 7.5H20M4 16.5h8.4M17.6 16.5H20" {...line} />
          <Circle cx={9} cy={7.5} r={2.6} {...line} />
          <Circle cx={15} cy={16.5} r={2.6} {...line} />
        </>
      )}
    </Svg>
  );
}
