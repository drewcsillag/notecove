fix these tests
pnpm --filter @notecove/desktop test:e2e e2e/cross-machine-sync-deletion-sloppy.spec.ts:249 e2e/cross-machine-sync-instances.spec.ts:251 e2e/cross-machine-sync-instances.spec.ts:86 e2e/multi-sd-cross-instance.spec.ts:906 e2e/tags.spec.ts:419
They fail pretty reliably
