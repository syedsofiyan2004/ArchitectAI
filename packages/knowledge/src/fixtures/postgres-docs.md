# PostgreSQL Transaction Isolation

Read Committed is the default isolation level in PostgreSQL.
When a transaction uses this isolation level, a SELECT query sees only data committed before the query began.

## Non-repeatable Reads
However, two successive SELECT commands can see different data, even if they are within a single transaction, if other transactions commit changes during execution of the first SELECT. This is known as a non-repeatable read.
