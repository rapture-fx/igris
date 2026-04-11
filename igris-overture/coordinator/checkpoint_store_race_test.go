package coordinator

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/google/uuid"
)

type queuedExecExpectation struct {
	rowsAffected int64
	err          error
}

type queuedQueryExpectation struct {
	values []driver.Value
	err    error
}

type queuedExecDriver struct {
	execs   []queuedExecExpectation
	queries []queuedQueryExpectation
}

type queuedExecConn struct {
	driver *queuedExecDriver
}

type queuedExecTx struct{}

func newQueuedExecDB(t *testing.T, expectations ...queuedExecExpectation) (*sql.DB, *queuedExecDriver) {
	t.Helper()

	name := "queued-exec-" + uuid.NewString()
	driver := &queuedExecDriver{execs: append([]queuedExecExpectation(nil), expectations...)}
	sql.Register(name, driver)

	db, err := sql.Open(name, "")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() {
		_ = db.Close()
	})

	return db, driver
}

func newQueuedCheckpointDB(t *testing.T, queries []queuedQueryExpectation, execs ...queuedExecExpectation) (*sql.DB, *queuedExecDriver) {
	t.Helper()

	name := "queued-checkpoint-" + uuid.NewString()
	driver := &queuedExecDriver{
		execs:   append([]queuedExecExpectation(nil), execs...),
		queries: append([]queuedQueryExpectation(nil), queries...),
	}
	sql.Register(name, driver)

	db, err := sql.Open(name, "")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() {
		_ = db.Close()
	})

	return db, driver
}

func (d *queuedExecDriver) Open(string) (driver.Conn, error) {
	return &queuedExecConn{driver: d}, nil
}

func (d *queuedExecDriver) nextResult() (driver.Result, error) {
	if len(d.execs) == 0 {
		return nil, errors.New("unexpected exec")
	}
	next := d.execs[0]
	d.execs = d.execs[1:]
	if next.err != nil {
		return nil, next.err
	}
	return driver.RowsAffected(next.rowsAffected), nil
}

func (d *queuedExecDriver) remainingExecs() int {
	return len(d.execs)
}

func (d *queuedExecDriver) nextQueryRows() (driver.Rows, error) {
	if len(d.queries) == 0 {
		return &queuedRows{columns: []string{"last_checkpoint"}, values: [][]driver.Value{{nil}}}, nil
	}
	next := d.queries[0]
	d.queries = d.queries[1:]
	if next.err != nil {
		return nil, next.err
	}
	if next.values == nil {
		return &queuedRows{columns: []string{"last_checkpoint"}}, nil
	}
	return &queuedRows{columns: []string{"last_checkpoint"}, values: [][]driver.Value{next.values}}, nil
}

func (d *queuedExecDriver) remainingQueries() int {
	return len(d.queries)
}

func (c *queuedExecConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("prepare not implemented")
}

func (c *queuedExecConn) Close() error {
	return nil
}

func (c *queuedExecConn) Begin() (driver.Tx, error) {
	return queuedExecTx{}, nil
}

func (c *queuedExecConn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return queuedExecTx{}, nil
}

func (c *queuedExecConn) ExecContext(context.Context, string, []driver.NamedValue) (driver.Result, error) {
	return c.driver.nextResult()
}

func (c *queuedExecConn) QueryContext(context.Context, string, []driver.NamedValue) (driver.Rows, error) {
	return c.driver.nextQueryRows()
}

func (tx queuedExecTx) Commit() error {
	return nil
}

func (tx queuedExecTx) Rollback() error {
	return nil
}

type queuedRows struct {
	columns []string
	values  [][]driver.Value
	index   int
}

func (r *queuedRows) Columns() []string {
	return r.columns
}

func (r *queuedRows) Close() error {
	return nil
}

func (r *queuedRows) Next(dest []driver.Value) error {
	if r.index >= len(r.values) {
		return io.EOF
	}
	copy(dest, r.values[r.index])
	r.index++
	return nil
}

