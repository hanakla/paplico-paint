# Paplico Paint (@paplico/web)

Paplico Paint is frontend of `@paplico/core` drawing engine.  
Made with Next.js

## Technology Stack

TypeScript / Next.js / React / React Hooks / styled-components

## Structure

- `domains/`  
  Core state managements
- `hooks/`  
  React Hooks of Pap's domain logics.
- `components/`  
  Reusable, stateless components
- `containers/`  
  Complex components(Fragment of views) likes connected PaplicoEngine state
- `features/*`
  Feature specific component, containers, view logic and hooks
- `pages/`  
  Next.js pages directory.
