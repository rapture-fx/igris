#!/usr/bin/env python3
"""
Comprehensive test to verify RL optimization data persistence across service restarts.

This test demonstrates that:
1. RL optimization sessions are persisted to the database
2. Data survives service restarts (no in-memory storage)
3. All CRUD operations work correctly with real database
4. The compatibility mode is completely removed
"""

import asyncio
import sys
import os
import uuid
from datetime import datetime, timedelta

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_rl_persistence():
    """Comprehensive test for RL optimization persistence"""

    print("🧪 Starting RL Optimization Persistence Test")
    print("=" * 60)

    try:
        from app.database.connection import get_db
        from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
        from app.models.rl_models import SessionStatus, RLOptimizationSession
        from sqlalchemy import select, text

        # Test 1: Verify imports work correctly (no mock fallbacks)
        print("✅ Test 1: Database models imported successfully")
        print(f"   SessionStatus enum: {list(SessionStatus)}")
        print(f"   RLOptimizationSession table: {RLOptimizationSession.__tablename__}")

        test_user_id = f"persistence_test_{uuid.uuid4().hex[:8]}"
        test_pipeline_id = f"test_pipeline_{uuid.uuid4().hex[:8]}"
        created_sessions = []

        # Test 2: Database connection and table verification
        async for db_session in get_db():
            print("\\n✅ Test 2: Database connection established")

            # Verify tables exist
            result = await db_session.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN ('rl_optimization_sessions', 'rl_optimization_episodes')
                ORDER BY table_name
            """))
            tables = result.fetchall()
            print(f"   RL tables found: {[t[0] for t in tables]}")

            if len(tables) < 2:
                raise Exception("Required RL tables not found in database!")

            break

        # Test 3: CRUD operations and data persistence
        print("\\n✅ Test 3: CRUD operations with real database")

        async for db_session in get_db():
            crud = RLOptimizationCRUD(db_session)

            # Verify no compatibility mode
            assert not hasattr(crud, 'compatibility_mode'), "Compatibility mode should be removed"
            assert not hasattr(crud, '_mock_sessions'), "Mock sessions should be removed"
            print("   ✓ Compatibility mode completely removed")

            # Test Create
            session1 = await crud.create_session(
                user_id=test_user_id,
                pipeline_id=test_pipeline_id,
                optimization_type='hyperparameter',
                status=SessionStatus.PENDING,
                config={'learning_rate': 0.001, 'batch_size': 32}
            )
            created_sessions.append(str(session1.id))
            print(f"   ✓ Created session 1: {session1.id}")

            session2 = await crud.create_session(
                user_id=test_user_id,
                pipeline_id=test_pipeline_id,
                optimization_type='resource_allocation',
                status=SessionStatus.RUNNING,
                total_episodes=50,
                best_performance=0.85
            )
            created_sessions.append(str(session2.id))
            print(f"   ✓ Created session 2: {session2.id}")

            # Test Read
            retrieved = await crud.get_session(str(session1.id), user_id=test_user_id)
            assert retrieved is not None, "Session should be retrievable"
            assert retrieved.optimization_type == 'hyperparameter', "Data should match"
            print(f"   ✓ Retrieved session: {retrieved.optimization_type}")

            # Test Update
            updated = await crud.update_session(
                str(session1.id),
                status=SessionStatus.COMPLETED,
                best_performance=0.92,
                total_episodes=100
            )
            assert updated.status == SessionStatus.COMPLETED, "Status should be updated"
            assert updated.best_performance == 0.92, "Performance should be updated"
            print(f"   ✓ Updated session: status={updated.status}, performance={updated.best_performance}")

            # Test List
            sessions = await crud.list_sessions(test_user_id)
            assert len(sessions) >= 2, "Should list multiple sessions"
            print(f"   ✓ Listed {len(sessions)} sessions for user")

            break

        # Test 4: Data persistence across "service restart" (new connection)
        print("\\n✅ Test 4: Data persistence across service restart simulation")

        # Simulate service restart by getting a fresh database connection
        async for fresh_db_session in get_db():
            fresh_crud = RLOptimizationCRUD(fresh_db_session)

            # Verify data still exists after "restart"
            for session_id in created_sessions:
                persistent_session = await fresh_crud.get_session(session_id, user_id=test_user_id)
                assert persistent_session is not None, f"Session {session_id} should persist after restart"
                print(f"   ✓ Session {session_id[:8]}... persisted after restart")

            # Verify updated data is still correct
            updated_session = await fresh_crud.get_session(created_sessions[0], user_id=test_user_id)
            assert updated_session.status == SessionStatus.COMPLETED, "Updated status should persist"
            assert updated_session.best_performance == 0.92, "Updated performance should persist"
            print("   ✓ Updates persisted correctly after restart")

            break

        # Test 5: Complex queries and relationships
        print("\\n✅ Test 5: Complex database operations")

        async for db_session in get_db():
            # Test complex query
            result = await db_session.execute(text("""
                SELECT
                    optimization_type,
                    COUNT(*) as count,
                    AVG(best_performance) as avg_performance
                FROM rl_optimization_sessions
                WHERE user_id = :user_id
                GROUP BY optimization_type
            """), {"user_id": test_user_id})

            stats = result.fetchall()
            print(f"   ✓ Query statistics: {len(stats)} optimization types")
            for stat in stats:
                print(f"     - {stat[0]}: {stat[1]} sessions, avg performance: {stat[2]}")

            break

        # Test 6: Cleanup (Test Delete)
        print("\\n✅ Test 6: Cleanup and delete operations")

        async for db_session in get_db():
            crud = RLOptimizationCRUD(db_session)

            for session_id in created_sessions:
                deleted = await crud.delete_session(session_id, test_user_id)
                assert deleted, f"Session {session_id} should be deletable"
                print(f"   ✓ Deleted session {session_id[:8]}...")

            # Verify deletion
            remaining = await crud.list_sessions(test_user_id)
            assert len(remaining) == 0, "All test sessions should be deleted"
            print("   ✓ All test sessions cleaned up")

            break

        print("\\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED! RL Optimization System Status:")
        print("   ✅ Database models properly implemented")
        print("   ✅ Real database persistence working")
        print("   ✅ Compatibility mode completely removed")
        print("   ✅ Data survives service restarts")
        print("   ✅ All CRUD operations functional")
        print("   ✅ Complex queries supported")
        print("\\n🚀 The RL optimization system is now production-ready!")

        return True

    except Exception as e:
        print(f"\\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_rl_persistence())
    sys.exit(0 if success else 1)