func TestCheckpointStoreRejectsCheckpointAfterCancel(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{values: []driver.Value{nil}}},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 0},
	)
	store := NewCheckpointStore(db)
	taskID := uuid.New()

	if err := store.MarkCanceled(taskID); err != nil {
		t.Fatalf("MarkCanceled() error = %v", err)
	}

	err := store.SaveCheckpoint(&CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 7,
			CheckpointDigest:  "abcd",
			RuntimeID:         "runtime-canceled",
		},
		CapturedAt: time.Unix(1_700_000_000, 0).UTC(),
	})
	if !errors.Is(err, ErrTaskTransitionRejected) {
		t.Fatalf("SaveCheckpoint() error = %v, want ErrTaskTransitionRejected", err)
	}
	if queued.remainingExecs() != 0 {
		t.Fatalf("remaining execs = %d, want 0", queued.remainingExecs())
	}
	if queued.remainingQueries() != 0 {
		t.Fatalf("remaining queries = %d, want 0", queued.remainingQueries())
	}
}

func TestCheckpointStoreRejectsCompleteAfterCancel(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedExecDB(t,
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 0},
	)
	store := NewCheckpointStore(db)
	taskID := uuid.New()

	if err := store.MarkCanceled(taskID); err != nil {
		t.Fatalf("MarkCanceled() error = %v", err)
	}
	if err := store.MarkCompleted(taskID); !errors.Is(err, ErrTaskTransitionRejected) {
		t.Fatalf("MarkCompleted() error = %v, want ErrTaskTransitionRejected", err)
	}
	if queued.remainingExecs() != 0 {
		t.Fatalf("remaining execs = %d, want 0", queued.remainingExecs())
	}
}

func TestCheckpointStoreRejectsFailedAfterCancel(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedExecDB(t,
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 0},
	)
	store := NewCheckpointStore(db)
	taskID := uuid.New()

	if err := store.MarkCanceled(taskID); err != nil {
		t.Fatalf("MarkCanceled() error = %v", err)
	}
	if err := store.MarkFailed(taskID, "runtime surfaced late failure"); !errors.Is(err, ErrTaskTransitionRejected) {
		t.Fatalf("MarkFailed() error = %v, want ErrTaskTransitionRejected", err)
	}
	if queued.remainingExecs() != 0 {
		t.Fatalf("remaining execs = %d, want 0", queued.remainingExecs())
	}
}

func TestCheckpointStoreRejectsRedispatchAfterCancel(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedExecDB(t,
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 0},
	)
	store := NewCheckpointStore(db)
	taskID := uuid.New()

	if err := store.MarkCanceled(taskID); err != nil {
		t.Fatalf("MarkCanceled() error = %v", err)
	}
	if err := store.MarkDispatched(taskID, "runtime-recovery", "http://runtime-recovery"); !errors.Is(err, ErrTaskTransitionRejected) {
		t.Fatalf("MarkDispatched() error = %v, want ErrTaskTransitionRejected", err)
	}
	if queued.remainingExecs() != 0 {
		t.Fatalf("remaining execs = %d, want 0", queued.remainingExecs())
	}
}

func TestCheckpointStoreRejectsStaleCheckpointStep(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	current := []byte(`{"task_id":"` + taskID.String() + `","resume_token":{"last_committed_step":5,"checkpoint_digest":"prev","runtime_id":"runtime-1"},"wal_entries":[]}`)
	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{values: []driver.Value{current}}})
	store := NewCheckpointStore(db)

	err := store.SaveCheckpoint(&CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 5,
			CheckpointDigest:  "same-step",
			RuntimeID:         "runtime-2",
		},
		CapturedAt: time.Unix(1_700_000_100, 0).UTC(),
	})
	if !errors.Is(err, ErrTaskTransitionRejected) {
		t.Fatalf("SaveCheckpoint() error = %v, want ErrTaskTransitionRejected", err)
	}
	if queued.remainingExecs() != 0 {
		t.Fatalf("remaining execs = %d, want 0", queued.remainingExecs())
	}
	if queued.remainingQueries() != 0 {
		t.Fatalf("remaining queries = %d, want 0", queued.remainingQueries())
	}
}
