-- Read-only manifest for the supported actions-first Connected schema.
WITH extension_objects AS (
    SELECT d.objid
    FROM pg_depend d
    WHERE d.deptype = 'e'
), objects AS (
    SELECT 'extension'::text AS kind, e.extname AS identity, e.extname AS definition
    FROM pg_extension e
    WHERE e.extname <> 'plpgsql'

    UNION ALL

    SELECT 'relation', c.relname,
           concat_ws('|', c.relkind, c.relpersistence, c.relrowsecurity, c.relforcerowsecurity,
                     coalesce(c.relacl::text, ''))
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
      AND c.relname NOT IN ('schema_migrations', 'igris_schema_history')

    UNION ALL

    SELECT 'column', c.relname || '.' || a.attname,
           concat_ws('|', a.attnum, format_type(a.atttypid, a.atttypmod), a.attnotnull,
                     coalesce(pg_get_expr(ad.adbin, ad.adrelid), ''))
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND c.relname NOT IN ('schema_migrations', 'igris_schema_history')
      AND a.attnum > 0
      AND NOT a.attisdropped

    UNION ALL

    SELECT 'constraint', c.relname || '.' || con.conname,
           concat_ws('|', con.contype, pg_get_constraintdef(con.oid, true))
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname NOT IN ('schema_migrations', 'igris_schema_history')

    UNION ALL

    SELECT 'index', tc.relname || '.' || ic.relname, pg_get_indexdef(i.indexrelid)
    FROM pg_index i
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    WHERE n.nspname = 'public'
      AND tc.relname NOT IN ('schema_migrations', 'igris_schema_history')

    UNION ALL

    SELECT 'trigger', c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid, true)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND c.relname NOT IN ('schema_migrations', 'igris_schema_history')

    UNION ALL

    SELECT 'policy', c.relname || '.' || p.polname,
           concat_ws('|', p.polcmd, p.polpermissive,
                     ARRAY(SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY(p.polroles) ORDER BY r.rolname)::text,
                     coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
                     coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
           pg_get_functiondef(p.oid) || '|acl=' || coalesce(p.proacl::text, '')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid NOT IN (SELECT objid FROM extension_objects)

    UNION ALL

    SELECT 'type', t.typname,
           concat_ws('|', t.typtype, t.typcategory,
                     coalesce((SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
                               FROM pg_enum e WHERE e.enumtypid = t.oid), ''))
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype IN ('d', 'e')
      AND t.oid NOT IN (SELECT objid FROM extension_objects)

    UNION ALL

    SELECT 'sequence', c.relname,
           concat_ws('|', s.seqtypid::regtype::text, s.seqstart, s.seqincrement,
                     s.seqmax, s.seqmin, s.seqcache, s.seqcycle)
    FROM pg_sequence s
    JOIN pg_class c ON c.oid = s.seqrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname NOT IN ('schema_migrations_id_seq', 'igris_schema_history_id_seq')
)
SELECT kind || E'\x1f' || identity || E'\x1f' ||
       regexp_replace(
           regexp_replace(definition, E'[\n\r\t ]+', ' ', 'g'),
           'public\.', '', 'g'
       ) AS manifest_line
FROM objects
ORDER BY kind, identity, definition;
