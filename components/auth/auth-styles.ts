// Shared field/button styling for auth forms — keeps login, register and
// password-reset visually identical. Token-driven so both themes work.

export const authInputClass =
  'w-full rounded-lg border border-input bg-muted/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/25';

export const authPrimaryButtonClass =
  'btn-sheen w-full rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100';

export const authLabelClass = 'mb-1.5 block text-sm font-medium text-foreground';
