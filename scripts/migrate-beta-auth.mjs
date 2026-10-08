process.stderr.write('migrate-beta-auth.mjs foi substituído pelas migrations versionadas 004 e 005. Executando o migrador canônico.\n')
await import('./apply-supabase-migrations.mjs')
