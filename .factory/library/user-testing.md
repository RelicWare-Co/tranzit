# User Testing

## Validation Surface

The admin panel is a web application validated via browser (agent-browser).

## Testing Approach

### Manual Validation
Workers should manually test each page redesign:
1. Navigate to the page
2. Interact with all controls
3. Verify no console errors
4. Take screenshots

### Validation Contract Coverage
The validation contract has assertions for:
- Layout & Navigation (4 assertions)
- Login (4 assertions)
- Dashboard (3 assertions)
- Citas (4 assertions)
- Usuarios (5 assertions)
- Trámites (5 assertions)
- Reportes (4 assertions)
- Auditoría (4 assertions)
- Configuración (6 assertions)
- Cross-area flows (2 assertions)
- Design quality (4 assertions)

## Resource Cost Classification

Each admin page requires:
- ~300MB RAM for browser instance
- ~1-2 minutes per page for full interaction test

Max concurrent validators: 3 (given typical machine resources)
