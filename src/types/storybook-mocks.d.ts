import '@storybook/nextjs/navigation.mock';
import '@storybook/nextjs/router.mock';

// Storybook 10.6 exports these initializers at runtime but omits their declarations.
// Limit the compatibility declarations to the empty overrides used by test setup.
declare module '@storybook/nextjs/navigation.mock' {
  export function createNavigation(overrides: Record<string, never>): void;
}

declare module '@storybook/nextjs/router.mock' {
  export function createRouter(overrides: Record<string, never>): void;
}
