# EP3 Admin (new UX)

A React port of the EP3 Admin prototype (https://ep3-proto.vercel.app/), built with shadcn-style
components on Radix primitives. All flows, copy, validation and seed data match the prototype.

**Styling uses plain CSS — no Tailwind.** Components keep the shadcn APIs (`Button` variants,
`Dialog`, `Select`, `DropdownMenu`, …) but are styled by class names in `src/styles/*.css`,
driven by CSS variables in `src/styles/theme.css` (light + dark).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

Any username/password logs in. Data is seeded on first load and saved to `localStorage`
(clear site data to reset).

## Deploy (Vercel)

Import the repo in Vercel; `vercel.json` sets the Vite build (`npm run build` → `dist`) and rewrites
every non-asset path to `index.html`, so client routes like `/firm?id=…` work on refresh and deep links.

## Structure

```
src/
  components/ui/      shadcn components (button, select, dialog, alert-dialog, dropdown-menu, …)
  components/form/    form engine: FieldRow / ReadRow, SelectField, DateTimeField, FormDock, openFormSheet
  components/app/     shell (sidebar, layout), page scaffolding, action menus, list controls, section rail
  components/market/  Markets form engine and shared pieces
  data/               config, seed data and tooltips ported from the prototype
  lib/                store (useStore), firms & market data, form model, ask() dialog, toast, theme
  pages/auth/         Log In / Register
  pages/firms/        Firms list, firm detail + tabs, firm form, user/account/service/API key pages
  pages/market/       Instruments, Products, Calendars and instrument sub-pages
  styles/             theme.css, base.css, components.css, layout.css, firms.css, market.css
```

## Routes

| Route | Prototype page |
| --- | --- |
| `/` (`?register=true`) | Log In / Register |
| `/firms`, `/firm?id=&tab=`, `/firm-new?type=`, `/firm-edit?id=` | Firms |
| `/user`, `/account`, `/service`, `/api-key` (`?firm=&id=&mode=new\|edit`), `/api-keys?firm=&service=` | Firm records |
| `/instruments`, `/instrument`, `/instrument-state`, `/instrument-stats`, `/instrument-history`, `/books` | Instruments |
| `/products`, `/product`, `/calendars` | Products, Calendars |
