# Directivas de Publicación

## Cuándo publicar

- **Automático**: cada merge a `main` pasa a staging
- **Manual a producción**: cuando staging esté estable por >30 min
- **Hotfix**: merge directo a `main` con etiqueta `[hotfix]`

## Versionado

Usamos [CalVer](https://calver.org/) simplificado: `YYYY.MM.DD-N`

- `2024.01.15-1` = primer deploy del día
- `2024.01.15-2` = segundo deploy del mismo día

## Checklist pre-deploy

- [ ] Tests pasan (`bun run test`)
- [ ] Typecheck limpio (`bunx tsc --noEmit`)
- [ ] Migraciones revisadas (si hay cambios de schema)
- [ ] Cambios de UI probados en staging
- [ ] No hay `.only` ni `console.log` de debug

## Proceso

1. Crear tag: `git tag -a 2024.01.15-1 -m "Deploy: fixes UI login"`
2. Push del tag: `git push origin 2024.01.15-1`
3. Verificar health check en producción
4. Anunciar en canal #deploys (si aplica)

## Rollback

- Último tag estable: `git revert` o redeploy del tag anterior
- Tiempo máximo para decidir rollback: 15 min tras deploy

## Qué NO publicar en viernes después de las 4pm

- Cambios de schema
- Features grandes sin test de humo
- Auth o pagos
