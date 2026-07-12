---
title: 'Re: Fetching the latest row per group from a history table'
description: 'Getting the latest row per user with an aggregate-function trick that uses an index — instead of a window function (PostgreSQL).'
pubDate: 'Dec 10 2024'
commentId: 'latest-row-per-group-postgres'
translationKey: 'latest-row-per-group-postgres'
---

There's an article by soudai-san, [How to fetch the latest row from a history table](https://soudai.hatenablog.com/entry/2024/12/10/115848), that explains this problem. In PostgreSQL, given a table of user history like this:

```sql
CREATE TABLE history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    data TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO history (user_id, data, created_at) VALUES
(1, 'First entry of user1',  '2024-01-01 10:00:00'),
(1, 'Second entry of user1', '2024-01-02 09:30:00'),
(2, 'First entry of user2',  '2024-01-01 11:00:00'),
(2, 'Second entry of user2', '2024-01-02 08:45:00'),
(2, 'Third entry of user2',  '2024-01-03 07:15:00'),
(3, 'First entry of user3',  '2024-01-01 12:15:00');
```

it takes up the task of fetching the latest row for each user. This kind of "aggregate while ranking, then pick one" operation comes up constantly across everything from application development to data analysis, yet it's one of the operations that's surprisingly hard to express in SQL. soudai-san's article walks through several approaches, centered on window functions, and is very useful.

The methods introduced there all involve a full scan; when performance becomes a problem, the suggested remedies are deleting old data, partitioning, or introducing a "latest" table. These are all common approaches and worth considering when this kind of processing becomes necessary.

This article, as a supplement to that one, introduces a way to improve performance by crafting the query so that an index can be used. I'll use PostgreSQL — the DBMS I'm most familiar with — as the example, but the same approach applies to many other DBMSs (though not all).

## How aggregation works in SQL

In this section I explain how aggregation is executed, and based on that, consider how to express the operation above as an aggregation. If you only want the concrete method, feel free to skip this section.

### The internals of aggregation

Aggregation is the operation of producing a single result from multiple values. Given values $x_1, x_2, \ldots, x_n$, an aggregate function that computes the average is conceptually something like $avg(x_1, x_2 \ldots x_n)$. In actual query processing, the set $x_1, x_2, \ldots, x_n$ isn't known in advance, so aggregation is performed by keeping some intermediate state, updating that state by applying values one by one, and finally returning the final state as the result.

$$
\begin{aligned}
S_0 &\leftarrow initial \, state\\
S_1 &\leftarrow update(S_0, x_1)\\
S_2 &\leftarrow update(S_1, x_2)\\
&\ldots\\
S_n &\leftarrow update(S_{n-1}, x_n)\\
S_{final} &\leftarrow finalize(S_n)
\end{aligned}
$$

For computing an average, $S_i$ is a state holding a running sum and a count, $update(S, x)$ updates the sum and count, and $finalize(S)$ divides the sum by the count. In this way, aggregation obtains a result by holding state and processing values in sequence.

If you're familiar with functional programming languages, you may notice that the functions called `fold` or `reduce` do the same kind of thing. In SQL too, aggregation is implemented as this kind of stateful processing.

### Aggregations where order matters

Now, some aggregate functions depend on order and some don't. For example, `avg`, `max`, and `min` don't depend on order: swapping the order of $x_1, x_2, \ldots, x_n$ doesn't change the result. On the other hand, PostgreSQL's `string_agg` or `array_agg` produce different results when the order of values changes. Whether order matters is determined by whether the state-update operation is commutative.

For such aggregate functions, to pass values to the aggregate in the intended order, many DBMSs support specifying an `ORDER BY` clause inside the aggregate function. You can even order by a column different from the one being aggregated. In PostgreSQL, you can specify `ORDER BY` like this:

```sql
SELECT string_agg(data ORDER BY created_at DESC) FROM history GROUP BY user_id;
```

### Getting the latest row as an aggregation

With that in mind, let's think about expressing "get the latest single row" as an aggregation. The conclusion is very simple: sort $x_1, x_2, \ldots, x_n$ so that the latest comes first for each user, and take $x_1$. Conceptually, the query looks like this:

```sql
SELECT first(data ORDER BY created_at DESC) FROM history GROUP BY user_id;
```

In the sections below, I explain how to realize this in PostgreSQL.

## A query to get the latest row in PostgreSQL

### Getting the first row with `any_value`

