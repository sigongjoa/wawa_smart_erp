/**
 * Shared style utilities
 * Common styles used across components for consistency
 */
import type { CSSProperties } from 'react';

/** Common colors used throughout the app */
export const colors = {
  // Primary
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryLight: '#eff6ff',

  // Accent
  accent: '#facc15',
  accentDark: '#ca8a04',

  // Status
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningLight: '#fefce8',
  error: '#dc2626',
  errorLight: '#fef2f2',

  // Neutral
  text: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#d1d5db',
  borderLight: '#e5e7eb',
  background: '#f3f4f6',
  backgroundAlt: '#f9fafb',
  white: '#ffffff',

  // Admin specific
  adminHeader: '#1e40af',
} as const;

/** Common spacing values */
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
} as const;

/** Common border radius values */
export const borderRadius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

/** Common font sizes */
export const fontSize = {
  xs: '12px',
  sm: '13px',
  base: '14px',
  lg: '16px',
  xl: '18px',
  xxl: '20px',
  xxxl: '28px',
} as const;

/** Common button styles */
export const buttonStyles = {
  base: {
    padding: '8px 16px',
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: fontSize.base,
    transition: 'background-color 0.2s',
  } as CSSProperties,

  primary: {
    backgroundColor: colors.primary,
    color: colors.white,
  } as CSSProperties,

  secondary: {
    backgroundColor: colors.backgroundAlt,
    color: colors.text,
  } as CSSProperties,

  accent: {
    backgroundColor: colors.accent,
    color: colors.text,
    fontWeight: '600',
  } as CSSProperties,

  ghost: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: colors.white,
  } as CSSProperties,

  disabled: {
    backgroundColor: colors.border,
    color: colors.textMuted,
    cursor: 'not-allowed',
  } as CSSProperties,
} as const;

/** Common input styles */
export const inputStyles = {
  base: {
    padding: '8px 12px',
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
    fontSize: fontSize.lg,
    outline: 'none',
    transition: 'border-color 0.2s',
  } as CSSProperties,

  focus: {
    borderColor: colors.primary,
  } as CSSProperties,
} as const;

/** Common card styles */
export const cardStyles = {
  base: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  } as CSSProperties,

  header: {
    padding: `${spacing.xl} ${spacing.xxl}`,
    borderBottom: `1px solid ${colors.borderLight}`,
  } as CSSProperties,

  body: {
    padding: spacing.xxl,
  } as CSSProperties,
} as const;

/** Common badge/pill styles */
export const badgeStyles = {
  base: {
    padding: '2px 8px',
    fontSize: fontSize.xs,
    borderRadius: borderRadius.full,
    fontWeight: '500',
  } as CSSProperties,

  success: {
    backgroundColor: colors.successLight,
    color: '#166534',
  } as CSSProperties,

  warning: {
    backgroundColor: colors.warningLight,
    color: '#854d0e',
  } as CSSProperties,

  error: {
    backgroundColor: colors.errorLight,
    color: colors.error,
  } as CSSProperties,

  neutral: {
    backgroundColor: colors.background,
    color: colors.textSecondary,
  } as CSSProperties,
} as const;

/** Common table styles */
export const tableStyles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  } as CSSProperties,

  headerRow: {
    backgroundColor: colors.backgroundAlt,
  } as CSSProperties,

  headerCell: {
    padding: `${spacing.md} ${spacing.xxl}`,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'left',
  } as CSSProperties,

  cell: {
    padding: `${spacing.lg} ${spacing.xxl}`,
    borderBottom: `1px solid ${colors.borderLight}`,
  } as CSSProperties,

  cellCenter: {
    textAlign: 'center',
  } as CSSProperties,
} as const;

/** Helper to merge styles */
export const mergeStyles = (...styles: (CSSProperties | undefined)[]): CSSProperties => {
  return Object.assign({}, ...styles.filter(Boolean));
};

/** Helper to create a style with color-based background opacity */
export const withOpacity = (hexColor: string, opacity: number): string => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
