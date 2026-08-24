export const Colors = {
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    text: '#16181D',
    textMuted: '#606672',
    border: '#E1E4E8',
    primary: '#2854C5',
    accentSoft: '#E5ECFF',
    success: '#16845B',
    successSoft: '#DFF5EC',
    warning: '#B66A12',
    warningSoft: '#FFF0D7',
    danger: '#C33C48',
    dangerSoft: '#FCE3E6',
  },
  dark: {
    background: '#101216',
    surface: '#1A1D23',
    text: '#F4F5F7',
    textMuted: '#A9AFBA',
    border: '#2C313A',
    primary: '#8EACFF',
    accentSoft: '#23315B',
    success: '#4BC493',
    successSoft: '#183D31',
    warning: '#F1A84B',
    warningSoft: '#4A321B',
    danger: '#FF7E89',
    dangerSoft: '#492329',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
} as const;
