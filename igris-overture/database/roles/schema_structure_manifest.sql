-- PostgreSQL 16 structural manifest, version 2.
--
-- Every output expression is text before it reaches VALUES or UNION type
-- resolution. The Go encoder hashes these five structured fields with null
-- markers and length prefixes; this query must not concatenate row fields.
WITH extension_objects AS (
    SELECT d.classid, d.objid
    FROM pg_depend d
    WHERE d.deptype = 'e'
), manifest(object_type, schema_name, object_identity, attribute_name, attribute_value) AS (
    SELECT 'extension'::text, n.nspname::text, e.extname::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    CROSS JOIN LATERAL (VALUES
        ('version'::text, e.extversion::text),
        ('relocatable'::text, e.extrelocatable::text)
    ) AS a(attribute_name, attribute_value)
    WHERE e.extname <> 'plpgsql'

    UNION ALL

    SELECT 'relation'::text, n.nspname::text, c.relname::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_am am ON am.oid = c.relam
    CROSS JOIN LATERAL (VALUES
        ('kind'::text, c.relkind::text),
        ('persistence'::text, c.relpersistence::text),
        ('row_security'::text, c.relrowsecurity::text),
        ('force_row_security'::text, c.relforcerowsecurity::text),
        ('replica_identity'::text, c.relreplident::text),
        ('access_method'::text, am.amname::text),
        ('partition_bound'::text, pg_get_expr(c.relpartbound, c.oid, true)::text),
        ('partition_key'::text, pg_get_partkeydef(c.oid)::text)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'c')

    UNION ALL

    SELECT 'relation_option'::text, n.nspname::text, c.relname::text,
           'option'::text, option_value::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(c.reloptions) AS option_value
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'c')

    UNION ALL

    SELECT 'column'::text, n.nspname::text,
           format('%I.%I', c.relname, att.attname)::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_attribute att
    JOIN pg_class c ON c.oid = att.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = att.attrelid AND ad.adnum = att.attnum
    CROSS JOIN LATERAL (VALUES
        ('ordinal'::text, att.attnum::text),
        ('data_type'::text, format_type(att.atttypid, att.atttypmod)::text),
        ('not_null'::text, att.attnotnull::text),
        ('identity'::text, att.attidentity::text),
        ('generated'::text, att.attgenerated::text),
        ('compression'::text, att.attcompression::text),
        ('storage'::text, att.attstorage::text),
        ('collation'::text, CASE WHEN att.attcollation = 0 THEN NULL::text ELSE att.attcollation::regcollation::text END),
        ('default'::text, pg_get_expr(ad.adbin, ad.adrelid, true)::text)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'c')
      AND att.attnum > 0
      AND NOT att.attisdropped

    UNION ALL

    SELECT 'constraint'::text, n.nspname::text,
           format('%I.%I', COALESCE(c.relname, typ.typname), con.conname)::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_constraint con
    LEFT JOIN pg_class c ON c.oid = con.conrelid AND con.conrelid <> 0
    LEFT JOIN pg_type typ ON typ.oid = con.contypid AND con.contypid <> 0
    JOIN pg_namespace n ON n.oid = COALESCE(c.relnamespace, typ.typnamespace)
    CROSS JOIN LATERAL (VALUES
        ('definition'::text, pg_get_constraintdef(con.oid, true)::text),
        ('type'::text, con.contype::text),
        ('validated'::text, con.convalidated::text),
        ('deferrable'::text, con.condeferrable::text),
        ('initially_deferred'::text, con.condeferred::text),
        ('no_inherit'::text, con.connoinherit::text),
        ('local_columns'::text, con.conkey::text),
        ('referenced_columns'::text, con.confkey::text),
        ('referenced_relation'::text,
            CASE WHEN con.confrelid = 0 THEN NULL::text
                 ELSE (SELECT format('%I.%I', rn.nspname, rc.relname)::text
                       FROM pg_class rc JOIN pg_namespace rn ON rn.oid = rc.relnamespace
                       WHERE rc.oid = con.confrelid) END),
        ('foreign_update_action'::text, CASE WHEN con.contype = 'f' THEN con.confupdtype::text ELSE NULL::text END),
        ('foreign_delete_action'::text, CASE WHEN con.contype = 'f' THEN con.confdeltype::text ELSE NULL::text END),
        ('foreign_match_type'::text, CASE WHEN con.contype = 'f' THEN con.confmatchtype::text ELSE NULL::text END)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'index'::text, n.nspname::text,
           format('%I.%I', tc.relname, ic.relname)::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_index i
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    JOIN pg_am am ON am.oid = ic.relam
    CROSS JOIN LATERAL (VALUES
        ('definition'::text, pg_get_indexdef(i.indexrelid)::text),
        ('predicate'::text, pg_get_expr(i.indpred, i.indrelid, true)::text),
        ('expressions'::text, pg_get_expr(i.indexprs, i.indrelid, true)::text),
        ('unique'::text, i.indisunique::text),
        ('primary'::text, i.indisprimary::text),
        ('exclusion'::text, i.indisexclusion::text),
        ('immediate'::text, i.indimmediate::text),
        ('valid'::text, i.indisvalid::text),
        ('ready'::text, i.indisready::text),
        ('live'::text, i.indislive::text),
        ('replica_identity'::text, i.indisreplident::text),
        ('clustered'::text, i.indisclustered::text),
        ('nulls_not_distinct'::text, i.indnullsnotdistinct::text),
        ('access_method'::text, am.amname::text)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'trigger'::text, n.nspname::text,
           format('%I.%I', c.relname, t.tgname)::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    CROSS JOIN LATERAL (VALUES
        ('definition'::text, pg_get_triggerdef(t.oid, true)::text),
        ('function_identity'::text,
            format('%I.%I(%s)', pn.nspname, p.proname, pg_get_function_identity_arguments(p.oid))::text),
        ('enabled_mode'::text, t.tgenabled::text),
        ('row_scope'::text, ((t.tgtype & 1) <> 0)::text),
        ('before'::text, ((t.tgtype & 2) <> 0)::text),
        ('insert_event'::text, ((t.tgtype & 4) <> 0)::text),
        ('delete_event'::text, ((t.tgtype & 8) <> 0)::text),
        ('update_event'::text, ((t.tgtype & 16) <> 0)::text),
        ('truncate_event'::text, ((t.tgtype & 32) <> 0)::text),
        ('instead_of'::text, ((t.tgtype & 64) <> 0)::text),
        ('when_expression'::text, pg_get_expr(t.tgqual, t.tgrelid, true)::text),
        ('update_columns'::text, t.tgattr::text),
        ('arguments_hex'::text, encode(t.tgargs, 'hex')::text),
        ('constraint_trigger'::text, (t.tgconstraint <> 0)::text),
        ('constraint_relation'::text,
            CASE WHEN t.tgconstrrelid = 0 THEN NULL::text
                 ELSE (SELECT format('%I.%I', rn.nspname, rc.relname)::text
                       FROM pg_class rc JOIN pg_namespace rn ON rn.oid = rc.relnamespace
                       WHERE rc.oid = t.tgconstrrelid) END),
        ('deferrable'::text, t.tgdeferrable::text),
        ('initially_deferred'::text, t.tginitdeferred::text)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal

    UNION ALL

    SELECT 'policy'::text, n.nspname::text,
           format('%I.%I', c.relname, pol.polname)::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL (VALUES
        ('command'::text, pol.polcmd::text),
        ('permissive'::text, pol.polpermissive::text),
        ('using_expression'::text, pg_get_expr(pol.polqual, pol.polrelid, true)::text),
        ('with_check_expression'::text, pg_get_expr(pol.polwithcheck, pol.polrelid, true)::text)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'policy_role'::text, n.nspname::text,
           format('%I.%I', c.relname, pol.polname)::text,
           'role'::text,
           CASE WHEN role_oid = 0 THEN 'PUBLIC'::text ELSE r.rolname::text END
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(pol.polroles) AS role_oid
    LEFT JOIN pg_roles r ON r.oid = role_oid
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'function'::text, n.nspname::text,
           format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language lang ON lang.oid = p.prolang
    CROSS JOIN LATERAL (VALUES
        ('definition'::text, pg_get_functiondef(p.oid)::text),
        ('source'::text, p.prosrc::text),
        ('binary'::text, p.probin::text),
        ('arguments'::text, pg_get_function_arguments(p.oid)::text),
        ('identity_arguments'::text, pg_get_function_identity_arguments(p.oid)::text),
        ('return_type'::text, pg_get_function_result(p.oid)::text),
		('returns_set'::text, p.proretset::text),
        ('language'::text, lang.lanname::text),
        ('kind'::text, p.prokind::text),
        ('volatility'::text, p.provolatile::text),
        ('strict'::text, p.proisstrict::text),
        ('security_definer'::text, p.prosecdef::text),
        ('leakproof'::text, p.proleakproof::text),
		('parallel_safety'::text, p.proparallel::text),
		('planner_cost'::text, p.procost::text),
		('planner_rows'::text, p.prorows::text),
		('support_function'::text,
			CASE WHEN p.prosupport = 0 THEN NULL::text
				 ELSE (SELECT format('%I.%I(%s)', sn.nspname, sp.proname, pg_get_function_identity_arguments(sp.oid))::text
				       FROM pg_proc sp JOIN pg_namespace sn ON sn.oid = sp.pronamespace
				       WHERE sp.oid = p.prosupport) END)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'
      AND p.oid NOT IN (
          SELECT objid FROM extension_objects WHERE classid = 'pg_proc'::regclass
      )

    UNION ALL

    SELECT 'function_config'::text, n.nspname::text,
           format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))::text,
           'setting'::text, setting_value::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS setting_value
    WHERE n.nspname = 'public'
      AND p.oid NOT IN (
          SELECT objid FROM extension_objects WHERE classid = 'pg_proc'::regclass
      )

    UNION ALL

    SELECT 'view'::text, n.nspname::text, c.relname::text,
           'definition'::text, pg_get_viewdef(c.oid, true)::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm')

    UNION ALL

    SELECT 'rule'::text, n.nspname::text,
           format('%I.%I', c.relname, rw.rulename)::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_rewrite rw
    JOIN pg_class c ON c.oid = rw.ev_class
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL (VALUES
        ('definition'::text, pg_get_ruledef(rw.oid, true)::text),
        ('event'::text, rw.ev_type::text),
        ('enabled_mode'::text, rw.ev_enabled::text),
        ('instead'::text, rw.is_instead::text)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'type'::text, n.nspname::text, typ.typname::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_type typ
    JOIN pg_namespace n ON n.oid = typ.typnamespace
    CROSS JOIN LATERAL (VALUES
        ('kind'::text, typ.typtype::text),
        ('category'::text, typ.typcategory::text),
        ('base_type'::text, CASE WHEN typ.typbasetype = 0 THEN NULL::text ELSE format_type(typ.typbasetype, typ.typtypmod)::text END),
        ('not_null'::text, typ.typnotnull::text),
        ('default'::text, typ.typdefault::text),
        ('collation'::text, CASE WHEN typ.typcollation = 0 THEN NULL::text ELSE typ.typcollation::regcollation::text END),
        ('delimiter'::text, typ.typdelim::text),
        ('element_type'::text, CASE WHEN typ.typelem = 0 THEN NULL::text ELSE format_type(typ.typelem, NULL)::text END)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'
      AND typ.typtype IN ('d', 'e', 'c', 'r')
      AND typ.oid NOT IN (
          SELECT objid FROM extension_objects WHERE classid = 'pg_type'::regclass
      )

    UNION ALL

    SELECT 'enum_label'::text, n.nspname::text, typ.typname::text,
           enum.enumsortorder::text, enum.enumlabel::text
    FROM pg_enum enum
    JOIN pg_type typ ON typ.oid = enum.enumtypid
    JOIN pg_namespace n ON n.oid = typ.typnamespace
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'range'::text, n.nspname::text, typ.typname::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_range rng
    JOIN pg_type typ ON typ.oid = rng.rngtypid
    JOIN pg_namespace n ON n.oid = typ.typnamespace
	JOIN pg_opclass opc ON opc.oid = rng.rngsubopc
	JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
    CROSS JOIN LATERAL (VALUES
        ('subtype'::text, format_type(rng.rngsubtype, NULL)::text),
        ('collation'::text, CASE WHEN rng.rngcollation = 0 THEN NULL::text ELSE rng.rngcollation::regcollation::text END),
		('operator_class'::text, format('%I.%I', opn.nspname, opc.opcname)::text),
		('canonical_function'::text,
			CASE WHEN rng.rngcanonical = 0 THEN NULL::text
				 ELSE (SELECT format('%I.%I(%s)', fn.nspname, fp.proname, pg_get_function_identity_arguments(fp.oid))::text
				       FROM pg_proc fp JOIN pg_namespace fn ON fn.oid = fp.pronamespace
				       WHERE fp.oid = rng.rngcanonical) END),
		('subdiff_function'::text,
			CASE WHEN rng.rngsubdiff = 0 THEN NULL::text
				 ELSE (SELECT format('%I.%I(%s)', fn.nspname, fp.proname, pg_get_function_identity_arguments(fp.oid))::text
				       FROM pg_proc fp JOIN pg_namespace fn ON fn.oid = fp.pronamespace
				       WHERE fp.oid = rng.rngsubdiff) END),
        ('multirange_type'::text, CASE WHEN rng.rngmultitypid = 0 THEN NULL::text ELSE format_type(rng.rngmultitypid, NULL)::text END)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'sequence'::text, n.nspname::text, c.relname::text,
           a.attribute_name::text, a.attribute_value::text
    FROM pg_sequence seq
    JOIN pg_class c ON c.oid = seq.seqrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL (VALUES
        ('data_type'::text, format_type(seq.seqtypid, NULL)::text),
        ('start'::text, seq.seqstart::text),
        ('increment'::text, seq.seqincrement::text),
        ('maximum'::text, seq.seqmax::text),
        ('minimum'::text, seq.seqmin::text),
        ('cache'::text, seq.seqcache::text),
        ('cycle'::text, seq.seqcycle::text),
        ('owned_by'::text, (
            SELECT format('%I.%I.%I', tn.nspname, tc.relname, att.attname)::text
            FROM pg_depend dep
            JOIN pg_class tc ON tc.oid = dep.refobjid
            JOIN pg_namespace tn ON tn.oid = tc.relnamespace
            JOIN pg_attribute att ON att.attrelid = dep.refobjid AND att.attnum = dep.refobjsubid
            WHERE dep.classid = 'pg_class'::regclass
              AND dep.objid = seq.seqrelid
              AND dep.refclassid = 'pg_class'::regclass
              AND dep.deptype IN ('a', 'i')
            ORDER BY dep.deptype
            LIMIT 1
        )::text)
    ) AS a(attribute_name, attribute_value)
    WHERE n.nspname = 'public'
)
SELECT object_type::text,
       schema_name::text,
       object_identity::text,
       attribute_name::text,
       attribute_value::text
FROM manifest
ORDER BY object_type COLLATE "C",
         schema_name COLLATE "C",
         object_identity COLLATE "C",
         attribute_name COLLATE "C",
         attribute_value COLLATE "C" NULLS FIRST;
