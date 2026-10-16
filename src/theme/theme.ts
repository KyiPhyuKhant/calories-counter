const brand = {
  primary: '#21865A', primaryDark: '#075A43', primaryLight: '#A7D68E',
  background: '#FAFAF7', text: '#17233B', border: '#E2E8E5',
} as const;

export const theme = {
  colors: {
    ...brand,
    surface: '#FFFFFF',
    surfaceMuted: '#F0F4EF',
    secondaryText: '#566176',
    onPrimary: '#FFFFFF',
    accent: brand.primaryDark,
    accentSurface: brand.primaryLight,
    danger: '#B42318',
    onDanger: '#FFFFFF',
    dangerSurface: '#FFF1F0',
    warning: '#945022',
    planning: brand.primary,
    planningSurface: '#EEF5EA',
    planningBorder: brand.border,
    mealPlan: brand.primaryDark,
    onMealPlan: '#FFFFFF',
    mealPlanSurface: '#EEF5EA',
    mealPlanBorder: brand.border,
  },
  spacing: {
    extraSmall: 4,
    small: 8,
    regular: 12,
    medium: 16,
    large: 24,
    extraLarge: 32,
  },
  radius: { small: 8, control: 12, card: 16 },
  typography: {
    // Natural line metrics preserve Myanmar combining marks at every text size.
    title: { fontSize: 24, lineHeight: undefined, fontWeight: '700' },
    heading: { fontSize: 20, lineHeight: undefined, fontWeight: '600' },
    body: { fontSize: 16, lineHeight: undefined },
    label: { fontSize: 15, lineHeight: undefined, fontWeight: '600' },
    caption: { fontSize: 14, lineHeight: undefined },
    button: { fontSize: 16, lineHeight: undefined, fontWeight: '600' },
    metric: { fontSize: 28, lineHeight: undefined, fontWeight: '700' },
  },
  shadow: {
    card: { shadowColor: brand.text, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  },
} as const;

export const uiStyles = {
  page: { paddingHorizontal: theme.spacing.medium, paddingVertical: theme.spacing.regular, gap: theme.spacing.regular, width: '100%', maxWidth: 560, alignSelf: 'center' },
  field: { gap: theme.spacing.extraSmall },
  input: { minHeight: 48, paddingHorizontal: theme.spacing.regular, paddingVertical: theme.spacing.small, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.surface },
  button: { minHeight: 48, paddingHorizontal: theme.spacing.medium, paddingVertical: theme.spacing.regular, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
} as const;
