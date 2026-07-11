---
title: 'Re: 履歴テーブルから最新の1件を取ってくる方法'
description: 'ユーザーごとの最新1件を取得する処理を、Window関数ではなく集約関数の工夫でインデックスを効かせて高速化する（PostgreSQL）。'
pubDate: 'Dec 10 2024'
commentId: 'latest-row-per-group-postgres'
---

そーだいさんが執筆された記事で、[履歴テーブルから最新の1件を取ってくる方法](https://soudai.hatenablog.com/entry/2024/12/10/115848)について解説している。PostgreSQLの例だと以下のようなユーザーの履歴データに対し:

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

ユーザーごとの最新のデータを1件ずつ取得するという処理が挙げられている。この類の集約しつつ順位をつけて取得するという処理は、サービス開発からデータ分析まで多様な分野で頻繁に必要になるにもかかわらず、SQLでは中々表現しにくい処理の一つである。そーだいさんの記事ではWindow関数を用いる方法を中心に複数のアプローチが解説されており大変有用な記事である。

そーだいさんの記事で紹介されている方法はどれもフルスキャンを行う方法であり、パフォーマンスが問題になる場合の対処法としては過去データの削除、パーティショニングやlatestテーブルの導入などが挙げられている。どれも一般的なアプローチであり、この類の処理が必要になった場合には検討に値する。

本記事では、この記事への補足として、クエリの工夫をすることによりインデックスを活用してパフォーマンスを向上させる方法を紹介する。筆者が一番慣れているPostgreSQLを例に挙げるが、他のDBMSでも同様の方法が適用できるものが多い。（できないものもある）

## SQLにおける集約処理について

この節では、集約処理がどのように実行されるかについて説明し、それをもとに上記の処理を集約処理でどう表現すればよいかを考える。具体的な実行方法のみを知りたい方はこの節は飛ばしすとよい。

### 集約の内部処理

集約処理とは、複数のデータから1つの結果を生成する処理のことである。値 $x_1, x_2, \ldots, x_n$ が与えられたとき、平均値を求める集約関数は、概念的には $avg(x_1, x_2 \ldots x_n)$ というものになる。実際のクエリ処理においては、$x_1, x_2, \ldots, x_n$がどのような集合になるかは事前には分からないため、ある中間状態を持ちつつ、値を適用することによって状態を順次更新していき、最終的な状態を結果として返す、という形で集約処理が行われる。

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

平均値を求める場合、$S_i$ は合計値と要素数を持つ状態であり、$update(S, x)$ は合計値と要素数を更新する関数、$finalize(S)$ は合計値を要素数で割る関数である。このように、集約処理は状態を持ちつつ、値を順次処理していくことによって結果を得る。

関数型のプログラミング言語に馴染みがある方であれば、`fold`や`reduce`と呼ばれる関数が同じような処理を行うことに思い当たるかもしれない。SQLにおいても、集約はこのような状態を持つ処理として実装されている。

### 順序が重要な集約処理

ところで、集約関数には順序が意味を持つものとそうでないものがある。例えば、`avg`や`max`、`min`などの集約関数は順序が重要でない。つまり、$x_1, x_2, \ldots, x_n$ の順序を入れ替えても結果は変わらない。一方、PostgreSQLでの`string_agg`や`array_agg`などの集約関数では、値の順序が変わると得られる結果が変わる。これは状態の更新を行う処理が可換であるかどうかによって決まる。

このような集約関数に対して、意図した順序で集約関数に値を渡すために、多くのDBMSでは集約関数内での`ORDER BY`句の指定をサポートしている。集約の対象とする列とは異なる列
で順序を指定することも可能である。 PostgreSQLにおいても、以下のように`ORDER BY`句を指定することができる。

```sql
SELECT string_agg(data ORDER BY created_at DESC) FROM history GROUP BY user_id;
```

### 最新の1件を取得する集約処理

以上を踏まえて、最新の1件を取得する処理を集約処理で表現することを考える。とはいっても、結論はとても単純で、$x_1, x_2, \ldots, x_n$ をユーザーごとの最新の順に並べ替えておき、$x_1$ を取得すればよい。概念的には次のようなクエリになる。

```sql
SELECT first(data ORDER BY created_at DESC) FROM history GROUP BY user_id;
```

以下の節では、この処理をどのようにPostgreSQLで実現するかについて説明する。

## PostgreSQLで最新の1件を取得するクエリ

### `any_value`を用いた最初の一件の取得

上記で例に用いた、最初の一件を返す集約関数`first`はPostgreSQLには存在しない。同じような関数をビルトインで提供しているDBMSもある（ぱっと思いつくところだとOracleやSpark SQLの`FIRST_VALUE`関数）。PostgreSQLはユーザー定義の集約関数が可能であり、上で説明したように`first`に必要な処理はごく単純なものであるので、自分で定義することも簡単にできるが、
PostgreSQL 16で導入された[`any_value`関数](https://www.postgresql.jp/document/16/html/functions-aggregate.html)を用いることができる。`any_value`の状態更新関数は[ここ](https://github.com/postgres/postgres/blob/d37e856410d0856cb851e11b2e0191edf6cde527/src/backend/utils/adt/misc.c#L1120-L1124)で定義されており、常に以前の状態を次の状態として用いるものになっている。つまり、最初の値が最終的な集約の結果になる集約関数であり、`first`と同等の挙動となる。

`any_value`を用いたクエリは以下のようになる。

```sql
> SELECT any_value(data ORDER BY created_at DESC) FROM history GROUP BY user_id;
       any_value
-----------------------
 Second entry of user1
 Third entry of user2
 First entry of user3
(3 rows)
```

### 複合型を用いた行全体の取得

上記のクエリでは、`data`列の最新の値を取得しているが、本来やりたい処理は行全体を取得することであることが多い。`any_value`は単一の値のみを受け取ることができるため、行全体に対して直接処理を行うことはできないが、PostgreSQLでは[複合型](https://www.postgresql.jp/document/16/html/rowtypes.html)という型を用いて、複数の値をまとめて単一の値として扱うことができる。PostgreSQLでは[テーブルを作成した際に暗黙的にテーブルと同名の複合型](https://www.postgresql.jp/document/16/html/rowtypes.html#ROWTYPES-DECLARING)が作られ、また[クエリ内でテーブル名のみを指定することによって行全体をその複合型の値として扱う](https://www.postgresql.jp/document/16/html/rowtypes.html#ROWTYPES-USAGE)ことができる。

この複合型を用いることによって、以下のようなクエリを書くことができる。

```sql
> SELECT any_value(history ORDER BY created_at DESC) FROM history GROUP BY user_id;
                      any_value
-----------------------------------------------------
 (2,1,"Second entry of user1","2024-01-02 09:30:00")
 (5,2,"Third entry of user2","2024-01-03 07:15:00")
 (6,3,"First entry of user3","2024-01-01 12:15:00")
(3 rows)
```

このままでもよいが、複合型を列に展開することによって、元の記事のクエリと完全に同じ結果を得ることができる。

```sql
> SELECT (any_value(history ORDER BY created_at DESC)).* FROM history GROUP BY user_id;
 id | user_id |         data          |     created_at
----+---------+-----------------------+---------------------
  2 |       1 | Second entry of user1 | 2024-01-02 09:30:00
  5 |       2 | Third entry of user2  | 2024-01-03 07:15:00
  6 |       3 | First entry of user3  | 2024-01-01 12:15:00
(3 rows)
```

### インデックスの活用

上記のクエリによって同等の結果を得ることができるが、そのままではフルスキャンを行うことになる。

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

SortとAggregateの処理になっているが、Seq Scanによるフルスキャンが行われているため、Window関数を用いる元記事のクエリと大きくはパフォーマンスが変わらないと思われる。

この実行計画からは、`(user_id, created_at)`にインデックスを作成することによって、インデックスを用いた処理に変更可能なことが容易に推測される。インデックスを作成すると、実際に以下のようなIndex Scanを用いた処理になる。（行数が少ないため、そのままではSeq Scanが選ばれてしまうため、`enable_seqscan`をfalseにしている）

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

## まとめ

ユーザーごとの最新一件を取得、のような集約と順序を組み合わせた処理は、実務においてよく必要になる処理である。このような処理をSQLで行うためには、Window関数を用いる方法が一般的に用いられるが、集約関数を工夫することによりインデックススキャンを用いるクエリを書くことが可能である。他にも、イベントソーシングによって別のストレージ・サービスに分ける方法などもありうるので、どのような要件なのかによって適切に使い分けて設計できるとよい。