The `first` aggregate function used in the example above — which returns the first row — does not exist in PostgreSQL. Some DBMSs provide something like it built in (the ones that come to mind are Oracle's and Spark SQL's `FIRST_VALUE`). PostgreSQL allows user-defined aggregate functions, and since — as explained above — the processing `first` needs is very simple, you could easily define it yourself. But you can also use the [`any_value` function](https://www.postgresql.jp/document/16/html/functions-aggregate.html) introduced in PostgreSQL 16. `any_value`'s state-update function is defined [here](https://github.com/postgres/postgres/blob/d37e856410d0856cb851e11b2e0191edf6cde527/src/backend/utils/adt/misc.c#L1120-L1124), and it always keeps the previous state as the next state. In other words, it's an aggregate function whose final result is the first value — behaving the same as `first`.

A query using `any_value` looks like this:

```sql
> SELECT any_value(data ORDER BY created_at DESC) FROM history GROUP BY user_id;
       any_value
-----------------------
 Second entry of user1
 Third entry of user2
 First entry of user3
(3 rows)
```

### Getting the whole row with a composite type

The query above fetches the latest value of the `data` column, but what we really want, in many cases, is the whole row. `any_value` can only take a single value, so it can't operate on the whole row directly. However, PostgreSQL lets you treat multiple values as a single value using a [composite type](https://www.postgresql.jp/document/16/html/rowtypes.html). In PostgreSQL, [a composite type with the same name as the table is implicitly created when you create the table](https://www.postgresql.jp/document/16/html/rowtypes.html#ROWTYPES-DECLARING), and [by specifying just the table name in a query you can treat the whole row as a value of that composite type](https://www.postgresql.jp/document/16/html/rowtypes.html#ROWTYPES-USAGE).

Using this composite type, you can write a query like this:

```sql
> SELECT any_value(history ORDER BY created_at DESC) FROM history GROUP BY user_id;
                      any_value
-----------------------------------------------------
 (2,1,"Second entry of user1","2024-01-02 09:30:00")
 (5,2,"Third entry of user2","2024-01-03 07:15:00")
 (6,3,"First entry of user3","2024-01-01 12:15:00")
(3 rows)
```

This is fine as is, but by expanding the composite type into columns you can get exactly the same result as the original article's query.

```sql
> SELECT (any_value(history ORDER BY created_at DESC)).* FROM history GROUP BY user_id;
 id | user_id |         data          |     created_at
----+---------+-----------------------+---------------------
  2 |       1 | Second entry of user1 | 2024-01-02 09:30:00
  5 |       2 | Third entry of user2  | 2024-01-03 07:15:00
  6 |       3 | First entry of user3  | 2024-01-01 12:15:00
(3 rows)
```

### Making use of an index

The query above produces an equivalent result, but as written it performs a full scan.

```sql
=# EXPLAIN SELECT (any_value(history ORDER BY created_at DESC)).* FROM history GROUP BY user_id;
                             QUERY PLAN
--------------------------------------------------------------------
 GroupAggregate  (cost=1.14..1.24 rows=6 width=52)
   Group Key: user_id
   ->  Sort  (cost=1.14..1.15 rows=6 width=84)
         Sort Key: user_id, created_at DESC
         ->  Seq Scan on history  (cost=0.00..1.06 rows=6 width=84)
(5 rows)
```

It becomes a Sort + Aggregate, but because a Seq Scan (full scan) is performed, the performance probably doesn't differ much from the window-function query in the original article.

From this execution plan, it's easy to guess that creating an index on `(user_id, created_at)` would let this be processed using the index. When you create the index, it indeed becomes an Index Scan. (Because there are few rows, a Seq Scan would be chosen as is, so I set `enable_seqscan` to false.)

```sql
> CREATE INDEX ON history (user_id, created_at DESC);
CREATE INDEX

> set enable_seqscan to false;
SET

> EXPLAIN SELECT (any_value(history ORDER BY created_at DESC)).* FROM history GROUP BY user_id;
                                              QUERY PLAN
------------------------------------------------------------------------------------------------------
 GroupAggregate  (cost=0.13..12.31 rows=6 width=52)
   Group Key: user_id
   ->  Index Scan using history_user_id_created_at_idx on history  (cost=0.13..12.22 rows=6 width=84)
(3 rows)
```

## Summary

Operations that combine aggregation and ordering — like "get the latest row per user" — come up often in practice. To do this in SQL, window functions are the common approach, but by crafting the aggregate function you can write a query that uses an index scan. There are also other approaches, such as splitting into a separate storage/service via event sourcing, so it's good to design by choosing appropriately depending on the requirements.
